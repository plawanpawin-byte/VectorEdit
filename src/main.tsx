import { createRoot } from 'react-dom/client';
import { App } from './App';
import { ErrorBoundary } from './components/ErrorBoundary';
import { restoreAutosave, startAutosave } from './persist';
import * as store from './store';
import * as registry from './tools/registry';
import * as docfile from './document';
import * as exporter from './components/exporter';
import * as rasterLayer from './raster/layer';
import { newDocument, openStartPage } from './store';
import './styles.css';

async function main() {
  // automated tests drive the app through this handle; it only exists with ?e2e in the address
  if (new URLSearchParams(location.search).has('e2e')) (window as unknown as { __ve: unknown }).__ve = { store, registry, docfile, exporter, rasterLayer };
  const restored = await restoreAutosave();
  startAutosave();
  // a fresh launch shows the start page; without restored work it sits over an empty page. ?e2e keeps the sample page for automated tests
  if (!new URLSearchParams(location.search).has('e2e')) {
    if (!restored) newDocument();
    openStartPage();
  }
  createRoot(document.getElementById('root')!).render(
    <ErrorBoundary>
      <App />
    </ErrorBoundary>,
  );
}

void main();
