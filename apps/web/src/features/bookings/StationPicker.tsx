import type { PlaceSummary } from '@trippocket/shared';
import { MapPin } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { api } from '../../data/api/client';
import { krStationsFor, stationKindOf } from '../../data/krStations';
import { useTranslation } from '../../i18n';
import { Spinner } from '../../shared/ui';

export interface PickedStation {
  name: string;
  address?: string | undefined;
  coords?: { lat: number; lng: number } | undefined;
}

interface Suggestion extends PickedStation {
  /** 현지어·영어 이름 · 지역 */
  sub?: string | undefined;
}

const inputClass =
  'h-12 w-full min-w-0 rounded-btn border border-line bg-bg-subtle px-3 text-body-1 outline-none focus:border-primary';

/** 국내 역은 앱 목록에 주소가 없어 고를 때 장소 검색(카카오·네이버)으로 주소·좌표를 채운다 */
async function lookupAddress(name: string): Promise<PickedStation> {
  const res = await api<{ places: PlaceSummary[] }>('/api/places/search', {
    method: 'POST',
    body: JSON.stringify({ q: name, scope: 'domestic' }),
  });
  const p = res.ok ? res.data.places[0] : undefined;
  return {
    name,
    ...(p?.address ? { address: p.address.slice(0, 200) } : {}),
    ...(p?.coords ? { coords: p.coords } : {}),
  };
}

/**
 * 기차·버스 출발/도착역 칸 하나 (사용자 요청 2026-11-03): 도시나 역 이름을 치면 아래에 역이 나오고 고른다.
 * 국내 = 앱에 넣어 둔 역·터미널(칩으로 노선 거르기, 인터넷 없이), 해외 = 홈 서버가 그 나라 도시의 역을 찾는다.
 * 고르면 역 이름 + 주소·좌표(길찾기)를 채운다. 목록에 없으면 친 글자 그대로 저장 (직접 입력)
 */
export function StationField({
  id,
  label,
  value,
  address,
  chip,
  domestic,
  country,
  onChange,
}: {
  id: string;
  label: string;
  value: string;
  address?: string | undefined;
  chip: string;
  domestic: boolean;
  country?: string | undefined;
  /** 글자를 고치면 주소·좌표 없이, 목록에서 고르면 함께 */
  onChange: (picked: PickedStation) => void;
}) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const [remote, setRemote] = useState<Suggestion[] | null>(null);
  const [busy, setBusy] = useState(false);
  const typed = useRef(false);
  const q = value.trim();

  // 해외: 멈추고 0.5초 뒤 서버에 (같은 도시는 서버가 7일 기억)
  useEffect(() => {
    if (domestic || !open || !typed.current || q.length < 2) return;
    let alive = true;
    const timer = setTimeout(() => {
      setBusy(true);
      void api<{ stations: (PickedStation & { local?: string })[] }>('/api/places/stations', {
        method: 'POST',
        body: JSON.stringify({
          city: q,
          ...(country ? { cc: country } : {}),
          kind: stationKindOf(chip),
        }),
      }).then((res) => {
        if (!alive) return;
        setBusy(false);
        setRemote(
          res.ok ? res.data.stations.map((s) => ({ ...s, sub: s.local ?? s.address })) : [],
        );
      });
    }, 500);
    return () => {
      alive = false;
      clearTimeout(timer);
    };
  }, [domestic, open, q, country, chip]);

  const list: Suggestion[] = domestic
    ? krStationsFor(chip, q)
        .slice(0, 12)
        .map((s) => ({ name: s.name, sub: `${s.region} ${s.city}` }))
    : q.length >= 2
      ? (remote ?? [])
      : [];

  async function pick(s: Suggestion) {
    setOpen(false);
    typed.current = false;
    if (domestic && !s.address) {
      onChange({ name: s.name });
      onChange(await lookupAddress(s.name));
    } else onChange({ name: s.name, address: s.address, coords: s.coords });
  }

  const listId = `${id}-list`;
  return (
    <div className="relative flex flex-col gap-1">
      <input
        id={id}
        role="combobox"
        aria-expanded={open && list.length > 0}
        aria-controls={listId}
        aria-autocomplete="list"
        value={value}
        maxLength={100}
        placeholder={t(domestic ? 'station.placeholder' : 'station.placeholderAbroad')}
        onFocus={() => setOpen(true)}
        onChange={(e) => {
          typed.current = true;
          setOpen(true);
          onChange({ name: e.target.value });
        }}
        onBlur={() => setOpen(false)}
        onKeyDown={(e) => e.key === 'Escape' && setOpen(false)}
        className={inputClass}
      />
      {address && (
        <span className="flex items-center gap-1 px-1 text-caption text-fg-muted">
          <MapPin aria-hidden="true" className="size-3.5 shrink-0" />
          <span className="truncate">{address}</span>
        </span>
      )}
      {open && (list.length > 0 || busy) && (
        <ul
          id={listId}
          role="listbox"
          aria-label={t('station.listOf', { label })}
          className="flex max-h-60 flex-col overflow-y-auto rounded-btn border border-line bg-surface shadow-card"
        >
          {busy && (
            <li className="flex min-h-11 items-center gap-2 px-3 text-caption text-fg-muted">
              <Spinner /> {t('station.searching')}
            </li>
          )}
          {list.map((s) => (
            <li
              key={`${s.name}|${s.coords?.lat ?? ''}`}
              role="option"
              aria-selected={s.name === value}
            >
              <button
                type="button"
                // 입력 칸이 먼저 포커스를 잃어 목록이 닫히지 않게
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => void pick(s)}
                className="flex min-h-11 w-full flex-col justify-center px-3 py-1.5 text-left"
              >
                <span className="text-body-2 font-semibold">{s.name}</span>
                {s.sub && <span className="truncate text-caption text-fg-muted">{s.sub}</span>}
              </button>
            </li>
          ))}
          {!domestic && list.length > 0 && (
            <li className="px-3 py-1.5 text-micro text-fg-muted">{t('station.source')}</li>
          )}
        </ul>
      )}
    </div>
  );
}
