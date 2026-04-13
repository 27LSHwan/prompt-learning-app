import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import './index.css';
import { loadRuntimeEnv } from './lib/runtime-env';

async function bootstrap() {
  await loadRuntimeEnv();

  ReactDOM.createRoot(document.getElementById('root')!).render(
    <React.StrictMode>
      <App />
    </React.StrictMode>
  );
}

bootstrap();
