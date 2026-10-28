import { ExternalLink } from 'lucide-react';
import { useTrip, useTripBookings } from '../../data/hooks';
import { useLab } from '../../data/labsStore';
import { voucherBookings } from '../../domain/localInfo';
import { tripCountries } from '../../domain/tripPlace';
import { t as tr, useTranslation, type TKey } from '../../i18n';
import { formatMonthDay } from '../../shared/lib/dateFormat';

/** 나라별 문구 (없으면 null) */
const localText = (group: 'transit' | 'pay', cc: string): string | null => {
  const key = `localInfo.${group}.${cc}` as TKey;
  const text = tr(key);
  return text === key ? null : text;
};

/**
 * 빠른 메뉴 "현지 생활 정보" (실험실 3차, 2026-10-28 — 트리플·마이리얼트립 참고):
 * 교통카드·결제 팁(여행 나라 참고 정보), 바우처 링크 모아보기
 */
export function LocalInfoSection({ tripId }: { tripId: string }) {
  const { t } = useTranslation();
  const transitOn = useLab('transitCard');
  const payOn = useLab('payTips');
  const voucherOn = useLab('voucherList');
  const trip = useTrip(tripId);
  const bookings = useTripBookings(tripId) ?? [];
  if (!trip || (!transitOn && !payOn && !voucherOn)) return null;
  const countries = tripCountries(trip).filter((c) => c !== 'KR');
  const rows: { label: string; text: string }[] = [];
  for (const c of countries) {
    const transit = transitOn ? localText('transit', c) : null;
    const pay = payOn ? localText('pay', c) : null;
    if (transit) rows.push({ label: t('labs.transitLabel'), text: transit });
    if (pay) rows.push({ label: t('labs.payLabel'), text: pay });
  }
  const vouchers = voucherOn ? voucherBookings(bookings) : [];
  if (!rows.length && !vouchers.length) return null;
  return (
    <section className="flex flex-col gap-2">
      <h3 className="text-caption font-bold text-fg-muted">{t('labs.localTitle')}</h3>
      {rows.map((r, i) => (
        <p
          key={i}
          className="flex flex-col rounded-card bg-bg-subtle px-3 py-2.5 text-caption text-fg-sub"
        >
          <span className="font-semibold text-fg">{r.label}</span>
          {r.text}
        </p>
      ))}
      {vouchers.length > 0 && (
        <div className="flex flex-col rounded-card bg-bg-subtle px-3 py-2">
          <span className="text-caption font-semibold">{t('labs.voucherTitle')}</span>
          {vouchers.map((b) => (
            <a
              key={b.id}
              href={b.details!.voucherUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="flex min-h-10 items-center gap-2 text-body-2 text-primary"
            >
              <span className="tabular shrink-0 text-caption text-fg-muted">
                {formatMonthDay(b.start.date)}
              </span>
              <span className="min-w-0 flex-1 truncate">{b.title}</span>
              <ExternalLink aria-hidden="true" className="size-3.5 shrink-0" />
            </a>
          ))}
        </div>
      )}
    </section>
  );
}
