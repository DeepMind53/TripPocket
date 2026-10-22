import {
  dayNumberOf,
  daysUntil,
  formatTripLength,
  getTripDays,
  getTripStatus,
  todayIn,
  type ItineraryItem,
  type Trip,
} from '@trippocket/shared';
import { ArrowDown, ArrowLeft, ArrowUp, Trash2 } from 'lucide-react';
import { useState } from 'react';
import { Link } from 'react-router';
import { resetLocalDb, seedSampleTrip } from '../../data/dev';
import { useTripItems, useTrips } from '../../data/hooks';
import { itemRepo } from '../../data/repositories/itemRepo';
import { tripRepo } from '../../data/repositories/tripRepo';
import { Button, IconButton, snackbar, toast } from '../../shared/ui';

/**
 * 기기 저장소 확인 (개발 전용, 4단계 확인용). 화면 문구는 개발용이라 i18n 대상이 아니다.
 * 새로고침해도 데이터가 남아 있는지, 순서 바꾸기·삭제·실행 취소가 되는지 확인한다.
 */
export function DevDbPage() {
  const trips = useTrips();
  const [busy, setBusy] = useState(false);

  async function run(task: () => Promise<unknown>, done: string) {
    setBusy(true);
    try {
      await task();
      toast(done);
    } catch (e) {
      toast(e instanceof Error ? e.message : '오류가 났어요');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mx-auto min-h-dvh max-w-[560px] pb-24">
      <header className="sticky top-0 z-10 flex items-center gap-1 border-b border-line bg-bg/90 px-2 pt-[env(safe-area-inset-top)] backdrop-blur">
        <Link to="/me" aria-label="마이로" className="grid size-11 place-items-center text-fg-sub">
          <ArrowLeft aria-hidden="true" className="size-5" />
        </Link>
        <h1 className="flex-1 text-title-2">저장소 확인</h1>
      </header>

      <div className="flex flex-col gap-4 px-5 pt-4">
        <div className="flex flex-wrap gap-2">
          <Button disabled={busy} onClick={() => run(seedSampleTrip, '샘플 여행을 만들었어요')}>
            샘플 여행 만들기
          </Button>
          <Button
            variant="secondary"
            disabled={busy}
            onClick={() => run(resetLocalDb, '저장소를 비웠어요')}
          >
            모두 지우기
          </Button>
        </div>
        <p className="text-caption text-fg-muted">
          만든 뒤 새로고침해도 그대로 남아 있으면 정상이에요. 순서 화살표를 누르면 정렬 키가 어떻게
          바뀌는지 볼 수 있어요.
        </p>

        {trips === undefined && <p className="text-caption text-fg-muted">불러오는 중…</p>}
        {trips?.length === 0 && (
          <p className="rounded-card bg-bg-subtle p-4 text-body-2 text-fg-sub">
            저장된 여행이 없어요.
          </p>
        )}
        {trips?.map((trip) => (
          <TripCard key={trip.id} trip={trip} />
        ))}
      </div>
    </div>
  );
}

const STATUS_LABEL = {
  upcoming: '다가오는 여행',
  ongoing: '여행 중',
  past: '다녀온 여행',
} as const;

function TripCard({ trip }: { trip: Trip }) {
  const items = useTripItems(trip.id) ?? [];
  const today = todayIn(trip.timezone);
  const status = getTripStatus(trip.startDate, trip.endDate, today);
  const dDay = daysUntil(trip.startDate, today);
  const days = getTripDays(trip.startDate, trip.endDate);

  async function remove() {
    await tripRepo.softDelete(trip.id);
    snackbar('여행을 삭제했어요', {
      label: '실행 취소',
      onAction: () => void tripRepo.restore(trip.id),
    });
  }

  return (
    <section className="flex flex-col gap-3 rounded-card border border-line bg-surface p-4">
      <div className="flex items-start gap-2">
        <span className="text-[28px] leading-none">{trip.cover.emoji}</span>
        <div className="min-w-0 flex-1">
          <p className="text-body-1">{trip.title}</p>
          <p className="tabular text-caption text-fg-muted">
            {trip.startDate} – {trip.endDate} · {formatTripLength(trip.startDate, trip.endDate)} ·{' '}
            {STATUS_LABEL[status]}
            {status === 'upcoming' && ` · D-${dDay}`}
            {status === 'ongoing' &&
              ` · ${dayNumberOf(trip.startDate, trip.endDate, today) ?? ''}일차`}
          </p>
        </div>
        <IconButton label="여행 삭제" icon={<Trash2 />} onClick={() => void remove()} />
      </div>

      {[...days, null].map((date, i) => {
        const dayItems = items.filter((it) => it.date === date);
        if (date === null && dayItems.length === 0) return null;
        return (
          <div key={date ?? 'wish'} className="flex flex-col gap-1">
            <p className="text-caption font-bold text-fg-sub">
              {date ? `${i + 1}일차 · ${date}` : '가고 싶은 곳'}
            </p>
            {dayItems.length === 0 && <p className="text-caption text-fg-muted">일정 없음</p>}
            {dayItems.map((item, idx) => (
              <ItemRow
                key={item.id}
                item={item}
                index={idx}
                isFirst={idx === 0}
                isLast={idx === dayItems.length - 1}
              />
            ))}
          </div>
        );
      })}
    </section>
  );
}

function ItemRow({
  item,
  index,
  isFirst,
  isLast,
}: {
  item: ItineraryItem;
  index: number;
  isFirst: boolean;
  isLast: boolean;
}) {
  async function remove() {
    await itemRepo.softDelete(item.id);
    snackbar('일정을 삭제했어요', {
      label: '실행 취소',
      onAction: () => void itemRepo.restore(item.id),
    });
  }
  return (
    <div className="flex items-center gap-1 rounded-lg bg-bg-subtle py-1 pr-1 pl-3">
      <span className="tabular w-11 text-caption text-fg-sub">{item.startTime ?? '—'}</span>
      <span className="min-w-0 flex-1 truncate text-body-2">{item.title}</span>
      <code className="text-micro text-fg-muted">{item.order}</code>
      <IconButton
        label="위로"
        icon={<ArrowUp />}
        disabled={isFirst}
        onClick={() => void itemRepo.move(item.id, item.date, index - 1)}
      />
      <IconButton
        label="아래로"
        icon={<ArrowDown />}
        disabled={isLast}
        onClick={() => void itemRepo.move(item.id, item.date, index + 1)}
      />
      <IconButton label="일정 삭제" icon={<Trash2 />} onClick={() => void remove()} />
    </div>
  );
}
