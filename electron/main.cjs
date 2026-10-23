const { app, BrowserWindow, Menu, dialog, ipcMain, shell } = require('electron');
const fs = require('node:fs/promises');
const path = require('node:path');

const DEV_URL = process.env.VITE_DEV_SERVER_URL;
let win = null;

function createWindow() {
  win = new BrowserWindow({
    width: 1440,
    height: 900,
    minWidth: 960,
    minHeight: 600,
    backgroundColor: '#222222',
    title: 'vectorDesign',
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

const FILTERS = [{ name: 'vectorDesign document', extensions: ['vedit'] }];
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
  const r = await dialog.showOpenDialog(win, { filters: OPEN_FILTERS, properties: ['openFile', 'multiSelections'] });
  if (r.canceled || !r.filePaths.length) return null;
  return Promise.all(r.filePaths.map(readEntry));
});

ipcMain.handle('file:save', async (_e, { path: target, text, saveAs }) => {
  let dest = target;
  if (!dest || saveAs) {
    const r = await dialog.showSaveDialog(win, { filters: FILTERS, defaultPath: dest ?? 'Untitled.vedit' });
    if (r.canceled || !r.filePath) return null;
    dest = r.filePath;
  }
  await fs.writeFile(dest, text, 'utf8');
  await remember(dest);
  return { path: dest };
});

ipcMain.handle('file:export', async (_e, { name, ext, data }) => {
  const r = await dialog.showSaveDialog(win, { defaultPath: name, filters: [{ name: ext.toUpperCase(), extensions: [ext] }] });
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

// one editor window: opening a second .vedit file hands it to the running one
if (!app.requestSingleInstanceLock()) {
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

app.whenReady().then(() => {
  buildMenu();
  createWindow();
  app.on('activate', () => BrowserWindow.getAllWindows().length === 0 && createWindow());
});
app.on('window-all-closed', () => process.platform !== 'darwin' && app.quit());
