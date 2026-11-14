import { createContext } from 'react';

/** 묶음 화면의 제목 — 상자 제목이 같으면 화면에서는 숨긴다 (같은 글이 두 번 보이지 않게, 2026-11-14) */
export const SettingsPageTitle = createContext<string | null>(null);
