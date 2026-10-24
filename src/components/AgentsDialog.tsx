import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { setState, useStore } from '../store';

interface AgentInfo {
  command: string;
  args: string[];
  workFolder: string;
  running: boolean;
}

/** The one command to run once in PowerShell, for the app that is open. PowerShell needs `&` before a quoted path. */
function installCommand(a: AgentInfo) {
  const exe = a.command.includes(' ') ? `& "${a.command}"` : a.command;
  return `${exe} --install-mcp`;
}

/** Connect Claude Code, Codex and Antigravity with one terminal command. */
export function AgentsDialog() {
  const open = useStore((s) => s.agentsOpen);
  const [info, setInfo] = useState<AgentInfo | null>(null);
  const [copied, setCopied] = useState(false);

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
  const command = info ? installCommand(info) : '';
  const copy = () => {
    void navigator.clipboard?.writeText(command).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
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
            Connects <b>Claude Code</b>, <b>Codex</b> and <b>Antigravity</b> to Lunatic Design in one step. They can then work on the document you have open.
            Everything stays on this computer.
          </p>
          {!window.desktop && <p className="newdoc-error">Connecting agents needs the desktop app. It is not available in the browser.</p>}
          {info && (
            <>
              <p className="dim">Run this once in a terminal, then restart the agents:</p>
              <div className="agents-row">
                <pre>{command}</pre>
                <button className="mini" onClick={copy}>{copied ? 'Copied' : 'Copy'}</button>
              </div>
              <p className="dim">
                {info.running ? 'The app is listening for a local agent. ' : 'The local connection has not started; restart the app. '}
                Agents save and open documents only in <code>{info.workFolder}</code>.
              </p>
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
