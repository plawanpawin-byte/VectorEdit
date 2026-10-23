import { createRoot } from 'react-dom/client';
import { App } from './App';
import { ErrorBoundary } from './components/ErrorBoundary';
import { restoreAutosave, startAutosave } from './persist';
import * as store from './store';
import { newDocument, openNewDocument } from './store';
import './styles.css';

async function main() {
  // automated tests drive the app through this handle; it only exists with ?e2e in the address
  if (new URLSearchParams(location.search).has('e2e')) (window as unknown as { __ve: unknown }).__ve = { store };
  const restored = await restoreAutosave();
  startAutosave();
  // a fresh launch starts from an empty page and the New Document dialog; ?e2e keeps the sample page for automated tests
  if (!restored && !new URLSearchParams(location.search).has('e2e')) {
    newDocument();
    openNewDocument();
  }
  createRoot(document.getElementById('root')!).render(
    <ErrorBoundary>
      <App />
    </ErrorBoundary>,
  );
}

void main();
