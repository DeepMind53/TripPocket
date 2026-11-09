const loading = new Map<string, Promise<void>>();

/** 지도 SDK 스크립트를 한 번만 넣는다 (npm 패키지 없이 제공자 공식 스크립트) */
export function loadScript(src: string, ready: () => boolean): Promise<void> {
  if (ready()) return Promise.resolve();
  let p = loading.get(src);
  if (!p) {
    p = new Promise<void>((resolve, reject) => {
      const s = document.createElement('script');
      s.src = src;
      s.async = true;
      s.onerror = () => {
        loading.delete(src);
        reject(new Error(`지도 스크립트를 불러오지 못했어요: ${new URL(src).host}`));
      };
      s.onload = () => {
        // 일부 SDK는 onload 뒤 비동기로 준비된다
        const started = Date.now();
        const wait = () => {
          if (ready()) resolve();
          else if (Date.now() - started > 10_000) reject(new Error('지도 준비 시간이 지났어요'));
          else setTimeout(wait, 50);
        };
        wait();
      };
      document.head.appendChild(s);
    });
    loading.set(src, p);
  }
  return p;
}

/** 원 안에 숫자가 있는 핀 (SVG) — 두 제공자 모두 이미지로 쓴다 */
export function pinSvg(label: string, color: string, ink: string = color): string {
  // 일정의 역 점과 같은 모양 (docs/29 §7.6): 흰 바탕 + 노선 색 고리 + 진한 노선 색 번호, 바깥 흰 테두리로 지도 위에서도 또렷하게
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="30" height="30" viewBox="0 0 30 30"><circle cx="15" cy="15" r="14" fill="white"/><circle cx="15" cy="15" r="10.5" fill="white" stroke="${color}" stroke-width="4"/><text x="15" y="19.5" text-anchor="middle" font-family="sans-serif" font-size="12" font-weight="700" fill="${ink}">${label}</text></svg>`;
  return `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(svg)}`;
}
