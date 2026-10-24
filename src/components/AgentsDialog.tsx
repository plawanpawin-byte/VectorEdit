import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { setState, useStore } from '../store';

interface AgentInfo {
  command: string;
  args: string[];
  workFolder: string;
  running: boolean;
}

const quote = (s: string) => (/[\s"]/.test(s) ? `"${s.replace(/"/g, '\\"')}"` : s);

function snippets(a: AgentInfo) {
  const line = [a.command, ...a.args].map(quote).join(' ');
  return [
    { id: 'claude', title: 'Claude Code', hint: 'Run this once in a terminal:', text: `claude mcp add lunatic-design -- ${line}` },
    {
      id: 'codex',
      title: 'Codex',
      hint: 'Add this to ~/.codex/config.toml:',
      text: `[mcp_servers.lunatic-design]\ncommand = '${a.command.replace(/'/g, '')}'\nargs = [${a.args.map((x) => JSON.stringify(x)).join(', ')}]`,
    },
    {
      id: 'antigravity',
      title: 'Antigravity',
      hint: 'Add this to its MCP configuration (mcp_config.json):',
      text: JSON.stringify({ mcpServers: { 'lunatic-design': { command: a.command, args: a.args } } }, null, 2),
    },
  ];
}

/** How to let Claude, Codex or Antigravity work in the open document, through the app's MCP server. */
export function AgentsDialog() {
  const open = useStore((s) => s.agentsOpen);
  const [info, setInfo] = useState<AgentInfo | null>(null);
  const [copied, setCopied] = useState<string | null>(null);

  useEffect(() => {
    if (!open || !window.desktop) return;
    void window.desktop.agentInfo().then(setInfo);
  }, [open]);
  useEffect(() => {
    if (!open) return;
    const k = (e: KeyboardEvent) => e.key === 'Escape' && close();
    window.addEventListener('keydown', k);
    return () => window.removeEventListener('keydown', k);
  });

  if (!open) return null;
  const close = () => setState({ agentsOpen: false });
  const copy = (id: string, text: string) => {
    void navigator.clipboard?.writeText(text).then(() => {
      setCopied(id);
      setTimeout(() => setCopied((c) => (c === id ? null : c)), 1500);
    });
  };
  return createPortal(
    <div className="modal-back" onMouseDown={close}>
      <div className="modal agents" role="dialog" aria-label="Connect AI agents" onMouseDown={(e) => e.stopPropagation()}>
        <header>
          <span>Connect AI agents</span>
          <button className="ibtn" title="Close" onClick={close}>×</button>
        </header>
        <div className="agents-body">
          <p>
            Let Claude, Codex or Antigravity work in the document you have open: add shapes and text, change colours, look at the result.
            Everything stays on this computer. Keep Lunatic Design open while the agent works.
          </p>
          {!window.desktop && <p className="newdoc-error">Connecting agents needs the desktop app. It is not available in the browser.</p>}
          {info && (
            <>
              <p className="dim">
                {info.running ? 'Ready: the app is listening for a local agent.' : 'The local connection did not start; restart the app.'} Agents can save and open documents only in{' '}
                <code>{info.workFolder}</code>.
              </p>
              {snippets(info).map((s) => (
                <section key={s.id}>
                  <div className="agents-row">
                    <h4>{s.title}</h4>
                    <button className="mini" onClick={() => copy(s.id, s.text)}>{copied === s.id ? 'Copied' : 'Copy'}</button>
                  </div>
                  <p className="dim">{s.hint}</p>
                  <pre>{s.text}</pre>
                </section>
              ))}
            </>
          )}
        </div>
        <footer className="newdoc-foot">
          <div className="grow" />
          <button className="mini wide primary" onClick={close}>Close</button>
        </footer>
      </div>
    </div>,
    document.body,
  );
}
