import {
  dayNumberOf,
  getTripDays,
  getTripStatus,
  todayIn,
  type ItineraryItem,
  type LocalDate,
  type Trip,
} from '@trippocket/shared';
import { ArrowDownWideNarrow, Check, Ellipsis, Plus } from 'lucide-react';
import { lazy, Suspense, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate, useParams, useSearchParams } from 'react-router';
import { useTrip, useTripItems } from '../../data/hooks';
import { itemRepo } from '../../data/repositories/itemRepo';
import { useRouteSheet } from '../../shared/hooks/useRouteSheet';
import { cn } from '../../shared/lib/cn';
import { formatMonthDay } from '../../shared/lib/dateFormat';
import { sortByTimeKeepingUntimed } from '../../domain/schedule';
import { BottomSheet, Button, Chip, IconButton, snackbar, toast } from '../../shared/ui';
import { DirectionsSheet } from './DirectionsSheet';
import { ItemDetailSheet } from './ItemDetailSheet';
import { ItemFormSheet } from './ItemFormSheet';
import { dayColor, KIND_ICON } from './itemKinds';
import { MoveDaySheet } from './MoveDaySheet';

// 드래그 편집은 편집 모드에 들어갈 때만 불러온다 (dnd-kit 포함)
const EditModeList = lazy(() => import('./EditModeList'));

/** 화면에 보여줄 날: 'all' | 'wish' | 일차 번호(1부터) */
type DayFilter = 'all' | 'wish' | number;

/**
 * S-10 일정 (목록). 지도는 17단계에서 위쪽에 붙는다.
 * Day 칩은 주소(?day=)에 반영하되 히스토리는 쌓지 않는다.
 */
export function PlanPage() {
  const { tripId = '' } = useParams();
  const trip = useTrip(tripId);
  const items = useTripItems(tripId);
  if (!trip || !items) return null;
  return <PlanView trip={trip} items={items} />;
}

function PlanView({ trip, items }: { trip: Trip; items: ItineraryItem[] }) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [params, setParams] = useSearchParams();
  const days = getTripDays(trip.startDate, trip.endDate);
  const today = todayIn(trip.timezone);
  const ongoing = getTripStatus(trip.startDate, trip.endDate, today) === 'ongoing';
  const isDomestic = trip.timezone === 'Asia/Seoul';

  // 기본: 여행 중이면 오늘, 아니면 전체
  const dayParam = params.get('day');
  const filter: DayFilter =
    dayParam === 'wish'
      ? 'wish'
      : dayParam && Number(dayParam) >= 1 && Number(dayParam) <= days.length
        ? Number(dayParam)
        : dayParam === 'all' || !ongoing
          ? 'all'
          : (dayNumberOf(trip.startDate, trip.endDate, today) ?? 'all');

  const [formOpen, setFormOpen] = useRouteSheet('item-form');
  const [detailOpen, setDetailOpen] = useRouteSheet('item-detail');
  const [dirOpen, setDirOpen] = useRouteSheet('directions');
  const [moveOpen, setMoveOpen] = useRouteSheet('move-day');
  const [editing, setEditing] = useRouteSheet('edit-mode');
  const [dayMenuOpen, setDayMenuOpen] = useRouteSheet('day-menu');
  const [menuDate, setMenuDate] = useState<LocalDate | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [formTarget, setFormTarget] = useState<{ date: LocalDate | null; editing: boolean }>({
    date: null,
    editing: false,
  });

  const selected = items.find((i) => i.id === selectedId);
  const sameDay = selected ? items.filter((i) => i.date === selected.date) : [];
  const position = selected ? sameDay.findIndex((i) => i.id === selected.id) + 1 : 0;
  const selectedDayIndex = selected?.date ? days.indexOf(selected.date) : -1;
  const selectedDayLabel =
    selected?.date && selectedDayIndex >= 0
      ? t('plan.dayHeader', { n: selectedDayIndex + 1, date: formatMonthDay(selected.date) })
      : t('plan.wishlist');

  const sections: Array<{ date: LocalDate | null; index: number }> =
    filter === 'all'
      ? [...days.map((d, i) => ({ date: d, index: i })), { date: null, index: -1 }]
      : filter === 'wish'
        ? [{ date: null, index: -1 }]
        : [{ date: days[filter - 1] as LocalDate, index: filter - 1 }];

  function setFilter(next: DayFilter) {
    setParams({ day: String(next) }, { replace: true });
  }

  function openAdd(date: LocalDate | null) {
    setFormTarget({ date, editing: false });
    setFormOpen(true);
  }

  function openDetail(item: ItineraryItem) {
    setSelectedId(item.id);
    setDetailOpen(true);
  }

  async function remove(item: ItineraryItem) {
    setDetailOpen(false);
    await itemRepo.softDelete(item.id);
    snackbar(t('detail.deleted'), {
      label: t('common.undo'),
      onAction: () => void itemRepo.restore(item.id),
    });
  }

  async function sortDay(date: LocalDate | null) {
    const dayItems = items.filter((i) => i.date === date);
    setDayMenuOpen(false);
    if (dayItems.filter((i) => i.startTime).length < 2) {
      toast(t('plan.sortNeedsTime'));
      return;
    }
    await itemRepo.reorderDay(trip.id, date, sortByTimeKeepingUntimed(dayItems));
    toast(t('plan.sorted'));
  }

  const dayTitle = (date: LocalDate | null) => {
    const i = date ? days.indexOf(date) : -1;
    return date
      ? t('plan.dayHeader', { n: i + 1, date: formatMonthDay(date) })
      : t('plan.wishlist');
  };

  async function moveTo(date: LocalDate | null) {
    if (!selected) return;
    const count = items.filter((i) => i.date === date).length;
    await itemRepo.move(selected.id, date, count);
    // 이동 시트와 상세 시트를 함께 닫는다
    void navigate(-2);
    toast(t('move.moved'));
  }

  return (
    <div className="flex flex-col">
      <div
        role="toolbar"
        aria-label={t('plan.dayChipsLabel')}
        className="sticky top-[calc(env(safe-area-inset-top)+56px)] z-10 flex gap-2 overflow-x-auto bg-bg px-5 py-2"
      >
        <Chip selected={filter === 'all'} onClick={() => setFilter('all')}>
          {t('plan.all')}
        </Chip>
        {days.map((d, i) => (
          <Chip
            key={d}
            selected={filter === i + 1}
            onClick={() => setFilter(i + 1)}
            leading={
              <span
                aria-hidden="true"
                className="size-2 rounded-full"
                style={{ background: dayColor(i) }}
              />
            }
          >
            <span className="tabular">
              {t('plan.dayChip', { n: i + 1, date: d.slice(5).replace('-', '.') })}
            </span>
            {d === today && <span className="sr-only"> · {t('date.today')}</span>}
          </Chip>
        ))}
        <Chip selected={filter === 'wish'} onClick={() => setFilter('wish')}>
          {t('plan.wishlist')}
        </Chip>
      </div>

      <div className="flex items-center justify-between gap-2 px-5 pt-1">
        {editing ? (
          <p className="flex-1 text-caption text-fg-muted">{t('plan.editHint')}</p>
        ) : (
          <span />
        )}
        <Button
          size="sm"
          variant={editing ? 'primary' : 'ghost'}
          disabled={items.length === 0 && !editing}
          onClick={() => setEditing(!editing)}
        >
          {editing ? t('plan.editDone') : t('plan.edit')}
        </Button>
      </div>

      <div className="flex flex-col gap-6 px-5 pt-2">
        {editing ? (
          <Suspense fallback={null}>
            <EditModeList
              sections={sections.map((s) => ({
                ...s,
                color: s.date ? dayColor(s.index) : 'var(--tp-fg-muted)',
              }))}
              items={items}
            />
          </Suspense>
        ) : (
          sections.map(({ date, index }) => (
            <DaySection
              key={date ?? 'wish'}
              date={date}
              index={index}
              items={items.filter((i) => i.date === date)}
              isToday={date === today}
              onAdd={() => openAdd(date)}
              onOpen={openDetail}
              onMenu={() => {
                setMenuDate(date);
                setDayMenuOpen(true);
              }}
              hideWhenEmpty={filter === 'all' && date === null}
            />
          ))
        )}
      </div>

      <BottomSheet
        open={dayMenuOpen}
        onOpenChange={setDayMenuOpen}
        title={t('plan.dayMenu', { day: dayTitle(menuDate) })}
      >
        <button
          type="button"
          onClick={() => void sortDay(menuDate)}
          className="flex w-full items-start gap-3 rounded-btn py-3 text-left"
        >
          <ArrowDownWideNarrow aria-hidden="true" className="mt-0.5 size-5 text-fg-sub" />
          <span className="flex flex-col">
            <span className="text-body-1">{t('plan.sortByTime')}</span>
            <span className="text-caption text-fg-muted">{t('plan.sortByTimeDesc')}</span>
          </span>
        </button>
      </BottomSheet>

      <ItemFormSheet
        open={formOpen}
        onOpenChange={setFormOpen}
        tripId={trip.id}
        date={formTarget.date}
        item={formTarget.editing ? selected : undefined}
      />
      <ItemDetailSheet
        open={detailOpen}
        onOpenChange={setDetailOpen}
        item={selected}
        dayLabel={selectedDayLabel}
        showDone={ongoing}
        mapApp={isDomestic ? 'naver' : 'google'}
        onDirections={() => setDirOpen(true)}
        onEdit={() => {
          setFormTarget({ date: selected?.date ?? null, editing: true });
          setFormOpen(true);
        }}
        onMoveDay={() => setMoveOpen(true)}
        onDelete={() => selected && void remove(selected)}
        onToggleDone={(done) => selected && void itemRepo.update(selected.id, { done })}
        position={position}
        total={sameDay.length}
        // 같은 날 안에서 한 칸씩 (시트는 열어 둔 채 바로 반영)
        onMoveUp={() => selected && void itemRepo.move(selected.id, selected.date, position - 2)}
        onMoveDown={() => selected && void itemRepo.move(selected.id, selected.date, position)}
      />
      <DirectionsSheet
        open={dirOpen}
        onOpenChange={setDirOpen}
        destination={
          selected
            ? {
                name: selected.title,
                address: selected.place?.address,
                coords: selected.place?.coords,
              }
            : null
        }
        isDomestic={isDomestic}
      />
      <MoveDaySheet
        open={moveOpen}
        onOpenChange={setMoveOpen}
        days={days}
        items={items}
        current={selected?.date}
        onPick={(d) => void moveTo(d)}
      />
    </div>
  );
}

function DaySection({
  date,
  index,
  items,
  isToday,
  onAdd,
  onOpen,
  onMenu,
  hideWhenEmpty,
}: {
  date: LocalDate | null;
  index: number;
  items: ItineraryItem[];
  isToday: boolean;
  onAdd: () => void;
  onOpen: (item: ItineraryItem) => void;
  onMenu: () => void;
  hideWhenEmpty: boolean;
}) {
  const { t } = useTranslation();
  if (hideWhenEmpty && items.length === 0) return null;
  const color = date ? dayColor(index) : 'var(--tp-fg-muted)';
  const title = date
    ? t('plan.dayHeader', { n: index + 1, date: formatMonthDay(date) })
    : t('plan.wishlist');

  return (
    <section aria-label={title} className="flex flex-col gap-1">
      <div className="flex items-center gap-2">
        <h2 className="tabular flex flex-1 items-center gap-2 text-title-2">
          {title}
          {isToday && (
            <span className="rounded-full bg-primary-weak px-2 py-0.5 text-micro text-primary">
              {t('date.today')}
            </span>
          )}
        </h2>
        {items.length > 1 && (
          <IconButton
            label={t('plan.dayMenu', { day: title })}
            icon={<Ellipsis />}
            onClick={onMenu}
            className="-mr-2"
          />
        )}
      </div>
      {items.length === 0 && (
        <p className="py-2 text-body-2 text-fg-muted">
          {date ? t('plan.emptyDay') : t('plan.wishEmpty')}
        </p>
      )}
      <ol className="flex flex-col">
        {items.map((item, i) => (
          <ItemRow key={item.id} item={item} n={i + 1} color={color} onOpen={() => onOpen(item)} />
        ))}
      </ol>
      <button
        type="button"
        onClick={onAdd}
        className="mt-1 flex h-11 items-center justify-center gap-1 rounded-btn border border-dashed border-line text-body-2 font-semibold text-fg-sub"
      >
        <Plus aria-hidden="true" className="size-4" />
        {t('plan.addItem')}
      </button>
    </section>
  );
}

function ItemRow({
  item,
  n,
  color,
  onOpen,
}: {
  item: ItineraryItem;
  n: number;
  color: string;
  onOpen: () => void;
}) {
  const { t } = useTranslation();
  const Icon = KIND_ICON[item.kind];
  return (
    <li>
      <button
        type="button"
        onClick={onOpen}
        aria-label={t('plan.itemLabel', { n, title: item.title })}
        className="flex w-full items-start gap-3 rounded-btn py-2.5 text-left active:bg-bg-subtle"
      >
        <span
          aria-hidden="true"
          className="tabular mt-0.5 grid size-6 shrink-0 place-items-center rounded-full text-micro text-white"
          style={{ background: color }}
        >
          {item.done ? <Check className="size-3.5" /> : n}
        </span>
        <span className="tabular w-11 shrink-0 pt-0.5 text-caption text-fg-sub">
          {item.startTime ?? '—'}
        </span>
        <span className={cn('flex min-w-0 flex-1 flex-col', item.done && 'opacity-50')}>
          <span className={cn('text-body-1', item.done && 'line-through')}>{item.title}</span>
          {item.place?.address && (
            <span className="truncate text-caption text-fg-muted">{item.place.address}</span>
          )}
        </span>
        <span className="flex shrink-0 items-center gap-1 rounded-md bg-bg-subtle px-1.5 py-0.5 text-micro text-fg-sub">
          <Icon aria-hidden="true" className="size-3" />
          {t(`kind.${item.kind}`)}
        </span>
      </button>
    </li>
  );
}
