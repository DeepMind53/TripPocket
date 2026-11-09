import {
  LODGING_TAGS,
  POPULAR_CURRENCIES,
  type LodgingReportInput,
  type LodgingSite,
  type LodgingTag,
} from '@trippocket/shared';
import { useState } from 'react';
import type { ReportQuery } from '../../data/api/lodging';
import { saveReport, type ReportsResult } from '../../data/lodgingReports';
import type { StayQuery } from '../../domain/lodgingLinks';
import { nightsBetween } from '@trippocket/shared';
import { useTranslation } from '../../i18n';
import { formatMonthDay } from '../../shared/lib/dateFormat';
import { countUse } from '../../shared/lib/usageCount';
import { BottomSheet, Button, CancelSaveRow, Chip, SegmentedControl, toast } from '../../shared/ui';

const inputClass =
  'h-12 w-full min-w-0 rounded-btn border border-line bg-bg-subtle px-3 text-body-1 outline-none focus:border-primary';

export interface ReportTarget {
  site: LodgingSite;
  route?: string | undefined;
  /** "아고다 · 신한카드" */
  label: string;
}

/**
 * 가격 적기 (docs/28 §6.3): 본 가격 · 1박/총액 · 세금 · 칩. 자유 글 없음.
 * 저장은 버튼을 누를 때 한 번만 (저장 중 잠금, 자동 재시도 없음)
 */
export function ReportFormSheet({
  open,
  onOpenChange,
  target,
  stay,
  hotel,
  query,
  onSaved,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  target: ReportTarget | null;
  stay: StayQuery;
  hotel: { key: string; name: string };
  query: ReportQuery;
  onSaved: (reports: Extract<ReportsResult, { ok: true }>['reports']) => void;
}) {
  const { t } = useTranslation();
  const [price, setPrice] = useState('');
  const [currency, setCurrency] = useState('KRW');
  const [priceType, setPriceType] = useState<LodgingReportInput['priceType']>('nightly');
  const [tax, setTax] = useState<LodgingReportInput['tax']>('incl');
  const [tags, setTags] = useState<LodgingTag[]>([]);
  const [busy, setBusy] = useState(false);
  const [wasOpen, setWasOpen] = useState(open);
  // 열 때마다 빈 칸에서 시작
  if (open !== wasOpen) {
    setWasOpen(open);
    if (open) {
      setPrice('');
      setTags([]);
    }
  }
  const amount = Number(price.replaceAll(',', ''));
  const valid = Number.isInteger(amount) && amount > 0 && amount <= 1_000_000_000;
  const nights = stay.checkOut > stay.checkIn ? nightsBetween(stay.checkIn, stay.checkOut) : 1;

  const save = async () => {
    if (!target || !valid || busy) return;
    setBusy(true);
    const res = await saveReport(
      {
        hotelKey: hotel.key,
        hotelName: hotel.name,
        checkIn: stay.checkIn,
        nights,
        adults: stay.adults,
        rooms: stay.rooms,
        site: target.site,
        ...(target.route ? { route: target.route } : {}),
        price: amount,
        priceType,
        currency,
        tax,
        tags,
      },
      query,
    );
    setBusy(false);
    if (res.ok) {
      countUse('lodgingPrice.report');
      toast(t('lodgingPrice.report.saved'));
      onSaved(res.reports);
      onOpenChange(false);
    } else toast(t(`lodgingPrice.report.fail.${res.reason}`));
  };

  return (
    <BottomSheet
      open={open}
      onOpenChange={onOpenChange}
      title={t('lodgingPrice.report.title', { name: target?.label ?? '' })}
      footer={
        <CancelSaveRow onCancel={() => onOpenChange(false)}>
          <Button size="lg" fullWidth disabled={!valid || busy} onClick={() => void save()}>
            {busy ? t('lodgingPrice.report.saving') : t('form.save')}
          </Button>
        </CancelSaveRow>
      }
    >
      <div className="flex flex-col gap-3 pb-2">
        <p className="tabular text-caption text-fg-sub">
          {t('lodgingPrice.report.stay', {
            from: formatMonthDay(stay.checkIn),
            to: formatMonthDay(stay.checkOut),
            nights,
            adults: stay.adults,
          })}
        </p>
        <div className="grid grid-cols-[minmax(0,1fr)_6.5rem] gap-2">
          <label className="flex min-w-0 flex-col gap-1.5">
            <span className="text-caption font-semibold text-fg-sub">
              {t('lodgingPrice.report.price')}
            </span>
            <input
              value={price}
              inputMode="numeric"
              autoComplete="off"
              placeholder="121300"
              onChange={(e) => setPrice(e.target.value.replace(/[^\d,]/g, ''))}
              className={`${inputClass} tabular`}
            />
          </label>
          <label className="flex min-w-0 flex-col gap-1.5">
            <span className="text-caption font-semibold text-fg-sub">
              {t('lodgingPrice.report.currency')}
            </span>
            <select
              value={currency}
              onChange={(e) => setCurrency(e.target.value)}
              className={`${inputClass} px-2`}
            >
              {['KRW', ...POPULAR_CURRENCIES].map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </label>
        </div>
        <SegmentedControl
          label={t('lodgingPrice.report.priceType')}
          value={priceType}
          onChange={setPriceType}
          options={[
            { value: 'nightly', label: t('lodgingPrice.report.nightly') },
            { value: 'total', label: t('lodgingPrice.report.total') },
          ]}
        />
        <SegmentedControl
          label={t('lodgingPrice.report.tax')}
          value={tax}
          onChange={setTax}
          options={[
            { value: 'incl', label: t('lodgingPrice.report.taxIncl') },
            { value: 'excl', label: t('lodgingPrice.report.taxExcl') },
            { value: 'unknown', label: t('lodgingPrice.report.taxUnknown') },
          ]}
        />
        <div
          className="flex flex-wrap gap-2"
          role="group"
          aria-label={t('lodgingPrice.report.tags')}
        >
          {LODGING_TAGS.map((tag) => (
            <Chip
              key={tag}
              selected={tags.includes(tag)}
              onClick={() =>
                setTags((cur) => (cur.includes(tag) ? cur.filter((x) => x !== tag) : [...cur, tag]))
              }
            >
              {t(`lodgingPrice.tag.${tag}`)}
            </Chip>
          ))}
        </div>
        <p className="text-caption whitespace-pre-line text-fg-muted">
          {t('lodgingPrice.report.public')}
        </p>
      </div>
    </BottomSheet>
  );
}
