import { parseDoc, serializeDoc } from './document';
import { download } from './components/exporter';
import { preloadRasters } from './raster/cache';
import { translate } from './geometry';
import { activeBoard, commit, confirmDiscard, getState, loadDocument, makeShape, markClean, newDocument, notify, setState } from './store';
import { importSvg } from './svgimport';
import { readImageFile } from './images';
import { ACCEPT, importFiles, kindOf, reportImport, typed } from './importer';
import { normalizeShape } from './shape';
import type { Shape } from './types';

/** One file picked in Open: a document arrives as text, a picture as bytes. */
export interface OpenedFile {
  path: string | null;
  name: string;
  text?: string;
  bytes?: Uint8Array;
}

interface DesktopApi {
  openFile(): Promise<OpenedFile[] | null>;
  saveFile(p: { path: string | null; text: string; saveAs: boolean }): Promise<{ path: string } | null>;
  exportFile(p: { name: string; ext: string; data: Uint8Array }): Promise<{ path: string } | null>;
  setTitle(title: string): void;
  onMenu(handler: (channel: string) => void): () => void;
  takePendingFile(): Promise<{ path: string; text: string } | null>;
  recentFiles(): Promise<{ path: string; name: string; dir: string }[]>;
  openRecent(path: string): Promise<{ path: string; text: string } | null>;
  removeRecent(path: string): Promise<void>;
  agentInfo(): Promise<{ command: string; args: string[]; workFolder: string; running: boolean }>;
  onOpenFile(handler: (file: { path: string; text: string }) => void): () => void;
}

declare global {
  interface Window {
    desktop?: DesktopApi;
  }
}

export const isDesktop = () => !!window.desktop;

const serialize = () => serializeDoc(getState());

/** Open a document from its text (used for files dropped on the window). */
export const openDocText = (text: string, path: string | null = null) => load(text, path).catch((e) => alert(`Could not open the file.\n${(e as Error).message}`));

async function load(text: string, path: string | null) {
  const d = parseDoc(text);
  // decode pixel layers first so painting can start the moment the document appears
  await preloadRasters(d.shapes.map(normalizeShape).filter((x): x is Shape => x !== null));
  loadDocument(d.shapes, d.artboards, path, { guides: d.guides, slices: d.slices, snapshots: d.snapshots });
}

/** Open documents and pictures chosen by the user. Pictures start a new page sized to the first one. */
export async function openFiles(files: File[]) {
  const docs = files.filter((f) => f.name.toLowerCase().endsWith('.vedit'));
  if (docs.length === 1 && files.length === 1) return load(await docs[0].text(), null).catch((e) => alert(`Could not open the file.\n${(e as Error).message}`));
  const pictures = files.filter((f) => kindOf(f.name, f.type) !== 'other');
  if (!pictures.length) return alert('Choose a lunaticDesign document, or a PNG, JPG, GIF, WebP, BMP, AVIF, ICO or SVG image.');
  const size = await pageSizeFor(pictures[0]);
  newDocument({ ...size, name: pictures[0].name.replace(/\.[^.]+$/, '') || 'Page 1' });
  await importFiles(pictures).then(reportImport);
}

/** Pixel size of a picture, so the new page fits it. */
async function pageSizeFor(file: File): Promise<{ w: number; h: number }> {
  if (kindOf(file.name, file.type) === 'svg') {
    const svg = importSvg(await file.text());
    if (svg && svg.width > 0 && svg.height > 0) return { w: Math.round(svg.width), h: Math.round(svg.height) };
    return { w: 800, h: 600 };
  }
  const img = await readImageFile(typed(file));
  return { w: img.w, h: img.h };
}

export async function openDoc() {
  try {
    if (!confirmDiscard()) return;
    if (window.desktop) {
      const picked = await window.desktop.openFile();
      if (!picked?.length) return;
      if (picked.length === 1 && picked[0].text !== undefined) return load(picked[0].text, picked[0].path).catch((e) => alert(`Could not open the file.\n${(e as Error).message}`));
      await openFiles(picked.map((f) => new File([(f.bytes ?? new Uint8Array(0)) as unknown as BlobPart], f.name)));
      return;
    }
    const input = document.createElement('input');
    input.type = 'file';
    input.multiple = true;
    input.accept = `.vedit,application/json,${ACCEPT}`;
    input.onchange = () => {
      const files = Array.from(input.files ?? []);
      if (files.length) void openFiles(files);
    };
    input.click();
  } catch (e) {
    alert(`Could not open the file.\n${(e as Error).message}`);
  }
}

/** Open one of the recently used files listed on the start page (desktop only). */
export async function openRecent(file: string) {
  if (!window.desktop || !confirmDiscard()) return;
  const r = await window.desktop.openRecent(file);
  if (!r) return notify('That file is no longer available.');
  await load(r.text, r.path).catch((e) => alert(`Could not open the file.\n${(e as Error).message}`));
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
