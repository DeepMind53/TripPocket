// 저장된 테마·글자 크기를 화면을 그리기 전에 적용 (깜빡임 방지, src/data/settingsStore.ts).
// 인라인 스크립트 대신 파일로 둔다 — 보안 정책(CSP)이 인라인 스크립트를 막기 때문
try {
  var b = JSON.parse(localStorage.getItem('tp-boot') || '{}');
  if (b.theme === 'light' || b.theme === 'dark') document.documentElement.dataset.theme = b.theme;
  if (typeof b.fontScale === 'number' && b.fontScale !== 1)
    document.documentElement.style.fontSize = Math.round(b.fontScale * 100) + '%';
} catch {
  // 저장소를 못 읽어도 기본 테마로 동작
}
