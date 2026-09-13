import React from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import './styles.css';
import './theme.css';
import './journey.css';
import './adaptive.css';

const savedTheme = localStorage.getItem('ticket-theme');
document.documentElement.dataset.theme = savedTheme === 'dark' ? 'dark' : 'light';

createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
