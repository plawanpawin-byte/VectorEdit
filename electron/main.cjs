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
    title: 'VectorEdit',
    autoHideMenuBar: false,
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
}

const send = (channel) => win?.webContents.send(channel);

function buildMenu() {
  const mac = process.platform === 'darwin';
  const template = [
    ...(mac ? [{ role: 'appMenu' }] : []),
    {
      label: 'File',
      submenu: [
        { label: 'New', accelerator: 'CmdOrCtrl+N', click: () => send('menu:new') },
        { label: 'Open…', accelerator: 'CmdOrCtrl+O', click: () => send('menu:open') },
        { label: 'Save', accelerator: 'CmdOrCtrl+S', click: () => send('menu:save') },
        { label: 'Save As…', accelerator: 'CmdOrCtrl+Shift+S', click: () => send('menu:save-as') },
        { type: 'separator' },
        { label: 'Export SVG…', click: () => send('menu:export-svg') },
        { label: 'Export PNG…', click: () => send('menu:export-png') },
        { type: 'separator' },
        mac ? { role: 'close' } : { role: 'quit' },
      ],
    },
    { label: 'View', submenu: [{ role: 'reload' }, { role: 'toggleDevTools' }, { type: 'separator' }, { role: 'togglefullscreen' }] },
  ];
  Menu.setApplicationMenu(Menu.buildFromTemplate(template));
}

const FILTERS = [{ name: 'VectorEdit document', extensions: ['vedit'] }];

ipcMain.handle('file:open', async () => {
  const r = await dialog.showOpenDialog(win, { filters: FILTERS, properties: ['openFile'] });
  if (r.canceled || !r.filePaths[0]) return null;
  return { path: r.filePaths[0], text: await fs.readFile(r.filePaths[0], 'utf8') };
});

ipcMain.handle('file:save', async (_e, { path: target, text, saveAs }) => {
  let dest = target;
  if (!dest || saveAs) {
    const r = await dialog.showSaveDialog(win, { filters: FILTERS, defaultPath: dest ?? 'Untitled.vedit' });
    if (r.canceled || !r.filePath) return null;
    dest = r.filePath;
  }
  await fs.writeFile(dest, text, 'utf8');
  return { path: dest };
});

ipcMain.handle('file:export', async (_e, { name, ext, data }) => {
  const r = await dialog.showSaveDialog(win, { defaultPath: name, filters: [{ name: ext.toUpperCase(), extensions: [ext] }] });
  if (r.canceled || !r.filePath) return null;
  await fs.writeFile(r.filePath, Buffer.from(data));
  return { path: r.filePath };
});

ipcMain.on('title', (_e, title) => win?.setTitle(title));

app.whenReady().then(() => {
  buildMenu();
  createWindow();
  app.on('activate', () => BrowserWindow.getAllWindows().length === 0 && createWindow());
});
app.on('window-all-closed', () => process.platform !== 'darwin' && app.quit());
