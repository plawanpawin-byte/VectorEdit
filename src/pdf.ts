/** A minimal PDF writer: one page per image, each page sized in CSS pixels (72/96 points per pixel). */

export interface PdfImagePage {
  /** page size in CSS pixels */
  width: number;
  height: number;
  /** JPEG bytes and their pixel size */
  jpeg: Uint8Array;
  pxWidth: number;
  pxHeight: number;
}

/** A page drawn with vector operators; `alphas` lists the opacity values the content refers to as /GS0, /GS1… */
export interface PdfVectorPage {
  width: number;
  height: number;
  content: string;
  alphas: number[];
}

export type PdfPage = PdfImagePage | PdfVectorPage;

const isVector = (p: PdfPage): p is PdfVectorPage => 'content' in p;

const enc = new TextEncoder();
const PT = 0.75;

export function buildPdf(pages: PdfPage[], title = 'lunaticDesign export'): Uint8Array {
  const chunks: Uint8Array[] = [];
  const offsets: number[] = [];
  let length = 0;
  const push = (b: Uint8Array | string) => {
    const bytes = typeof b === 'string' ? enc.encode(b) : b;
    chunks.push(bytes);
    length += bytes.length;
  };
  const obj = (n: number, body: string | (Uint8Array | string)[]) => {
    offsets[n] = length;
    push(`${n} 0 obj\n`);
    for (const part of Array.isArray(body) ? body : [body]) push(part);
    push('\nendobj\n');
  };
  push('%PDF-1.4\n%\xE2\xE3\xCF\xD3\n');
  // object numbers: 1 catalog, 2 pages, 3 info, then 3 per page (page, content, image)
  const kids = pages.map((_, i) => `${4 + i * 3} 0 R`).join(' ');
  obj(1, '<< /Type /Catalog /Pages 2 0 R >>');
  obj(2, `<< /Type /Pages /Kids [${kids}] /Count ${pages.length} >>`);
  obj(3, `<< /Title (${title.replace(/[()\\]/g, '')}) /Producer (lunaticDesign) >>`);
  pages.forEach((p, i) => {
    const page = 4 + i * 3;
    const w = +(p.width * PT).toFixed(2);
    const h = +(p.height * PT).toFixed(2);
    if (isVector(p)) {
      const gs = p.alphas.map((a, k) => `/GS${k} << /ca ${a} /CA ${a} >>`).join(' ');
      obj(page, `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${w} ${h}] /Resources << /ExtGState << ${gs} >> >> /Contents ${page + 1} 0 R >>`);
      obj(page + 1, `<< /Length ${enc.encode(p.content).length} >>\nstream\n${p.content}\nendstream`);
      obj(page + 2, '<< >>'); // unused slot keeps object numbering uniform
      return;
    }
    obj(page, `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${w} ${h}] /Resources << /XObject << /Im0 ${page + 2} 0 R >> >> /Contents ${page + 1} 0 R >>`);
    const content = `q ${w} 0 0 ${h} 0 0 cm /Im0 Do Q`;
    obj(page + 1, `<< /Length ${content.length} >>\nstream\n${content}\nendstream`);
    obj(page + 2, [`<< /Type /XObject /Subtype /Image /Width ${p.pxWidth} /Height ${p.pxHeight} /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ${p.jpeg.length} >>\nstream\n`, p.jpeg, '\nendstream']);
  });
  const total = 4 + pages.length * 3;
  const xref = length;
  push(`xref\n0 ${total}\n0000000000 65535 f \n`);
  for (let n = 1; n < total; n++) push(`${String(offsets[n]).padStart(10, '0')} 00000 n \n`);
  push(`trailer\n<< /Size ${total} /Root 1 0 R /Info 3 0 R >>\nstartxref\n${xref}\n%%EOF\n`);
  const out = new Uint8Array(length);
  let at = 0;
  for (const c of chunks) (out.set(c, at), (at += c.length));
  return out;
}
