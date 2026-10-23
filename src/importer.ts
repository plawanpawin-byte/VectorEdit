import { importSvgText } from './fileio';
import { placeImage, readImageFile } from './images';
import { activeBoard, getState } from './store';

const RASTER: Record<string, string> = {
  png: 'image/png',
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  jpe: 'image/jpeg',
  gif: 'image/gif',
  webp: 'image/webp',
  bmp: 'image/bmp',
  avif: 'image/avif',
  ico: 'image/x-icon',
};

export const ACCEPT = '.png,.jpg,.jpeg,.gif,.webp,.bmp,.avif,.ico,.svg,image/*';

const extOf = (name: string) => /\.([a-z0-9]+)$/i.exec(name)?.[1].toLowerCase() ?? '';

export type Kind = 'svg' | 'raster' | 'other';

/** What a file is, going by its type first and then its extension (dropped files often have no type). */
export function kindOf(name: string, type: string): Kind {
  if (type === 'image/svg+xml' || extOf(name) === 'svg') return 'svg';
  if (type.startsWith('image/') || extOf(name) in RASTER) return 'raster';
  return 'other';
}

/** Give a file without a MIME type the one its extension implies, so the browser can decode it. */
export function typed(file: File): File {
  if (file.type.startsWith('image/')) return file;
  const mime = RASTER[extOf(file.name)];
  return mime ? new File([file], file.name, { type: mime }) : file;
}

export interface ImportReport {
  placed: number;
  vectors: number;
  failed: { name: string; reason: string }[];
  notes: string[];
}

/**
 * Bring image and SVG files into the document. SVG files become editable shapes; pictures become
 * image rectangles. Several files are fanned out so none hides another. Nothing here throws: a file
 * that cannot be read is listed in the report so the rest still import.
 */
export async function importFiles(files: File[], at?: { x: number; y: number }): Promise<ImportReport> {
  const report: ImportReport = { placed: 0, vectors: 0, failed: [], notes: [] };
  const board = activeBoard(getState());
  const base = at ?? { x: board.x + board.w / 2, y: board.y + board.h / 2 };
  let i = 0;
  for (const file of files) {
    const kind = kindOf(file.name, file.type);
    if (kind === 'other') {
      report.failed.push({ name: file.name, reason: 'Unsupported file type' });
      continue;
    }
    const spot = { x: base.x + i * 24, y: base.y + i * 24 };
    try {
      if (kind === 'svg') {
        const result = importSvgText(await file.text());
        if (result) {
          report.vectors += result.count;
          report.placed++;
          if (result.skipped.length) report.notes.push(`${file.name}: not imported — ${result.skipped.join(', ')}`);
          i++;
          continue;
        }
        // an SVG with nothing we can draw as shapes is still placed as a picture
      }
      placeImage(await readImageFile(typed(file)), spot);
      report.placed++;
      i++;
    } catch (e) {
      report.failed.push({ name: file.name, reason: (e as Error).message });
    }
  }
  return report;
}

/** Show what an import did when something needs the user's attention. */
export function reportImport(r: ImportReport) {
  const lines = [...r.failed.map((f) => `Skipped ${f.name}: ${f.reason}`), ...r.notes];
  if (lines.length) alert(lines.join('\n'));
}

export function pickFiles(): Promise<File[]> {
  return new Promise((resolve) => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = ACCEPT;
    input.multiple = true;
    input.onchange = () => resolve(Array.from(input.files ?? []));
    input.addEventListener('cancel', () => resolve([]));
    input.click();
  });
}

/** File → Import: choose images and SVG files and place them on the page. */
export async function importFilesDialog() {
  const files = await pickFiles();
  if (files.length) reportImport(await importFiles(files));
}

/** True when the text on the clipboard is an SVG document. */
export const looksLikeSvg = (text: string) => /^\s*(<\?xml[^>]*>\s*)?(<!--[\s\S]*?-->\s*)?(<!doctype[^>]*>\s*)?<svg[\s>]/i.test(text);
