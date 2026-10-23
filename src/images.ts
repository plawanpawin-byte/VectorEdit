import { activeBoard, commit, getState, makeShape } from './store';

const MAX_EDGE = 2048;

export interface LoadedImage {
  src: string;
  w: number;
  h: number;
}

/** Read an image file, downscaling anything larger than MAX_EDGE so documents stay small. */
export function readImageFile(file: File): Promise<LoadedImage> {
  return new Promise((resolve, reject) => {
    if (!file.type.startsWith('image/')) return reject(new Error('Not an image'));
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      const scale = Math.min(1, MAX_EDGE / Math.max(img.naturalWidth, img.naturalHeight));
      const w = Math.max(1, Math.round(img.naturalWidth * scale));
      const h = Math.max(1, Math.round(img.naturalHeight * scale));
      const c = document.createElement('canvas');
      c.width = w;
      c.height = h;
      const ctx = c.getContext('2d');
      if (!ctx) return reject(new Error('No canvas'));
      ctx.drawImage(img, 0, 0, w, h);
      const lossless = file.type === 'image/png' || file.type === 'image/gif' || file.type === 'image/webp' || file.type === 'image/svg+xml';
      resolve({ src: lossless ? c.toDataURL('image/png') : c.toDataURL('image/jpeg', 0.9), w, h });
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('Could not decode the image'));
    };
    img.src = url;
  });
}

/** Ask the user for image files. */
export function pickImages(): Promise<File[]> {
  return new Promise((resolve) => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/*';
    input.multiple = true;
    input.onchange = () => resolve(Array.from(input.files ?? []));
    input.oncancel = () => resolve([]);
    input.click();
  });
}

/**
 * Put an image on the page. A selected empty picture frame receives it; otherwise it becomes a new
 * rectangle centred on `at` (or the active page), at most 80% of the page in either direction.
 */
export function placeImage(img: LoadedImage, at?: { x: number; y: number }) {
  const st = getState();
  const frame = st.shapes.find((s) => st.selection.includes(s.id) && s.frame && !s.locked);
  if (frame) {
    commit(st.shapes.map((s) => (s.id === frame.id ? { ...s, src: img.src } : s)));
    return;
  }
  const board = activeBoard(st);
  const k = Math.min(1, (board.w * 0.8) / img.w, (board.h * 0.8) / img.h);
  const w = Math.round(img.w * k);
  const h = Math.round(img.h * k);
  const cx = at?.x ?? board.x + board.w / 2;
  const cy = at?.y ?? board.y + board.h / 2;
  const shape = makeShape('rect', { name: 'Image', x: cx - w / 2, y: cy - h / 2, w, h, src: img.src, fill: null, stroke: null });
  commit([...st.shapes, shape], { selection: [shape.id] });
}

export async function placeFiles(files: File[], at?: { x: number; y: number }) {
  for (const f of files) {
    try {
      placeImage(await readImageFile(f), at);
    } catch (e) {
      alert(`Skipped ${f.name}: ${(e as Error).message}`);
    }
  }
}

/** Set the image of a specific shape (used by the Image section of the Appearance panel). */
export function placeImageInto(id: string, img: LoadedImage) {
  const st = getState();
  commit(st.shapes.map((s) => (s.id === id ? { ...s, src: img.src } : s)));
}

/** Pick a file and put it into the given shape; reports problems instead of throwing. */
export async function chooseImageInto(id: string) {
  const [file] = await pickImages();
  if (!file) return;
  try {
    placeImageInto(id, await readImageFile(file));
  } catch (e) {
    alert(`Could not use that image.\n${(e as Error).message}`);
  }
}
