import type { Trip } from '@trippocket/shared';
import { Plus } from 'lucide-react';
import { useEffect, useState } from 'react';
import { api } from '../../data/api/client';
import { useLab } from '../../data/labsStore';
import { itemRepo } from '../../data/repositories/itemRepo';
import { isDomesticTrip } from '../../domain/tripPlace';
import { useTranslation } from '../../i18n';
import { formatMonthDay } from '../../shared/lib/dateFormat';
import { IconButton, toast } from '../../shared/ui';

interface Festival {
  id: string;
  title: string;
  address: string;
  start: string;
  end: string;
  coords: { lat: number; lng: number };
}

/**
 * 실험실 "여행 기간 축제·행사" (docs/26 B1, 2026-11-03): 국내 여행에서 여행 날짜에 열리는 근처(30km) 행사.
 * 한국관광공사 자료. [+]를 누르면 "가고 싶은 곳"에 넣는다. 보내는 것은 여행지 도시 좌표·날짜뿐
 */
export function FestivalsSection({ trip }: { trip: Trip }) {
  const on = useLab('festivals');
  const near = trip.destinations.find((d) => d.coords)?.coords;
  if (!on || !near || !isDomesticTrip(trip)) return null;
  return <List trip={trip} near={near} />;
}

function List({ trip, near }: { trip: Trip; near: { lat: number; lng: number } }) {
  const { t } = useTranslation();
  const [list, setList] = useState<Festival[] | null>(null);
  useEffect(() => {
    let alive = true;
    void api<{ festivals: Festival[] }>('/api/info/festivals', {
      method: 'POST',
      body: JSON.stringify({ near, from: trip.startDate, to: trip.endDate }),
    }).then((r) => alive && setList(r.ok ? r.data.festivals : []));
    return () => {
      alive = false;
    };
  }, [near.lat, near.lng, trip.startDate, trip.endDate]); // eslint-disable-line react-hooks/exhaustive-deps
  if (!list?.length) return null;
  return (
    <div className="flex flex-col rounded-card bg-bg-subtle px-3 py-2">
      <span className="text-caption font-semibold">{t('festivals.title')}</span>
      <ul className="flex flex-col">
        {list.map((f) => (
          <li key={f.id} className="flex min-h-11 items-center gap-2">
            <span className="flex min-w-0 flex-1 flex-col">
              <span className="truncate text-body-2 font-semibold">{f.title}</span>
              <span className="tabular truncate text-caption text-fg-muted">
                {formatMonthDay(f.start)}~{formatMonthDay(f.end)} · {f.address}
              </span>
            </span>
            <IconButton
              label={t('festivals.add', { name: f.title })}
              icon={<Plus />}
              onClick={() =>
                void itemRepo
                  .create({
                    tripId: trip.id,
                    date: null,
                    kind: 'activity',
                    title: f.title,
                    place: {
                      name: f.title,
                      ...(f.address ? { address: f.address } : {}),
                      coords: f.coords,
                      coordsSource: 'user',
                    },
                  })
                  .then(() => toast(t('festivals.added', { name: f.title })))
              }
            />
          </li>
        ))}
      </ul>
      <span className="text-micro text-fg-muted">{t('festivals.source')}</span>
    </div>
  );
}
