import React from 'react';
import ReactDOM from 'react-dom/client';
import './index.css';
import { loadRuntimeEnv } from './lib/runtime-env';

async function bootstrap() {
  await loadRuntimeEnv();
  const { default: App } = await import('./App');

  ReactDOM.createRoot(document.getElementById('root')!).render(
    <React.StrictMode>
      <App />
    </React.StrictMode>
  );
}

bootstrap();
