import React from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import './styles.css';
import './theme.css';
import './journey.css';
import './adaptive.css';
import { installWebBridge } from './web-bridge';

let savedTheme: string | null = null;
try {
  savedTheme = localStorage.getItem('ticket-theme');
} catch {
  // Storage-denied browser sessions still need a readable startup screen.
}
document.documentElement.dataset.theme = savedTheme === 'dark' ? 'dark' : 'light';
installWebBridge();

createRoot(document.getElementById('root')!).render(
  window.ticket ? (
    <React.StrictMode>
      <App />
    </React.StrictMode>
  ) : (
    <main style={{ maxWidth: 640, margin: '12vh auto', padding: 32, lineHeight: 1.8 }}>
      <h1>候票台未能连接本地服务</h1>
      <p>桌面版请运行 pnpm start；网页版本请运行 pnpm web，再访问终端显示的地址。</p>
      <p>直接双击 index.html 无法启动应用。</p>
    </main>
  ),
);
