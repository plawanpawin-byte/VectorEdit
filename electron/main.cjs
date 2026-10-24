const { app, BrowserWindow, Menu, dialog, ipcMain, shell } = require('electron');
const fs = require('node:fs/promises');
const path = require('node:path');
const { startBridge } = require('./bridge.cjs');

// the user data folder (recent files, agent bridge) is named after the app, in development and when installed
app.setName('Lunatic Design');

// an agent that starts the server the old way (the app itself, without Node mode) must not open a window; it exits at once
const AGENT_LAUNCH = process.argv.some((a) => a.endsWith('mcp-server.cjs') || a === '--mcp');
if (AGENT_LAUNCH && !process.env.ELECTRON_RUN_AS_NODE) app.exit(0);

// `Lunatic Design.exe --mcp` is the MCP server an AI agent starts: no window, no single-instance lock
const MCP_MODE = process.argv.includes('--mcp');
if (MCP_MODE) {
  app.disableHardwareAcceleration();
  require('./mcp-server.cjs').runStdio();
}
// `Lunatic Design.exe --install-mcp`: add the MCP server to Claude Code, Codex and Antigravity, then exit
const INSTALL_MODE = process.argv.includes('--install-mcp');
let bridge = null;

// how an agent starts the server: this app's own Electron binary in Node mode running mcp-server.cjs.
// A GUI exe gets no usable stdin/stdout when an agent starts it, so the server runs as a plain script instead.
function mcpEntry() {
  return {
    command: app.isPackaged ? app.getPath('exe') : process.execPath,
    args: [path.join(__dirname, 'mcp-server.cjs')],
    env: { ELECTRON_RUN_AS_NODE: '1' },
  };
}

async function runInstallMcp() {
  const { installMcp } = require('./install-mcp.cjs');
  // the portable build runs from a temporary copy, so an agent config pointing into it would break on the next start
  if (process.env.PORTABLE_EXECUTABLE_FILE) {
    const text = 'Lunatic Design: the portable build cannot be connected to agents. Install with lunaticDesign-Setup and run this again.\n';
    process.stdout.write(text);
    await fs.writeFile(path.join(app.getPath('userData'), 'install-mcp.log'), text, 'utf8').catch(() => {});
    app.exit(1);
    return;
  }
  const entry = mcpEntry();
  const report = await installMcp({ home: app.getPath('home'), entry });
  const lines = [
    'Lunatic Design: connecting AI agents',
    ...report.map((r) => (r.status === 'written' ? `  ${r.agent}: written to ${r.file}` : r.status === 'skipped' ? `  ${r.agent}: skipped (${r.reason})` : `  ${r.agent}: NOT written (${r.reason}) ${r.file}`)),
    'Restart Claude Code, Codex or Antigravity, then ask it to use the lunatic-design tools.',
  ];
  const text = lines.join('\n') + '\n';
  process.stdout.write(text);
  try {
    await fs.writeFile(path.join(app.getPath('userData'), 'install-mcp.log'), text, 'utf8');
  } catch {
    // the log is a convenience; the printed result is what matters
  }
  const failed = report.some((r) => r.status === 'failed');
  app.exit(failed ? 1 : 0);
}

const DEV_URL = process.env.VITE_DEV_SERVER_URL;
let win = null;

/** Documents/Lunatic Design: the default place for opening, saving and exporting. Works offline; nothing is fetched. */
const workFolder = () => path.join(app.getPath('documents'), 'Lunatic Design');
async function ensureWorkFolder() {
  try {
    await fs.mkdir(workFolder(), { recursive: true });
  } catch {
    // Documents may be read-only or redirected; the dialogs then open where the OS decides
  }
}

function createWindow() {
  win = new BrowserWindow({
    width: 1440,
    height: 900,
    minWidth: 960,
    minHeight: 600,
    backgroundColor: '#0d1a1d',
    title: 'lunaticDesign',
    // The renderer draws its own menu bar; the native one stays (hidden) so its accelerators keep working.
    autoHideMenuBar: process.platform !== 'darwin',
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  });

  if (DEV_URL) win.loadURL(DEV_URL);
  else win.loadFile(path.join(__dirname, '..', 'dist', 'index.html'));

  // never navigate the app window away; open external links in the browser
  win.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url);
    return { action: 'deny' };
  });
  win.webContents.on('will-navigate', (e, url) => {
    if (!url.startsWith('file://') && url !== DEV_URL && !url.startsWith(DEV_URL ?? '\0')) e.preventDefault();
  });
  // keep the title we set (file name) instead of the page's <title>
  win.on('page-title-updated', (e) => e.preventDefault());
  win.on('closed', () => (win = null));
  guardClose();
  // the page's beforeunload prompt is for browsers; here the close guard above has already asked, so let the close through
  win.webContents.on('will-prevent-unload', (e) => e.preventDefault());

}

const send = (channel) => win?.webContents.send(channel);

/** Ask the page whether it has unsaved changes before the window closes. */
let closing = false;
function guardClose() {
  win.on('close', async (e) => {
    if (closing) return;
    e.preventDefault();
    let dirty = false;
    try {
      dirty = await win.webContents.executeJavaScript('window.__veDirty ? window.__veDirty() : false');
    } catch {
      /* page is gone: nothing to protect */
    }
    if (dirty) {
      const choice = dialog.showMessageBoxSync(win, {
        type: 'warning',
        buttons: ['Cancel', 'Discard changes and quit'],
        defaultId: 0,
        cancelId: 0,
        title: 'Unsaved changes',
        message: 'This document has unsaved changes.',
        detail: 'Cancel to go back and save it, or discard the changes.',
      });
      if (choice === 0) return;
    }
    closing = true;
    win.close();
  });
}

/** A .vedit path given on the command line or by double-clicking the file. */
const vedit = (argv) => argv.find((a) => /\.vedit$/i.test(a) && !a.startsWith('-'));
let pendingFile = vedit(process.argv.slice(1));

// recently used documents, kept in the user data folder and shown on the start page
const RECENT_MAX = 8;
const recentStore = () => path.join(app.getPath('userData'), 'recent.json');
async function readRecent() {
  try {
    return JSON.parse(await fs.readFile(recentStore(), 'utf8'));
  } catch {
    return [];
  }
}
async function writeRecent(list) {
  await fs.mkdir(path.dirname(recentStore()), { recursive: true });
  await fs.writeFile(recentStore(), JSON.stringify(list), 'utf8');
}
async function remember(file) {
  const list = [file, ...(await readRecent()).filter((f) => f !== file)].slice(0, RECENT_MAX);
  await writeRecent(list).catch(() => {});
}

async function openPath(file) {
  try {
    const text = await fs.readFile(file, 'utf8');
    await remember(file);
    win?.webContents.send('open-file', { path: file, text });
  } catch (err) {
    dialog.showErrorBox('Could not open the file', String(err && err.message ? err.message : err));
  }
}

function buildMenu() {
  const mac = process.platform === 'darwin';
  const template = [
    ...(mac ? [{ role: 'appMenu' }] : []),
    {
      label: 'File',
      submenu: [
        { label: 'New…', accelerator: 'CmdOrCtrl+N', click: () => send('menu:new') },
        { label: 'Open…', accelerator: 'CmdOrCtrl+O', click: () => send('menu:open') },
        { label: 'Import images or SVG…', accelerator: 'CmdOrCtrl+Shift+I', click: () => send('menu:import') },
        { label: 'Save', accelerator: 'CmdOrCtrl+S', click: () => send('menu:save') },
        { label: 'Save As…', accelerator: 'CmdOrCtrl+Shift+S', click: () => send('menu:save-as') },
        { type: 'separator' },
        { label: 'Export SVG…', click: () => send('menu:export-svg') },
        { label: 'Export PNG…', click: () => send('menu:export-png') },
        { type: 'separator' },
        mac ? { role: 'close' } : { role: 'quit' },
      ],
    },
    // Ctrl+R (rulers) and Ctrl+Shift+I (import) belong to the editor, so reload and DevTools use the F keys
    ...(mac ? [{ label: 'Edit', submenu: [{ role: 'cut' }, { role: 'copy' }, { role: 'paste' }] }] : []),
    { label: 'View', submenu: [{ role: 'reload', accelerator: 'F5' }, { role: 'toggleDevTools', accelerator: 'F12' }, { type: 'separator' }, { role: 'togglefullscreen' }] },
  ];
  Menu.setApplicationMenu(Menu.buildFromTemplate(template));
}

const FILTERS = [{ name: 'lunaticDesign document', extensions: ['vedit'] }];
const IMAGE_EXTENSIONS = ['png', 'jpg', 'jpeg', 'gif', 'webp', 'bmp', 'avif', 'ico', 'svg'];
// Open accepts documents and pictures; the first filter is the one shown by default
const OPEN_FILTERS = [
  { name: 'All supported files', extensions: ['vedit', ...IMAGE_EXTENSIONS] },
  FILTERS[0],
  { name: 'Images and SVG', extensions: IMAGE_EXTENSIONS },
];

/** A document is read as text; a picture is read as bytes and imported by the page. */
async function readEntry(file) {
  if (path.extname(file).toLowerCase() === '.vedit') {
    await remember(file);
    return { path: file, name: path.basename(file), text: await fs.readFile(file, 'utf8') };
  }
  return { path: null, name: path.basename(file), bytes: new Uint8Array(await fs.readFile(file)) };
}

ipcMain.handle('file:open', async () => {
  const r = await dialog.showOpenDialog(win, { defaultPath: workFolder(), filters: OPEN_FILTERS, properties: ['openFile', 'multiSelections'] });
  if (r.canceled || !r.filePaths.length) return null;
  return Promise.all(r.filePaths.map(readEntry));
});

ipcMain.handle('file:save', async (_e, { path: target, text, saveAs }) => {
  let dest = target;
  if (!dest || saveAs) {
    const r = await dialog.showSaveDialog(win, { filters: FILTERS, defaultPath: dest ?? path.join(workFolder(), 'Untitled.vedit') });
    if (r.canceled || !r.filePath) return null;
    dest = r.filePath;
  }
  await fs.writeFile(dest, text, 'utf8');
  await remember(dest);
  return { path: dest };
});

ipcMain.handle('file:export', async (_e, { name, ext, data }) => {
  const r = await dialog.showSaveDialog(win, { defaultPath: path.join(workFolder(), name), filters: [{ name: ext.toUpperCase(), extensions: [ext] }] });
  if (r.canceled || !r.filePath) return null;
  await fs.writeFile(r.filePath, Buffer.from(data));
  return { path: r.filePath };
});

// The page asks for the file it was launched with once it is ready, so nothing is sent before it listens.
ipcMain.handle('file:pending', async () => {
  const file = pendingFile;
  pendingFile = null;
  if (!file) return null;
  try {
    const text = await fs.readFile(file, 'utf8');
    await remember(file);
    return { path: file, text };
  } catch (err) {
    dialog.showErrorBox('Could not open the file', String(err && err.message ? err.message : err));
    return null;
  }
});

// the start page lists only files that still exist; missing ones are dropped from the list
ipcMain.handle('recent:list', async () => {
  const list = await readRecent();
  const alive = [];
  for (const f of list) {
    try {
      await fs.access(f);
      alive.push(f);
    } catch {
      // gone from disk
    }
  }
  if (alive.length !== list.length) await writeRecent(alive).catch(() => {});
  return alive.map((f) => ({ path: f, name: path.basename(f), dir: path.dirname(f) }));
});

ipcMain.handle('recent:remove', async (_e, file) => {
  await writeRecent((await readRecent()).filter((f) => f !== file)).catch(() => {});
});

// only paths already in the recent list can be opened this way, so the page cannot read arbitrary files
ipcMain.handle('recent:open', async (_e, file) => {
  if (!(await readRecent()).includes(file)) return null;
  try {
    const text = await fs.readFile(file, 'utf8');
    await remember(file);
    return { path: file, text };
  } catch {
    await writeRecent((await readRecent()).filter((f) => f !== file)).catch(() => {});
    return null;
  }
});

ipcMain.on('title', (_e, title) => win?.setTitle(title));

// what the "Connect AI agents" window shows: how to start the MCP server
ipcMain.handle('agent:info', () => ({
  ...mcpEntry(),
  workFolder: workFolder(),
  running: !!bridge,
}));

app.on('before-quit', () => void bridge?.close());

// one editor window: opening a second .vedit file hands it to the running one
if (MCP_MODE || INSTALL_MODE) {
  // nothing to set up: the MCP server talks to the already running editor, and the installer only writes config files
} else if (!app.requestSingleInstanceLock()) {
  app.quit();
} else {
  app.on('second-instance', (_e, argv) => {
    if (win) {
      if (win.isMinimized()) win.restore();
      win.focus();
    }
    const f = vedit(argv.slice(1));
    if (f) void openPath(f);
  });
}
app.on('open-file', (e, file) => {
  e.preventDefault();
  if (win) void openPath(file);
  else pendingFile = file;
});

app.whenReady().then(async () => {
  if (INSTALL_MODE) return runInstallMcp();
  if (MCP_MODE) return;
  await ensureWorkFolder();
  buildMenu();
  createWindow();
  // lets AI agents (through the MCP server) read and edit the open document; private to this computer
  try {
    bridge = await startBridge({ getWindow: () => win, userDataDir: app.getPath('userData'), workFolder, onFile: (f) => void remember(f) });
  } catch (err) {
    console.error('Agent bridge did not start:', err);
  }
  app.on('activate', () => BrowserWindow.getAllWindows().length === 0 && createWindow());
});
app.on('window-all-closed', () => process.platform !== 'darwin' && app.quit());
