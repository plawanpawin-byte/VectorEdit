import { createRequire } from 'node:module';
import { describe, expect, it, vi } from 'vitest';

const require = createRequire(import.meta.url);
const { TOOLS, createHandler, discoveryFile } = require('../electron/mcp-server.cjs');
const { safeDocName } = require('../electron/bridge.cjs');

const rpc = (method: string, params?: unknown, id: number | undefined = 1) => ({ jsonrpc: '2.0', id, method, params });

describe('MCP server', () => {
  it('answers initialize with its tools capability and echoes the protocol version', async () => {
    const handle = createHandler(vi.fn());
    const res = await handle(rpc('initialize', { protocolVersion: '2025-03-26', capabilities: {}, clientInfo: { name: 'x', version: '1' } }));
    expect(res.result.protocolVersion).toBe('2025-03-26');
    expect(res.result.capabilities).toEqual({ tools: {} });
    expect(res.result.serverInfo.name).toBe('lunatic-design');
  });

  it('does not answer notifications', async () => {
    const handle = createHandler(vi.fn());
    expect(await handle(rpc('notifications/initialized', undefined, undefined))).toBeNull();
  });

  it('lists every tool with a name, description and object schema', async () => {
    const handle = createHandler(vi.fn());
    const { result } = await handle(rpc('tools/list'));
    expect(result.tools.map((t: { name: string }) => t.name)).toEqual(TOOLS.map((t: { name: string }) => t.name));
    for (const t of result.tools) {
      expect(t.description.length).toBeGreaterThan(10);
      expect(t.inputSchema.type).toBe('object');
    }
    expect(result.tools.map((t: { name: string }) => t.name)).toEqual(expect.arrayContaining(['add_shape', 'add_shapes', 'update_shape', 'render_page', 'save_document', 'open_document']));
  });

  it('forwards a tool call to the app and returns its result as text', async () => {
    const call = vi.fn().mockResolvedValue({ id: 's7' });
    const handle = createHandler(call);
    const { result } = await handle(rpc('tools/call', { name: 'add_shape', arguments: { kind: 'rect', props: { w: 10 } } }));
    expect(call).toHaveBeenCalledWith('add_shape', { kind: 'rect', props: { w: 10 } });
    expect(JSON.parse(result.content[0].text)).toEqual({ id: 's7' });
    expect(result.isError).toBeUndefined();
  });

  it('returns pictures as image content', async () => {
    const handle = createHandler(vi.fn().mockResolvedValue({ mimeType: 'image/png', data: 'AAAA', width: 2, height: 3 }));
    const { result } = await handle(rpc('tools/call', { name: 'render_page', arguments: {} }));
    expect(result.content[0]).toEqual({ type: 'image', data: 'AAAA', mimeType: 'image/png' });
    expect(JSON.parse(result.content[1].text)).toEqual({ width: 2, height: 3 });
  });

  it('reports a failed call as a tool error the agent can read, not a protocol error', async () => {
    const handle = createHandler(vi.fn().mockRejectedValue(new Error('Lunatic Design is not running.')));
    const res = await handle(rpc('tools/call', { name: 'get_status', arguments: {} }));
    expect(res.error).toBeUndefined();
    expect(res.result.isError).toBe(true);
    expect(res.result.content[0].text).toContain('not running');
  });

  it('rejects unknown tools and methods, and malformed requests', async () => {
    const handle = createHandler(vi.fn());
    expect((await handle(rpc('tools/call', { name: 'nope' }))).error.code).toBe(-32602);
    expect((await handle(rpc('does/not/exist'))).error.code).toBe(-32601);
    expect((await handle({ id: 4 })).error.code).toBe(-32600);
    expect((await handle(null)).error.code).toBe(-32600);
  });

  it('looks for the bridge file in the app data folder, or where LUNATIC_MCP_FILE says', () => {
    expect(discoveryFile()).toMatch(/Lunatic Design[\\/]mcp\.json$/);
    process.env.LUNATIC_MCP_FILE = '/tmp/custom.json';
    expect(discoveryFile()).toBe('/tmp/custom.json');
    delete process.env.LUNATIC_MCP_FILE;
  });
});

describe('agent file names', () => {
  it('keeps agents inside the work folder', () => {
    expect(safeDocName('poster')).toBe('poster.vedit');
    expect(safeDocName('poster.vedit')).toBe('poster.vedit');
    expect(safeDocName('../../etc/passwd')).toBe('.._.._etc_passwd.vedit'.replace(/^\.+/, ''));
    expect(safeDocName('a/b\\c:d')).toBe('a_b_c_d.vedit');
    expect(() => safeDocName('')).toThrow();
    expect(() => safeDocName('...')).toThrow();
  });
});
