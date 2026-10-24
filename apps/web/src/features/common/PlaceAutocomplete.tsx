import type { PlaceSummary } from '@trippocket/shared';
import { MapPin, Plus } from 'lucide-react';
import { useEffect, useState } from 'react';
import { placesApi } from '../../data/api/places';
import { useAuth } from '../../data/authStore';
import { ServerOfflineNotice } from './ServerOfflineNotice';
import { useTranslation } from '../../i18n';
import { openMapLink, placeLink } from '../../shared/lib/directions';
import { BottomSheet } from '../../shared/ui';

const BADGE: Record<PlaceSummary['source'], { letter: string; bg: string; fg: string }> = {
  kakao: { letter: 'K', bg: '#FEE500', fg: '#191F28' },
  naver: { letter: 'N', bg: '#03C75A', fg: '#FFFFFF' },
  google: { letter: 'G', bg: '#4285F4', fg: '#FFFFFF' },
};

/** 처음 보여 주는 추천 수 — 나머지는 [더보기] 창 (사용자 요청 2026-10-25) */
const SHOWN = 3;

/**
 * 이름 칸 장소 자동완성 (일정·숙소·음식점 예약, 사용자 요청 2026-10-22·25, docs/10 §4.4):
 * 입력 → (0.4초 뒤) 비슷한 순 3개: 이름 + 아래 작은 주소 + 출처 + 오른쪽 지도 버튼, 더 있으면 [+ 더보기].
 * 로그인했을 때만 서버 검색 (비용·남용 통제), 아니면 직접 입력만
 */
export function PlaceAutocomplete({
  query,
  domestic,
  near,
  onPick,
}: {
  query: string;
  domestic: boolean;
  near: { lat: number; lng: number } | undefined;
  onPick: (place: PlaceSummary) => void;
}) {
  const { t } = useTranslation();
  const loggedIn = useAuth((s) => s.status === 'user');
  const [results, setResults] = useState<PlaceSummary[]>([]);
  const [state, setState] = useState<'idle' | 'loading' | 'empty' | 'limit'>('idle');
  // 고른 이름 — 같은 이름으로 다시 검색하지 않게
  const [picked, setPicked] = useState('');
  // 폼 시트 위에 겹쳐 여는 창 — 주소 기록(useRouteSheet)은 시트 하나만 기억해서 폼이 닫히므로 따로
  const [moreOpen, setMoreOpen] = useState(false);

  useEffect(() => {
    const q = query.trim();
    if (!loggedIn || q.length < 2 || q === picked) return;
    let alive = true;
    const id = window.setTimeout(() => {
      setState('loading');
      void placesApi.search(q, domestic ? 'domestic' : 'overseas', near).then((r) => {
        if (!alive) return;
        if (r.ok) {
          setResults(r.data.places);
          setState(r.data.places.length ? 'idle' : 'empty');
        } else {
          setResults([]);
          setState(r.status === 429 ? 'limit' : 'idle');
        }
      });
    }, 400);
    return () => {
      alive = false;
      window.clearTimeout(id);
    };
  }, [query, loggedIn, domestic, near, picked]);

  // 로그인했던 기기가 서버에 닿지 않을 때 — 직접 입력은 그대로
  if (!loggedIn) return <ServerOfflineNotice inline />;
  const q = query.trim();
  if (q.length < 2 || q === picked) return null;
  if (state === 'loading' && results.length === 0)
    return <p className="text-caption text-fg-muted">{t('placeSearch.searching')}</p>;
  if (state === 'empty')
    return <p className="text-caption text-fg-muted">{t('placeSearch.none')}</p>;
  if (state === 'limit')
    return <p className="text-caption text-fg-muted">{t('placeSearch.limit')}</p>;
  if (results.length === 0) return null;

  const pick = (p: PlaceSummary) => {
    setPicked(p.name);
    setResults([]);
    setMoreOpen(false);
    onPick(p);
  };
  const rest = results.length - SHOWN;

  return (
    <>
      <ul
        role="listbox"
        aria-label={t('placeSearch.label')}
        className="flex flex-col divide-y divide-line overflow-hidden rounded-card border border-line bg-surface shadow-sm"
      >
        {results.slice(0, SHOWN).map((p) => (
          <PlaceOption key={`${p.source}:${p.id}`} place={p} onPick={() => pick(p)} />
        ))}
        {rest > 0 && (
          <li>
            <button
              type="button"
              onClick={() => setMoreOpen(true)}
              className="flex w-full items-center justify-center gap-1 py-2.5 text-caption font-semibold text-primary active:bg-bg-subtle"
            >
              <Plus aria-hidden="true" className="size-4" />
              {t('placeSearch.more', { n: rest })}
            </button>
          </li>
        )}
      </ul>
      <BottomSheet
        open={moreOpen}
        onOpenChange={setMoreOpen}
        title={t('placeSearch.moreTitle', { q })}
      >
        <ul
          role="listbox"
          aria-label={t('placeSearch.label')}
          className="flex flex-col divide-y divide-line"
        >
          {results.map((p) => (
            <PlaceOption key={`${p.source}:${p.id}`} place={p} onPick={() => pick(p)} />
          ))}
        </ul>
      </BottomSheet>
    </>
  );
}

function PlaceOption({ place: p, onPick }: { place: PlaceSummary; onPick: () => void }) {
  const { t } = useTranslation();
  const b = BADGE[p.source];
  return (
    <li className="flex items-center">
      <button
        type="button"
        role="option"
        aria-selected={false}
        onClick={onPick}
        className="flex min-w-0 flex-1 items-center gap-2 px-3 py-2 text-left active:bg-bg-subtle"
      >
        <span
          aria-label={t(`placeSearch.source.${p.source}`)}
          className="grid size-5 shrink-0 place-items-center rounded text-[11px] font-extrabold"
          style={{ background: b.bg, color: b.fg }}
        >
          {b.letter}
        </span>
        <span className="flex min-w-0 flex-col">
          <span className="truncate text-body-2 font-medium">{p.name}</span>
          <span className="truncate text-caption text-fg-muted">
            {[p.category, p.address].filter(Boolean).join(' · ')}
          </span>
        </span>
      </button>
      <button
        type="button"
        aria-label={t('placeSearch.openMap', { name: p.name })}
        onClick={() => {
          const app = p.source === 'google' ? 'google' : p.source === 'kakao' ? 'kakao' : 'naver';
          const link = placeLink(
            app,
            {
              name: p.name,
              address: p.address,
              ...(p.coords ? { coords: p.coords } : {}),
              ...(p.source === 'google' ? { googlePlaceId: p.id } : {}),
            },
            window.location.hostname,
          );
          if (p.url && !link.app) window.open(p.url, '_blank', 'noopener');
          else openMapLink(link);
        }}
        className="grid size-11 shrink-0 place-items-center text-primary"
      >
        <MapPin aria-hidden="true" className="size-5" />
      </button>
    </li>
  );
}
