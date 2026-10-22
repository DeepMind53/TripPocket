import { useState } from 'react';
import { api } from '../../data/api/client';
import { Button, Chip, SegmentedControl, TopBar } from '../../shared/ui';

/* 개발용 화면이라 문구를 i18n에 넣지 않는다 (DevDbPage와 같은 방식) */

interface Collected {
  anchor: string;
  categories: Record<
    string,
    {
      queries: string[];
      byPeriod: Record<string, number>;
      posts: { title: string; link: string; postdate: string; blogger: string }[];
    }
  >;
}

const CATS = [
  ['food', '맛집'],
  ['cafe', '카페·핫플'],
  ['play', '놀거리'],
] as const;

/** 20단계 확인용: 기준점 → 네이버 블로그 수집 결과(원자료)와 기간별 개수 */
export function DevAiPage() {
  const [mode, setMode] = useState<'text' | 'coords'>('text');
  const [name, setName] = useState('신주쿠역');
  const [cats, setCats] = useState<string[]>(['food']);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [data, setData] = useState<Collected | null>(null);

  async function anchor() {
    if (mode === 'text') return { type: 'text', name };
    const pos = await new Promise<GeolocationPosition>((ok, fail) =>
      navigator.geolocation.getCurrentPosition(ok, fail, { timeout: 10_000 }),
    );
    // 기기에서 먼저 소수 3자리(약 100m)로 줄여 보낸다
    const r = (n: number) => Math.round(n * 1000) / 1000;
    return { type: 'coords', lat: r(pos.coords.latitude), lng: r(pos.coords.longitude) };
  }

  async function run() {
    setBusy(true);
    setError('');
    try {
      const res = await api<Collected>('/api/v1/ai/collect', {
        method: 'POST',
        body: JSON.stringify({ anchor: await anchor(), categories: cats }),
      });
      if (res.ok) setData(res.data);
      else setError(`${res.reason} (${res.status}) — 로그인·서버·네이버 검색 키를 확인하세요`);
    } catch (e) {
      setError(String(e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mx-auto min-h-dvh max-w-[560px] pb-10">
      <TopBar title="AI 추천 수집 (개발용)" backTo="/me" />
      <div className="flex flex-col gap-3 px-5">
        <SegmentedControl
          label="기준점"
          value={mode}
          onChange={setMode}
          options={[
            { value: 'text', label: '직접 입력' },
            { value: 'coords', label: '현재 위치 → 가까운 역' },
          ]}
        />
        {mode === 'text' && (
          <input
            aria-label="기준점 이름"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="h-11 rounded-btn bg-bg-subtle px-3 text-body-1"
          />
        )}
        <div className="flex gap-2">
          {CATS.map(([v, label]) => (
            <Chip
              key={v}
              selected={cats.includes(v)}
              onClick={() => setCats((c) => (c.includes(v) ? c.filter((x) => x !== v) : [...c, v]))}
            >
              {label}
            </Chip>
          ))}
        </div>
        <Button loading={busy} disabled={cats.length === 0} onClick={() => void run()}>
          수집
        </Button>
        {error && (
          <p role="alert" className="text-body-2 text-danger">
            {error}
          </p>
        )}
        {data && (
          <section className="flex flex-col gap-4">
            <p className="text-body-1 font-bold">기준점: {data.anchor}</p>
            {Object.entries(data.categories).map(([cat, c]) => (
              <div key={cat} className="flex flex-col gap-2 rounded-card border border-line p-3">
                <p className="text-body-2 font-semibold">{c.queries.join(' / ')}</p>
                <p className="tabular text-caption text-fg-sub">
                  1개월 {c.byPeriod[1]} · 3개월 {c.byPeriod[3]} · 6개월 {c.byPeriod[6]} · 12개월{' '}
                  {c.byPeriod[12]}
                </p>
                <ul className="flex flex-col gap-1">
                  {c.posts.slice(0, 20).map((p) => (
                    <li key={p.link} className="flex gap-2 text-caption">
                      <span className="tabular shrink-0 text-fg-muted">{p.postdate}</span>
                      <a
                        href={p.link}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="truncate text-primary"
                      >
                        {p.title}
                      </a>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </section>
        )}
      </div>
    </div>
  );
}
