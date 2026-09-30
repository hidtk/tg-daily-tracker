import React from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './App';
import { DemoPage } from './screens/DemoPage';
import { initTelegram } from './tg';
import './styles.css';

initTelegram();
createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    {/* /demo: the step-by-step show, open without Telegram. */}
    {window.location.pathname.replace(/\/+$/, '') === '/demo' ? <DemoPage /> : <App />}
  </React.StrictMode>,
);
