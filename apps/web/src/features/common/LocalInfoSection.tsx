import { useLiveQuery } from 'dexie-react-hooks';
import { ExternalLink, FileText, Image as ImageIcon } from 'lucide-react';
import { Link } from 'react-router';
import { attachmentRepo } from '../../data/repositories/attachmentRepo';
import { openBlob } from '../../shared/lib/openBlob';
import { IconButton } from '../../shared/ui';
import { useTrip, useTripBookings } from '../../data/hooks';
import { voucherBookings } from '../../domain/localInfo';
import { tripCountries } from '../../domain/tripPlace';
import { t as tr, useTranslation, type TKey } from '../../i18n';
import { formatMonthDay } from '../../shared/lib/dateFormat';
import { TransitCardList } from './TransitCardList';

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
  // 교통카드·결제 팁·바우처는 정식 기능 (2026-11-03, 예전 실험실)
  const transitOn = true;
  const payOn = true;
  const voucherOn = true;
  const trip = useTrip(tripId);
  const bookings = useTripBookings(tripId) ?? [];
  // 붙인 예약 문서 (기기에 있는 것)
  const docs = useLiveQuery(() => attachmentRepo.listByTrip(tripId), [tripId]) ?? [];
  if (!trip || (!transitOn && !payOn && !voucherOn)) return null;
  const countries = tripCountries(trip).filter((c) => c !== 'KR');
  const rows: { label: string; text: string; cards?: string }[] = [];
  for (const c of countries) {
    const transit = transitOn ? localText('transit', c) : null;
    const pay = payOn ? localText('pay', c) : null;
    if (transit) rows.push({ label: t('labs.transitLabel'), text: transit, cards: c });
    if (pay) rows.push({ label: t('labs.payLabel'), text: pay });
  }
  const vouchers = voucherOn
    ? voucherBookings(bookings, new Set(docs.filter((d) => d.blob).map((d) => d.bookingId)))
    : [];
  if (!rows.length && !vouchers.length) return null;
  return (
    <section className="flex flex-col gap-2">
      <h3 className="text-caption font-bold text-fg-muted">{t('labs.localTitle')}</h3>
      {rows.map((r, i) => (
        <div
          key={i}
          className="flex flex-col rounded-card bg-bg-subtle px-3 py-2.5 text-caption text-fg-sub"
        >
          <span className="font-semibold text-fg">{r.label}</span>
          {r.text}
          {r.cards && <TransitCardList country={r.cards} />}
        </div>
      ))}
      {vouchers.length > 0 && (
        <div className="flex flex-col rounded-card bg-bg-subtle px-3 py-2">
          <span className="text-caption font-semibold">{t('labs.voucherTitle')}</span>
          {vouchers.map((b) => {
            const doc = docs.find((d) => d.bookingId === b.id && d.blob);
            return (
              <div key={b.id} className="flex min-h-11 items-center gap-1">
                {/* 날짜·시각 — 이름을 누르면 예약 탭의 그 예약으로 (사용자 요청 2026-11-02) */}
                <Link
                  to={`/trips/${tripId}/bookings?focus=${b.id}`}
                  replace
                  className="flex min-w-0 flex-1 items-center gap-2 text-body-2"
                >
                  <span className="tabular shrink-0 text-caption text-fg-muted">
                    {formatMonthDay(b.start.date)}
                    {b.start.time ? ` ${b.start.time}` : ''}
                  </span>
                  <span className="min-w-0 flex-1 truncate font-semibold">{b.title}</span>
                </Link>
                {doc && (
                  <IconButton
                    label={t('labs.voucherDoc', { name: b.title })}
                    icon={doc.mime === 'application/pdf' ? <FileText /> : <ImageIcon />}
                    onClick={() => openBlob(doc.blob)}
                  />
                )}
                {b.details?.voucherUrl && (
                  <a
                    href={b.details.voucherUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    aria-label={t('labs.voucherLink', { name: b.title })}
                    className="grid size-11 shrink-0 place-items-center text-primary"
                  >
                    <ExternalLink aria-hidden="true" className="size-4" />
                  </a>
                )}
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}
