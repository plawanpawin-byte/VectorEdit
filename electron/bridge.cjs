'use strict';
// A small HTTP server on 127.0.0.1 that lets the MCP server (electron/mcp-server.cjs) drive the open document.
// It is private to this computer: it listens on the loopback address only, every request needs a random token that is
// written to a file in the user's own app-data folder, and requests that look like they come from a web page are refused.
const crypto = require('node:crypto');
const fs = require('node:fs/promises');
const http = require('node:http');
const path = require('node:path');

const MAX_BODY = 8 * 1024 * 1024;

/** A file name an agent may use inside the work folder: no folders, no odd characters, always .vedit. */
function safeDocName(name) {
  const base = String(name ?? '')
    .replace(/\.vedit$/i, '')
    .replace(/[\\/:*?"<>|\u0000-\u001f]+/g, '_')
    .replace(/^[.\s]+|[.\s]+$/g, '')
    .slice(0, 80);
  if (!base) throw new Error('Give the document a name, for example "poster".');
  return `${base}.vedit`;
}

function startBridge({ getWindow, userDataDir, workFolder, onFile }) {
  const token = crypto.randomBytes(24).toString('hex');
  const tokenBuf = Buffer.from(token);
  const file = path.join(userDataDir, 'mcp.json');
  let port = 0;

  const page = (method, params) => {
    const win = getWindow();
    if (!win || win.isDestroyed()) throw new Error('The editor window is not open.');
    return win.webContents.executeJavaScript(`window.__lunaticApi ? window.__lunaticApi.call(${JSON.stringify(method)}, ${JSON.stringify(params ?? {})}) : Promise.reject(new Error('The editor is still starting.'))`, true);
  };

  const methods = {
    async screenshot() {
      const win = getWindow();
      if (!win || win.isDestroyed()) throw new Error('The editor window is not open.');
      const img = await win.webContents.capturePage();
      const { width, height } = img.getSize();
      return { mimeType: 'image/png', data: img.toPNG().toString('base64'), width, height };
    },
    async list_documents() {
      await fs.mkdir(workFolder(), { recursive: true });
      const out = [];
      for (const f of await fs.readdir(workFolder())) {
        if (!/\.vedit$/i.test(f)) continue;
        const st = await fs.stat(path.join(workFolder(), f));
        out.push({ name: f, bytes: st.size, modified: st.mtime.toISOString() });
      }
      return { folder: workFolder(), documents: out };
    },
    async save_document(params) {
      const target = path.join(workFolder(), safeDocName(params.name));
      const { text } = await page('get_file_text', {});
      await fs.mkdir(workFolder(), { recursive: true });
      await fs.writeFile(target, text, 'utf8');
      await page('mark_clean', {});
      onFile?.(target);
      return { path: target };
    },
    async open_document(params) {
      const target = path.join(workFolder(), safeDocName(params.name));
      let text;
      try {
        text = await fs.readFile(target, 'utf8');
      } catch {
        throw new Error(`There is no ${path.basename(target)} in ${workFolder()}.`);
      }
      await page('load_file_text', { text, path: target, discardUnsaved: params.discardUnsaved === true });
      onFile?.(target);
      return { path: target };
    },
  };

  const server = http.createServer((req, res) => {
    const reply = (code, body) => {
      res.writeHead(code, { 'content-type': 'application/json' });
      res.end(JSON.stringify(body));
    };
    const host = String(req.headers.host ?? '');
    // a web page on another origin, or a DNS-rebinding trick, must not be able to talk to the editor
    if (req.headers.origin || !(host === `127.0.0.1:${port}` || host === `localhost:${port}`)) return reply(403, { error: 'Forbidden' });
    const given = Buffer.from(String(req.headers.authorization ?? '').replace(/^Bearer /, ''));
    if (given.length !== tokenBuf.length || !crypto.timingSafeEqual(given, tokenBuf)) return reply(401, { error: 'Unauthorized' });
    if (req.method !== 'POST' || req.url !== '/rpc') return reply(404, { error: 'Not found' });
    const chunks = [];
    let size = 0;
    req.on('data', (c) => {
      size += c.length;
      if (size > MAX_BODY) req.destroy();
      else chunks.push(c);
    });
    req.on('end', async () => {
      let msg;
      try {
        msg = JSON.parse(Buffer.concat(chunks).toString('utf8'));
      } catch {
        return reply(400, { error: 'Bad request' });
      }
      try {
        const run = methods[msg.method];
        const result = run ? await run(msg.params ?? {}) : await page(String(msg.method), msg.params ?? {});
        reply(200, { result: result ?? null });
      } catch (e) {
        reply(200, { error: String(e && e.message ? e.message : e).replace(/^Error invoking remote method[^:]*: (Error: )?/, '') });
      }
    });
  });

  return new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(0, '127.0.0.1', async () => {
      port = server.address().port;
      await fs.mkdir(userDataDir, { recursive: true });
      await fs.writeFile(file, JSON.stringify({ port, token, pid: process.pid }), { encoding: 'utf8', mode: 0o600 });
      resolve({
        port,
        file,
        close: async () => {
          server.close();
          await fs.rm(file, { force: true }).catch(() => {});
        },
      });
    });
  });
}

module.exports = { startBridge, safeDocName };
