import { createRequire } from 'node:module';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

const require = createRequire(import.meta.url);
const { installMcp, mergeJson, mergeToml } = require('../electron/install-mcp.cjs');

const entry = { command: 'C:\\Program Files\\Lunatic Design\\Lunatic Design.exe', args: ['--mcp'] };
let home: string;
beforeEach(() => {
  home = fs.mkdtempSync(path.join(os.tmpdir(), 'lunatic-install-'));
});
afterEach(() => fs.rmSync(home, { recursive: true, force: true }));

describe('mergeJson', () => {
  it('adds the server and keeps other servers and settings', () => {
    const before = JSON.stringify({ numStartups: 4, mcpServers: { other: { command: 'npx', args: ['x'] } } });
    const out = JSON.parse(mergeJson(before, entry));
    expect(out.numStartups).toBe(4);
    expect(out.mcpServers.other).toEqual({ command: 'npx', args: ['x'] });
    expect(out.mcpServers['lunatic-design']).toEqual(entry);
  });

  it('replaces an older lunatic-design entry instead of duplicating it', () => {
    const out = JSON.parse(mergeJson(JSON.stringify({ mcpServers: { 'lunatic-design': { command: 'old', args: [] } } }), entry));
    expect(out.mcpServers['lunatic-design']).toEqual(entry);
  });

  it('creates a fresh file from nothing', () => {
    expect(JSON.parse(mergeJson('', entry)).mcpServers['lunatic-design']).toEqual(entry);
  });

  it('refuses to touch a file it cannot read', () => {
    expect(() => mergeJson('{ broken', entry)).toThrow();
    expect(() => mergeJson('[1,2]', entry)).toThrow();
  });
});

describe('mergeToml', () => {
  it('appends the table to an existing Codex config and keeps the rest', () => {
    const before = 'model = "gpt-5"\n\n[mcp_servers.context7]\ncommand = "npx"\nargs = ["-y", "x"]\n';
    const out = mergeToml(before, entry);
    expect(out).toContain('model = "gpt-5"');
    expect(out).toContain('[mcp_servers.context7]');
    expect(out).toContain('[mcp_servers.lunatic-design]');
    expect(out).toContain('command = "C:\\\\Program Files\\\\Lunatic Design\\\\Lunatic Design.exe"');
    expect(out).toContain('args = ["--mcp"]');
  });

  it('replaces only its own table when run again', () => {
    const once = mergeToml('[mcp_servers.other]\ncommand = "a"\n', entry);
    const twice = mergeToml(once, { command: '/new/app', args: ['--mcp'] });
    expect(twice.match(/\[mcp_servers\.lunatic-design\]/g)).toHaveLength(1);
    expect(twice).toContain('[mcp_servers.other]');
    expect(twice).toContain('command = "/new/app"');
    expect(twice).not.toContain('Program Files');
  });
});

describe('installMcp', () => {
  it('writes Claude Code and Codex when they are installed, and skips the rest', async () => {
    fs.mkdirSync(path.join(home, '.codex'));
    const report = await installMcp({ home, entry });
    const by = (agent: string) => report.filter((r: { agent: string }) => r.agent === agent);
    expect(by('Claude Code')[0].status).toBe('written');
    expect(by('Codex')[0].status).toBe('written');
    expect(JSON.parse(fs.readFileSync(path.join(home, '.claude.json'), 'utf8')).mcpServers['lunatic-design']).toEqual(entry);
    expect(fs.readFileSync(path.join(home, '.codex', 'config.toml'), 'utf8')).toContain('[mcp_servers.lunatic-design]');
    // Antigravity has no folder here, so nothing is created for it
    expect(by('Antigravity').every((r: { status: string }) => r.status === 'skipped')).toBe(true);
    expect(fs.existsSync(path.join(home, '.gemini'))).toBe(false);
  });

  it('writes Antigravity under either known folder when it is present', async () => {
    fs.mkdirSync(path.join(home, '.gemini', 'config'), { recursive: true });
    await installMcp({ home, entry });
    expect(JSON.parse(fs.readFileSync(path.join(home, '.gemini', 'config', 'mcp_config.json'), 'utf8')).mcpServers['lunatic-design']).toEqual(entry);
  });

  it('keeps a backup of an existing file before changing it', async () => {
    fs.writeFileSync(path.join(home, '.claude.json'), JSON.stringify({ keep: true }));
    await installMcp({ home, entry });
    expect(JSON.parse(fs.readFileSync(path.join(home, '.claude.json.bak'), 'utf8'))).toEqual({ keep: true });
    expect(JSON.parse(fs.readFileSync(path.join(home, '.claude.json'), 'utf8')).keep).toBe(true);
  });

  it('reports a broken file and leaves it exactly as it was', async () => {
    fs.writeFileSync(path.join(home, '.claude.json'), '{ broken');
    const report = await installMcp({ home, entry });
    expect(report.find((r: { agent: string }) => r.agent === 'Claude Code').status).toBe('failed');
    expect(fs.readFileSync(path.join(home, '.claude.json'), 'utf8')).toBe('{ broken');
  });
});

describe('server entry with env', () => {
  const withEnv = { ...entry, env: { ELECTRON_RUN_AS_NODE: '1' } };

  it('writes the env block for JSON agents', () => {
    const out = JSON.parse(mergeJson('', withEnv));
    expect(out.mcpServers['lunatic-design'].env).toEqual({ ELECTRON_RUN_AS_NODE: '1' });
  });

  it('writes the env table for Codex and replaces it on a second run', () => {
    const once = mergeToml('', withEnv);
    expect(once).toContain('[mcp_servers.lunatic-design.env]\nELECTRON_RUN_AS_NODE = "1"');
    const twice = mergeToml(once + '\n[model]\nname = "x"\n', withEnv);
    expect(twice.match(/\[mcp_servers\.lunatic-design\.env\]/g)).toHaveLength(1);
    expect(twice).toContain('[model]');
  });

  it('leaves env out when the entry has none', () => {
    expect(JSON.parse(mergeJson('', entry)).mcpServers['lunatic-design']).not.toHaveProperty('env');
    expect(mergeToml('', entry)).not.toContain('.env]');
  });
});
