import { Component, type ReactNode } from 'react';
import { clearAutosave } from '../persist';

interface State {
  error: Error | null;
}

/** Keeps a rendering bug from leaving a blank window, and offers a way out if the saved document is the cause. */
export class ErrorBoundary extends Component<{ children: ReactNode }, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  render() {
    if (!this.state.error) return this.props.children;
    return (
      <div className="crash">
        <h2>Something went wrong</h2>
        <p>{this.state.error.message}</p>
        <div>
          <button onClick={() => location.reload()}>Reload</button>
          <button
            onClick={() => {
              clearAutosave();
              location.reload();
            }}
          >
            Discard autosave and reload
          </button>
        </div>
      </div>
    );
  }
}
