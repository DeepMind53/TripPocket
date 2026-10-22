import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './app/App';
import './styles/index.css';

const root = document.getElementById('root');
if (!root) throw new Error('#root 요소가 없어요');

createRoot(root).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
