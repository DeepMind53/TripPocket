import type { ItineraryItem } from '@trippocket/shared';
import {
  ArrowDown,
  ArrowUp,
  CalendarArrowUp,
  Copy,
  ExternalLink,
  MapPinned,
  Navigation,
  Pencil,
  Trash2,
} from 'lucide-react';
import type { ReactNode } from 'react';
import { useTranslation } from '../../i18n';
import { placeLink, openMapLink, type MapApp } from '../../shared/lib/directions';
import { BottomSheet, Button, Switch, toast } from '../../shared/ui';
import { KIND_ICON } from './itemKinds';

export interface ItemDetailSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  item: ItineraryItem | undefined;
  /** "N일차 · 10.25 (토)" 또는 "가고 싶은 곳" */
  dayLabel: string;
  /** 여행 중일 때만 "다녀왔어요" 표시 */
  showDone: boolean;
  /** 지도에서 보기에 쓸 앱 (국내=네이버, 해외=구글) */
  mapApp: MapApp;
  onDirections: () => void;
  onEdit: () => void;
  onMoveDay: () => void;
  onDelete: () => void;
  onToggleDone: (done: boolean) => void;
  /** 같은 날 안에서의 위치 (1부터) */
  position: number;
  total: number;
  onMoveUp: () => void;
  onMoveDown: () => void;
}

/** S-12 일정 상세 */
export function ItemDetailSheet({
  open,
  onOpenChange,
  item,
  dayLabel,
  showDone,
  mapApp,
  onDirections,
  onEdit,
  onMoveDay,
  onDelete,
  onToggleDone,
  position,
  total,
  onMoveUp,
  onMoveDown,
}: ItemDetailSheetProps) {
  const { t } = useTranslation();
  const address = item?.place?.address;

  async function copyAddress() {
    if (!address) return;
    try {
      await navigator.clipboard.writeText(address);
      toast(t('detail.addressCopied'));
    } catch {
      toast(t('common.copyFailed'));
    }
  }

  const Icon = item ? KIND_ICON[item.kind] : null;
  const time = item?.startTime
    ? `${item.startTime}${item.endTime ? ` – ${item.endTime}` : ''}`
    : null;
  const dest = item ? { name: item.title, address, coords: item.place?.coords } : null;

  return (
    <BottomSheet
      open={open}
      onOpenChange={onOpenChange}
      title={item?.title ?? ''}
      description={dayLabel}
    >
      {item && Icon && dest && (
        <div className="flex flex-col gap-5">
          <p className="tabular flex items-center gap-2 text-body-2 text-fg-sub">
            <Icon aria-hidden="true" className="size-4" />
            {t(`kind.${item.kind}`)}
            {time && ` · ${time}`}
          </p>

          <div className="grid grid-cols-4 gap-2">
            <Action
              icon={<Navigation />}
              label={t('detail.directions')}
              onClick={onDirections}
              primary
            />
            <Action
              icon={<Copy />}
              label={t('detail.copyAddress')}
              onClick={() => void copyAddress()}
              disabled={!address}
            />
            <Action
              icon={<MapPinned />}
              label={t('detail.viewOnMap')}
              onClick={() => openMapLink(placeLink(mapApp, dest, window.location.hostname))}
            />
            <Action icon={<Pencil />} label={t('detail.edit')} onClick={onEdit} />
          </div>

          <dl className="flex flex-col gap-3 text-body-2">
            <Info label={t('form.address')}>
              {address ?? <span className="text-fg-muted">{t('detail.noAddress')}</span>}
            </Info>
            {item.memo && <Info label={t('form.memo')}>{item.memo}</Info>}
            {item.url && (
              <Info label={t('form.url')}>
                <a
                  href={item.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 font-semibold text-primary"
                >
                  {t('detail.openLink')}
                  <ExternalLink aria-hidden="true" className="size-4" />
                </a>
              </Info>
            )}
          </dl>

          {total > 1 && (
            <div className="flex items-center gap-2 rounded-card bg-bg-subtle py-1 pr-1 pl-4">
              <span className="flex-1 text-body-2 font-medium">
                {t('detail.order')}
                <span className="tabular ml-2 text-caption text-fg-muted" aria-live="polite">
                  {t('detail.position', { n: position, total })}
                </span>
              </span>
              <Button
                size="sm"
                variant="ghost"
                disabled={position <= 1}
                onClick={onMoveUp}
                leading={<ArrowUp aria-hidden="true" className="size-4" />}
              >
                {t('detail.moveUp')}
              </Button>
              <Button
                size="sm"
                variant="ghost"
                disabled={position >= total}
                onClick={onMoveDown}
                leading={<ArrowDown aria-hidden="true" className="size-4" />}
              >
                {t('detail.moveDown')}
              </Button>
            </div>
          )}

          {showDone && (
            <div className="flex items-center justify-between rounded-card bg-bg-subtle px-4 py-3">
              <label htmlFor="item-done" className="text-body-2 font-medium">
                {t('detail.done')}
              </label>
              <Switch id="item-done" checked={item.done ?? false} onCheckedChange={onToggleDone} />
            </div>
          )}

          <div className="grid grid-cols-2 gap-2">
            <Button
              variant="secondary"
              leading={<CalendarArrowUp aria-hidden="true" className="size-4" />}
              onClick={onMoveDay}
            >
              {t('detail.moveDay')}
            </Button>
            <Button
              variant="secondary"
              className="text-danger"
              leading={<Trash2 aria-hidden="true" className="size-4" />}
              onClick={onDelete}
            >
              {t('detail.delete')}
            </Button>
          </div>
        </div>
      )}
    </BottomSheet>
  );
}

function Action({
  icon,
  label,
  onClick,
  primary = false,
  disabled = false,
}: {
  icon: ReactNode;
  label: string;
  onClick: () => void;
  primary?: boolean;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className="flex flex-col items-center gap-1.5 rounded-btn py-2 text-micro text-fg-sub disabled:opacity-40"
    >
      <span
        aria-hidden="true"
        className={`grid size-11 place-items-center rounded-full [&>svg]:size-5 ${primary ? 'bg-primary text-on-primary' : 'bg-bg-subtle text-fg'}`}
      >
        {icon}
      </span>
      {label}
    </button>
  );
}

function Info({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex flex-col gap-0.5">
      <dt className="text-caption font-semibold text-fg-muted">{label}</dt>
      <dd className="m-0 whitespace-pre-wrap">{children}</dd>
    </div>
  );
}
