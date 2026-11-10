// 저장된 테마·글자 크기를 화면을 그리기 전에 적용 (깜빡임 방지, src/data/settingsStore.ts).
// 인라인 스크립트 대신 파일로 둔다 — 보안 정책(CSP)이 인라인 스크립트를 막기 때문
try {
  var b = JSON.parse(localStorage.getItem('tp-boot') || '{}');
  if (b.theme === 'light' || b.theme === 'dark') document.documentElement.dataset.theme = b.theme;
  // 글자 크기 3단계 0.81·0.9·0.99, 기본 0.9 (2026-11-10). 예전 값: 1 → 0.9, 1.15·1.3 → 0.99 (shared parseSettings와 같게)
  var f = typeof b.fontScale === 'number' ? b.fontScale : 0.9;
  if (f === 1) f = 0.9;
  else if (f > 1) f = 0.99;
  document.documentElement.style.fontSize = Math.round(f * 100) + '%';
} catch {
  // 저장소를 못 읽어도 기본 테마로 동작
  document.documentElement.style.fontSize = '90%';
}
