/** 실험실은 기본 꺼짐 — 예전에 샘플이 전부 켠 기기도 한 번 모두 끈다 (사용자 요청 2026-11-03) */
it('처음 읽을 때 예전 실험실 값을 지우고, 그 뒤에는 사용자가 켠 값을 그대로 읽는다', async () => {
  localStorage.removeItem('tp-labs-reset');
  localStorage.setItem('tp-labs', JSON.stringify({ offlineReady: true, leftDrive: true }));
  vi.resetModules();
  const first = await import('./labsStore');
  expect(first.useLabs.getState()).toEqual({});
  expect(localStorage.getItem('tp-labs')).toBeNull();

  first.setLab('freeTime', true);
  vi.resetModules();
  const again = await import('./labsStore');
  expect(again.useLabs.getState()).toEqual({ freeTime: true });
  again.setLab('freeTime', false);
});
