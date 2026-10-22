import { StrictMode } from 'react';
import { polyfillCountryFlagEmojis } from 'country-flag-emoji-polyfill';
import flagFontUrl from 'country-flag-emoji-polyfill/dist/TwemojiCountryFlags.woff2?url';
import { createRoot } from 'react-dom/client';
import { App } from './app/App';
import './i18n';
import './styles/index.css';

// Windows 등 국기 이모지를 못 그리는 환경에서만 국기 글꼴(앱에 포함, 약 77KB)을 받는다
polyfillCountryFlagEmojis('Twemoji Country Flags', flagFontUrl);

const root = document.getElementById('root');
if (!root) throw new Error('#root 요소가 없어요');

createRoot(root).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
