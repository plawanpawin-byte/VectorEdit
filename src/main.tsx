import { createRoot } from 'react-dom/client';
import { App } from './App';
import { ErrorBoundary } from './components/ErrorBoundary';
import { restoreAutosave, startAutosave } from './persist';
import './styles.css';

async function main() {
  await restoreAutosave();
  startAutosave();
  createRoot(document.getElementById('root')!).render(
    <ErrorBoundary>
      <App />
    </ErrorBoundary>,
  );
}

void main();
