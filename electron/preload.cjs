const { contextBridge, ipcRenderer } = require('electron');

const menuChannels = ['new', 'open', 'import', 'save', 'save-as', 'export-svg', 'export-png'];

contextBridge.exposeInMainWorld('desktop', {
  openFile: () => ipcRenderer.invoke('file:open'),
  saveFile: (payload) => ipcRenderer.invoke('file:save', payload),
  exportFile: (payload) => ipcRenderer.invoke('file:export', payload),
  setTitle: (title) => ipcRenderer.send('title', title),
  onMenu: (handler) => {
    const subs = menuChannels.map((c) => {
      const fn = () => handler(c);
      ipcRenderer.on(`menu:${c}`, fn);
      return [c, fn];
    });
    return () => subs.forEach(([c, fn]) => ipcRenderer.removeListener(`menu:${c}`, fn));
  },
});
