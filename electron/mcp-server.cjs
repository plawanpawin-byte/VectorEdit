'use strict';
// MCP (Model Context Protocol) server for Lunatic Design. It speaks JSON-RPC over stdin/stdout and forwards every tool
// call to the running desktop app through a local bridge. No dependencies, so the app's own executable can run it:
//   "Lunatic Design.exe" --mcp
// or, from a source checkout:  node electron/mcp-server.cjs
const fs = require('node:fs');
const http = require('node:http');
const os = require('node:os');
const path = require('node:path');

const FOLDER = 'Lunatic Design';
const DEFAULT_PROTOCOL = '2025-06-18';

function version() {
  try {
    return require('../package.json').version;
  } catch {
    return '0.0.0';
  }
}

/** Where the running app publishes its port and token (the same folder Electron uses for the app's data). */
function discoveryFile() {
  if (process.env.LUNATIC_MCP_FILE) return process.env.LUNATIC_MCP_FILE;
  const home = os.homedir();
  const base =
    process.platform === 'win32'
      ? process.env.APPDATA || path.join(home, 'AppData', 'Roaming')
      : process.platform === 'darwin'
        ? path.join(home, 'Library', 'Application Support')
        : process.env.XDG_CONFIG_HOME || path.join(home, '.config');
  return path.join(base, FOLDER, 'mcp.json');
}

const NOT_RUNNING = 'Lunatic Design is not running. Open the app, then try again.';

function readBridge(file = discoveryFile()) {
  let info;
  try {
    info = JSON.parse(fs.readFileSync(file, 'utf8'));
  } catch {
    throw new Error(NOT_RUNNING);
  }
  if (!info || !Number.isInteger(info.port) || typeof info.token !== 'string') throw new Error(NOT_RUNNING);
  return info;
}

/** One call to the app. Rejects with a readable message. */
function callBridge(method, params, file) {
  return new Promise((resolve, reject) => {
    let info;
    try {
      info = readBridge(file);
    } catch (e) {
      return reject(e);
    }
    const body = JSON.stringify({ method, params: params ?? {} });
    const req = http.request(
      { host: '127.0.0.1', port: info.port, path: '/rpc', method: 'POST', timeout: 60000, headers: { 'content-type': 'application/json', 'content-length': Buffer.byteLength(body), authorization: `Bearer ${info.token}` } },
      (res) => {
        const chunks = [];
        res.on('data', (c) => chunks.push(c));
        res.on('end', () => {
          let out;
          try {
            out = JSON.parse(Buffer.concat(chunks).toString('utf8'));
          } catch {
            return reject(new Error(`The app answered with something unexpected (HTTP ${res.statusCode}).`));
          }
          if (out.error) return reject(new Error(String(out.error)));
          resolve(out.result);
        });
      },
    );
    req.on('timeout', () => req.destroy(new Error('The app did not answer in time.')));
    req.on('error', (e) => reject(e.code === 'ECONNREFUSED' ? new Error(NOT_RUNNING) : e));
    req.end(body);
  });
}

const num = (description) => ({ type: 'number', description });
const str = (description) => ({ type: 'string', description });

const PROPS_HELP =
  'Shape properties. Position and size: x, y, w, h (pixels). Look: fill and stroke (CSS colours like "#0f766e", or null for none), strokeWidth, opacity (0 to 1), ' +
  'gradient {type: "linear"|"radial", a, b, angle}, effects [{type: "glow"|"shadow"|"blur", enabled: true, color, opacity, blur, dx, dy}], radius (rect corner). ' +
  'Text: text, fontSize, fontFamily, fontWeight (400 or 700), italic, align ("left"|"center"|"right"|"justify"), letterSpacing, lineHeight, frameW (wrap width; 0 = no wrap). ' +
  'Parametric shapes (kind "shape"): shapeId such as "star", "heart", "cog", "spiral", "cloud". Paths (kind "path"): closed and pts [{x, y, hx, hy}] (hx, hy are curve handles; 0 for straight corners). name labels the layer.';

const TOOLS = [
  { name: 'get_status', description: 'Which workspace is open, the pages, how many shapes there are, the selection, and whether undo or redo is available.', inputSchema: { type: 'object', properties: {} }, method: 'status' },
  { name: 'get_document', description: 'List the pages and every shape (id, kind, name, position, size, colours, text) of the open document.', inputSchema: { type: 'object', properties: {} }, method: 'get_document' },
  {
    name: 'new_document',
    description: 'Replace the open document with an empty page of the given size in pixels. Refuses when the open document has unsaved changes: ask the user first, then repeat with discardUnsaved: true, or save it with save_document.',
    inputSchema: { type: 'object', properties: { width: num('Page width in px (1 to 16000)'), height: num('Page height in px (1 to 16000)'), name: str('Page name'), discardUnsaved: { type: 'boolean', description: 'Only true after the user agreed to lose unsaved changes' } }, required: ['width', 'height'] },
    method: 'new_document',
  },
  {
    name: 'add_shape',
    description: 'Add one shape to the active page. Returns its id. One undo removes it.',
    inputSchema: { type: 'object', properties: { kind: { type: 'string', enum: ['rect', 'ellipse', 'shape', 'line', 'path', 'text'] }, props: { type: 'object', description: PROPS_HELP } }, required: ['kind'] },
    method: 'add_shape',
  },
  {
    name: 'add_shapes',
    description: 'Add many shapes in one step (up to 200). Order matters: later shapes are drawn on top. A single undo removes the whole batch.',
    inputSchema: { type: 'object', properties: { shapes: { type: 'array', items: { type: 'object', properties: { kind: { type: 'string', enum: ['rect', 'ellipse', 'shape', 'line', 'path', 'text'] }, props: { type: 'object', description: PROPS_HELP } }, required: ['kind'] } } }, required: ['shapes'] },
    method: 'add_shapes',
  },
  {
    name: 'update_shape',
    description: 'Change properties of one shape by id (see get_document for ids).',
    inputSchema: { type: 'object', properties: { id: str('Shape id'), props: { type: 'object', description: PROPS_HELP } }, required: ['id', 'props'] },
    method: 'update_shape',
  },
  { name: 'delete_shapes', description: 'Delete shapes by id.', inputSchema: { type: 'object', properties: { ids: { type: 'array', items: { type: 'string' } } }, required: ['ids'] }, method: 'delete_shapes' },
  { name: 'select_shapes', description: 'Select shapes by id so the user sees them highlighted.', inputSchema: { type: 'object', properties: { ids: { type: 'array', items: { type: 'string' } } }, required: ['ids'] }, method: 'select' },
  { name: 'undo', description: 'Undo the last change.', inputSchema: { type: 'object', properties: {} }, method: 'undo' },
  { name: 'redo', description: 'Redo the change that was undone.', inputSchema: { type: 'object', properties: {} }, method: 'redo' },
  {
    name: 'render_page',
    description: 'Render the active page as a PNG image so you can see the result of your edits.',
    inputSchema: { type: 'object', properties: { scale: num('Pixels per document pixel, 0.1 to 4 (default 1)') } },
    method: 'export_png',
    image: true,
  },
  { name: 'screenshot', description: 'Capture the whole app window as a PNG, including panels and tools.', inputSchema: { type: 'object', properties: {} }, method: 'screenshot', image: true },
  { name: 'list_documents', description: 'List the .vedit documents in Documents/Lunatic Design.', inputSchema: { type: 'object', properties: {} }, method: 'list_documents' },
  {
    name: 'save_document',
    description: 'Save the open document as name.vedit inside Documents/Lunatic Design (the folder is the only place agents can write).',
    inputSchema: { type: 'object', properties: { name: str('File name without folders, for example "poster"') }, required: ['name'] },
    method: 'save_document',
  },
  {
    name: 'open_document',
    description: 'Open name.vedit from Documents/Lunatic Design, replacing the open document. Refuses when the open document has unsaved changes: ask the user first, then repeat with discardUnsaved: true.',
    inputSchema: { type: 'object', properties: { name: str('File name without folders'), discardUnsaved: { type: 'boolean', description: 'Only true after the user agreed to lose unsaved changes' } }, required: ['name'] },
    method: 'open_document',
  },
];

/** The request handler, separated from the stdio plumbing so it can be tested. */
function createHandler(call = callBridge) {
  const byName = new Map(TOOLS.map((t) => [t.name, t]));
  const ok = (id, result) => ({ jsonrpc: '2.0', id, result });
  const fail = (id, code, message) => ({ jsonrpc: '2.0', id, error: { code, message } });

  return async function handle(msg) {
    if (!msg || typeof msg !== 'object' || msg.jsonrpc !== '2.0') return fail(msg && msg.id !== undefined ? msg.id : null, -32600, 'Invalid request');
    const { id, method, params } = msg;
    const isNotification = id === undefined;
    if (typeof method !== 'string') return isNotification ? null : fail(id, -32600, 'Invalid request');
    if (method.startsWith('notifications/')) return null;
    switch (method) {
      case 'initialize':
        return ok(id, { protocolVersion: (params && params.protocolVersion) || DEFAULT_PROTOCOL, capabilities: { tools: {} }, serverInfo: { name: 'lunatic-design', version: version() }, instructions: 'Edits the document open in Lunatic Design. Call get_status first; use render_page to look at the result.' });
      case 'ping':
        return ok(id, {});
      case 'tools/list':
        return ok(id, { tools: TOOLS.map(({ name, description, inputSchema }) => ({ name, description, inputSchema })) });
      case 'tools/call': {
        const tool = params && byName.get(params.name);
        if (!tool) return fail(id, -32602, `Unknown tool ${params && params.name}`);
        try {
          const out = await call(tool.method, params.arguments || {});
          if (tool.image && out && out.data) {
            const { data, mimeType, ...info } = out;
            return ok(id, { content: [{ type: 'image', data, mimeType }, { type: 'text', text: JSON.stringify(info) }] });
          }
          return ok(id, { content: [{ type: 'text', text: JSON.stringify(out, null, 2) }] });
        } catch (e) {
          return ok(id, { content: [{ type: 'text', text: String(e && e.message ? e.message : e) }], isError: true });
        }
      }
      default:
        return isNotification ? null : fail(id, -32601, `Method not found: ${method}`);
    }
  };
}

/** Read newline-delimited JSON-RPC from stdin and answer on stdout until stdin closes. */
function runStdio(input = process.stdin, output = process.stdout) {
  const handle = createHandler();
  let buffer = '';
  const pending = new Set();
  input.setEncoding('utf8');
  input.on('data', (chunk) => {
    buffer += chunk;
    let at;
    while ((at = buffer.indexOf('\n')) >= 0) {
      const line = buffer.slice(0, at).trim();
      buffer = buffer.slice(at + 1);
      if (!line) continue;
      let msg;
      try {
        msg = JSON.parse(line);
      } catch {
        output.write(JSON.stringify({ jsonrpc: '2.0', id: null, error: { code: -32700, message: 'Parse error' } }) + '\n');
        continue;
      }
      const job = handle(msg).then((res) => res && output.write(JSON.stringify(res) + '\n'));
      pending.add(job);
      void job.finally(() => pending.delete(job));
    }
  });
  // a client that closes stdin right after its last request still gets the answers
  input.on('end', () => void Promise.allSettled(pending).then(() => process.exit(0)));
}

module.exports = { TOOLS, createHandler, runStdio, discoveryFile, readBridge, callBridge };

if (require.main === module) runStdio();
