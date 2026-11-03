import { Search } from 'lucide-react';
import { useState } from 'react';
import { api } from '../../data/api/client';
import { krStationsFor, stationKindOf } from '../../data/krStations';
import { useTranslation } from '../../i18n';
import { Button, Spinner } from '../../shared/ui';

interface FoundStation {
  name: string;
  local?: string;
  address: string;
  coords: { lat: number; lng: number };
}

const inputClass =
  'h-11 w-full min-w-0 rounded-btn border border-line bg-bg-subtle px-3 text-body-2 outline-none focus:border-primary';

/**
 * 기차·버스 출발/도착역 고르기 (사용자 요청 2026-11-03): 도시 이름 → 그 도시의 역.
 * 국내 = 앱에 넣어 둔 역·터미널 드롭다운 (칩으로 노선 거르기, 인터넷 없이),
 * 해외 = 홈 서버가 Geoapify로 찾은 그 나라 도시의 역 (좌표도 저장 → 길찾기). 직접 입력은 위 칸에서
 */
export function StationPicker({
  label,
  chip,
  domestic,
  country,
  near,
  onPick,
}: {
  /** "출발역" · "도착역" */
  label: string;
  /** 고른 교통수단 칩 (KTX·SRT·고속버스 …) */
  chip: string;
  domestic: boolean;
  /** 해외 여행 나라 */
  country?: string | undefined;
  /** 도시를 안 적었을 때 쓸 여행지 좌표 */
  near?: { lat: number; lng: number } | undefined;
  onPick: (name: string, coords?: { lat: number; lng: number }) => void;
}) {
  const { t } = useTranslation();
  const [city, setCity] = useState('');
  const [found, setFound] = useState<FoundStation[] | null>(null);
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState(false);

  if (domestic) {
    const list = krStationsFor(chip, city);
    const regions = [...new Set(list.map((s) => s.region))];
    return (
      <div className="flex gap-2">
        <input
          value={city}
          maxLength={20}
          aria-label={t('station.cityOf', { label })}
          placeholder={t('station.cityPlaceholder')}
          onChange={(e) => {
            setCity(e.target.value);
            // 도시에 맞는 역·터미널이 하나뿐이면 바로 고른다 (사용자 요청 2026-11-03)
            const only = e.target.value.trim() ? krStationsFor(chip, e.target.value) : [];
            if (only.length === 1) onPick(only[0]!.name);
          }}
          className={`${inputClass} w-28 shrink-0`}
        />
        <select
          aria-label={t('station.pickOf', { label })}
          value=""
          onChange={(e) => e.target.value && onPick(e.target.value)}
          className={`${inputClass} flex-1`}
        >
          <option value="">{t('station.pick', { n: list.length })}</option>
          {regions.map((r) => (
            <optgroup key={r} label={r}>
              {list
                .filter((s) => s.region === r)
                .map((s) => (
                  <option key={s.name} value={s.name}>
                    {s.name}
                  </option>
                ))}
            </optgroup>
          ))}
        </select>
      </div>
    );
  }

  async function search() {
    setBusy(true);
    setFailed(false);
    const res = await api<{ stations: FoundStation[] }>('/api/places/stations', {
      method: 'POST',
      body: JSON.stringify({
        ...(city.trim() ? { city: city.trim() } : { near }),
        ...(country ? { cc: country } : {}),
        kind: stationKindOf(chip),
      }),
    });
    setBusy(false);
    if (res.ok) setFound(res.data.stations);
    else setFailed(true);
  }

  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex gap-2">
        <input
          value={city}
          maxLength={60}
          aria-label={t('station.cityOf', { label })}
          placeholder={t('station.cityPlaceholderAbroad')}
          onChange={(e) => setCity(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault();
              void search();
            }
          }}
          className={inputClass}
        />
        <Button
          size="sm"
          variant="secondary"
          disabled={busy || (!city.trim() && !near)}
          leading={busy ? <Spinner /> : <Search aria-hidden="true" className="size-4" />}
          onClick={() => void search()}
        >
          {t('station.find')}
        </Button>
      </div>
      {failed && <p className="text-caption text-fg-muted">{t('station.failed')}</p>}
      {found && found.length === 0 && (
        <p className="text-caption text-fg-muted">{t('station.none')}</p>
      )}
      {found && found.length > 0 && (
        <ul
          aria-label={t('station.resultsOf', { label })}
          className="flex max-h-56 flex-col overflow-y-auto rounded-btn border border-line"
        >
          {found.map((s) => (
            <li key={`${s.name}|${s.coords.lat}`}>
              <button
                type="button"
                onClick={() => {
                  onPick(s.name, s.coords);
                  setFound(null);
                }}
                className="flex min-h-11 w-full flex-col justify-center px-3 py-1.5 text-left"
              >
                <span className="text-body-2 font-semibold">
                  {s.name}
                  {s.local && <span className="font-normal text-fg-muted"> · {s.local}</span>}
                </span>
                {s.address && (
                  <span className="truncate text-caption text-fg-muted">{s.address}</span>
                )}
              </button>
            </li>
          ))}
          <li className="px-3 py-1.5 text-micro text-fg-muted">{t('station.source')}</li>
        </ul>
      )}
    </div>
  );
}
