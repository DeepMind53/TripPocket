import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import ko from './ko.json';

// 한국어 우선 (docs/08 A3). 영어는 구조만 준비 — en.json 추가 시 resources에 등록.
export const defaultNS = 'translation';
export const resources = { ko: { translation: ko } } as const;

void i18n.use(initReactI18next).init({
  resources,
  lng: 'ko',
  fallbackLng: 'ko',
  defaultNS,
  interpolation: { escapeValue: false }, // React가 이미 이스케이프함
  returnNull: false,
});

export default i18n;
