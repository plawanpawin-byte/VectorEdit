import { parseDoc, serializeDoc } from './document';
import { download } from './components/exporter';
import { preloadRasters } from './raster/cache';
import { translate } from './geometry';
import { activeBoard, commit, confirmDiscard, getState, loadDocument, makeShape, markClean, setState } from './store';
import { importSvg } from './svgimport';
import { normalizeShape } from './shape';
import type { Shape } from './types';

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

/** Open a document from its text (used for files dropped on the window). */
export const openDocText = (text: string) => load(text, null).catch((e) => alert(`Could not open the file.\n${(e as Error).message}`));

async function load(text: string, path: string | null) {
  const d = parseDoc(text);
  // decode pixel layers first so painting can start the moment the document appears
  await preloadRasters(d.shapes.map(normalizeShape).filter((x): x is Shape => x !== null));
  loadDocument(d.shapes, d.artboards, path, { guides: d.guides, slices: d.slices, snapshots: d.snapshots });
}

export async function openDoc() {
  try {
    if (window.desktop) {
      if (!confirmDiscard()) return;
      const r = await window.desktop.openFile();
      if (r) await load(r.text, r.path);
      return;
    }
    if (!confirmDiscard()) return;
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.vedit,application/json';
    input.onchange = async () => {
      const f = input.files?.[0];
      if (f) await load(await f.text(), null).catch((e) => alert(`Could not open the file.\n${(e as Error).message}`));
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
    if (r) {
      setState({ filePath: r.path });
      markClean();
    }
    return;
  }
  download(new Blob([text], { type: 'application/json' }), 'Untitled.vedit');
  markClean();
}

/** Add the shapes of an SVG file to the active page, centred on it. */
export function importSvgText(text: string): { count: number; skipped: string[] } | null {
  const result = importSvg(text);
  if (!result || !result.shapes.length) return null;
  const st = getState();
  const board = activeBoard(st);
  const dx = board.x + (board.w - result.width) / 2;
  const dy = board.y + (board.h - result.height) / 2;
  const shapes = result.shapes.map((s) => ({ ...translate(s, dx, dy), id: makeShape(s.kind).id }));
  commit([...st.shapes, ...shapes], { selection: shapes.map((s) => s.id) });
  return { count: shapes.length, skipped: result.skipped };
}

export function importSvgFile() {
  const input = document.createElement('input');
  input.type = 'file';
  input.accept = '.svg,image/svg+xml';
  input.onchange = async () => {
    const f = input.files?.[0];
    if (!f) return;
    const r = importSvgText(await f.text());
    if (!r) alert('That file has no shapes VectorEdit can import.');
    else if (r.skipped.length) alert(`Imported ${r.count} shapes. Not imported: ${r.skipped.join(', ')} (text, images, gradients and filters are not supported yet).`);
  };
  input.click();
}
