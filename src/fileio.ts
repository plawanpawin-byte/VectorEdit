import { parseDoc, serializeDoc } from './document';
import { download } from './components/exporter';
import { getState, loadDocument, setState } from './store';

interface DesktopApi {
  openFile(): Promise<{ path: string; text: string } | null>;
  saveFile(p: { path: string | null; text: string; saveAs: boolean }): Promise<{ path: string } | null>;
  exportFile(p: { name: string; ext: string; data: Uint8Array }): Promise<{ path: string } | null>;
  setTitle(title: string): void;
  onMenu(handler: (channel: string) => void): () => void;
}

declare global {
  interface Window {
    desktop?: DesktopApi;
  }
}

export const isDesktop = () => !!window.desktop;

const serialize = () => serializeDoc(getState());

function load(text: string, path: string | null) {
  const d = parseDoc(text);
  loadDocument(d.shapes, d.artboards, path, { guides: d.guides, snapshots: d.snapshots });
}

export async function openDoc() {
  try {
    if (window.desktop) {
      const r = await window.desktop.openFile();
      if (r) load(r.text, r.path);
      return;
    }
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.vedit,application/json';
    input.onchange = async () => {
      const f = input.files?.[0];
      if (f) load(await f.text(), null);
    };
    input.click();
  } catch (e) {
    alert(`Could not open the file.\n${(e as Error).message}`);
  }
}

export async function saveDoc(saveAs = false) {
  const text = serialize();
  if (window.desktop) {
    const r = await window.desktop.saveFile({ path: getState().filePath, text, saveAs });
    if (r) setState({ filePath: r.path });
    return;
  }
  download(new Blob([text], { type: 'application/json' }), 'Untitled.vedit');
}
