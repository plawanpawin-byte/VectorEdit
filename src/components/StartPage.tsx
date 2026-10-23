import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { openDoc, openRecent } from '../fileio';
import { clearAutosave } from '../persist';
import { newDocument, openNewDocument, openStartPage, setState, useStore } from '../store';

interface Recent {
  path: string;
  name: string;
  dir: string;
}

/** Start page shown on a fresh launch: New document, Open, and the files used recently (desktop app). */
export function StartPage() {
  const open = useStore((s) => s.startOpen);
  // restored or edited work that has not been saved to a file yet
  const unsaved = useStore((s) => s.past.length !== s.cleanMark);
  const [recent, setRecent] = useState<Recent[]>([]);

  useEffect(() => {
    if (!open || !window.desktop) return;
    void window.desktop.recentFiles().then(setRecent);
  }, [open]);

  if (!open) return null;
  const close = () => setState({ startOpen: false });
  // throw away the restored work (and its autosave copy) and start from an empty page
  const discard = () => {
    if (!window.confirm('Discard the unsaved work, including its images, and start with an empty page?')) return;
    void clearAutosave().then(() => {
      newDocument();
      openStartPage();
    });
  };
  // drawn on document.body so the editor's panels and menu bar can never paint over it
  return createPortal(
    <div className="startpage" role="dialog" aria-label="Start">
      <div className="start-inner">
        <h1>VectorEdit</h1>
        <p className="start-tag">Create a new document or open an existing file.</p>
        <div className="start-actions">
          <button className="start-primary" onClick={openNewDocument}>
            New document… <kbd>Ctrl+N</kbd>
          </button>
          <button className="start-secondary" onClick={() => void openDoc()}>
            Open… <kbd>Ctrl+O</kbd>
          </button>
          {unsaved && (
            <button className="start-secondary" onClick={close}>
              Continue unsaved work
            </button>
          )}
          {unsaved && (
            <button className="start-secondary" onClick={discard}>
              Discard unsaved work
            </button>
          )}
        </div>
        <p className="start-hint">Drop an image or SVG anywhere to open it.</p>
        {recent.length > 0 && (
          <section className="start-recent">
            <h2>Recent</h2>
            <ul>
              {recent.map((f) => (
                <li key={f.path}>
                  <button
                    title={f.path}
                    onClick={() => {
                      close();
                      void openRecent(f.path);
                    }}
                  >
                    <span className="start-name">{f.name}</span>
                    <span className="start-dir">{f.dir}</span>
                  </button>
                </li>
              ))}
            </ul>
          </section>
        )}
      </div>
    </div>,
    document.body,
  );
}
