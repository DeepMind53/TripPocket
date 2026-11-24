import { applyTheme } from './theme';

it('상태 표시줄 색이 앱 테마를 따르고, 시스템이면 원래 두 줄로 (docs/31 R6)', () => {
  document.head.innerHTML = `
    <meta name="theme-color" content="#FFFFFF" media="(prefers-color-scheme: light)" />
    <meta name="theme-color" content="#0F1115" media="(prefers-color-scheme: dark)" />`;
  const metas = () => [...document.querySelectorAll<HTMLMetaElement>('meta[name="theme-color"]')];
  applyTheme('dark');
  expect(metas().map((m) => [m.content, m.getAttribute('media')])).toEqual([
    ['#0F1115', null],
    ['#0F1115', null],
  ]);
  applyTheme('system');
  expect(metas().map((m) => [m.content, m.getAttribute('media')])).toEqual([
    ['#FFFFFF', '(prefers-color-scheme: light)'],
    ['#0F1115', '(prefers-color-scheme: dark)'],
  ]);
  expect(document.documentElement.dataset.theme).toBeUndefined();
});
