import { useLiveQuery } from 'dexie-react-hooks';
import { ExternalLink, FileText, Image as ImageIcon } from 'lucide-react';
import { Link } from 'react-router';
import { attachmentRepo } from '../../data/repositories/attachmentRepo';
import { openBlob } from '../../shared/lib/openBlob';
import { IconButton } from '../../shared/ui';
import { useTrip, useTripBookings } from '../../data/hooks';
import { useSettings } from '../../data/settingsStore';
import { arrivalToStay, voucherBookings } from '../../domain/localInfo';
import { tripCountries } from '../../domain/tripPlace';
import { cityLocalFor } from '../../data/cityLocal';
import { transitGuideFor, type CountryTransit } from '../../data/transitGuide';
import { t as tr, useTranslation, type TKey } from '../../i18n';
import { formatMonthDay } from '../../shared/lib/dateFormat';
import { ArrivalRoute } from './ArrivalRoute';
import { NearbyFind } from './NearbyFind';
import { TransitCardList } from './TransitCardList';
import { TransitGuide } from './TransitGuide';

const countryName = (cc: string) => {
  try {
    return new Intl.DisplayNames(['ko'], { type: 'region' }).of(cc) ?? cc;
  } catch {
    return cc;
  }
};

interface LocalGroup {
  key: string;
  name: string;
  title: string;
  country: string;
  card: string | null;
  cards?: readonly string[] | undefined;
  pay: string | null;
  guide?: CountryTransit;
  /** 나라 대표 정보 (참고용) */
  reference?: true;
}

/** 나라별 문구 (없으면 null) */
const localText = (group: 'transit' | 'pay', cc: string): string | null => {
  const key = `localInfo.${group}.${cc}` as TKey;
  const text = tr(key);
  return text === key ? null : text;
};

/**
 * 빠른 메뉴 "현지 생활 정보" (실험실 3차, 2026-10-28 — 트리플·마이리얼트립 참고):
 * 교통카드·결제 팁(여행 나라 참고 정보), 바우처 링크 모아보기
 * + 실험실 (2026-11-03): 대중교통 안내·근처 찾기·공항 → 숙소 길찾기
 * + 도시별 (2026-11-03): 등록한 도시가 한국인이 많이 찾는 도시면 그 도시 정보, 아니면 나라 대표 정보(참고용)
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
  const guideOn = useSettings((s) => s.transitGuide);
  const nearbyOn = useSettings((s) => s.nearbyFind);
  const arrivalOn = useSettings((s) => s.arrivalRoute);
  if (!trip || (!transitOn && !payOn && !voucherOn)) return null;
  const all = tripCountries(trip);
  const countries = all.filter((c) => c !== 'KR');
  const arrival = arrivalOn ? arrivalToStay(bookings) : null;
  // 목적지마다: 한국인이 많이 찾는 도시면 그 도시 정보, 아니면 나라 대표 정보(참고용) — 같은 도시·나라는 한 번 (2026-11-03)
  const groups: LocalGroup[] = [];
  const seen = new Set<string>();
  for (const d of trip.destinations) {
    const cc = d.countryCode;
    const city = cityLocalFor(d);
    const key = city ? `city:${city.id}` : cc && cc !== 'KR' ? `cc:${cc}` : null;
    if (!key || seen.has(key)) continue;
    seen.add(key);
    if (city) {
      groups.push({
        key,
        name: city.name,
        title: t('localInfo.cityTitle', { name: city.name }),
        country: city.country,
        card: city.card,
        cards: city.cards,
        pay: city.pay,
        guide: city,
      });
    } else if (cc) {
      const card = transitOn ? localText('transit', cc) : null;
      const pay = payOn ? localText('pay', cc) : null;
      if (card || pay || transitGuideFor(cc))
        groups.push({
          key,
          name: countryName(cc),
          title: t('localInfo.countryTitle', { name: countryName(cc) }),
          country: cc,
          card,
          pay,
          reference: true,
        });
    }
  }
  // 국내 여행 대중교통 안내는 서울 기준 (도시 정보가 없을 때)
  if (guideOn && !groups.length && all.includes('KR'))
    groups.push({
      key: 'cc:KR',
      name: countryName('KR'),
      title: t('localInfo.countryTitle', { name: countryName('KR') }),
      country: 'KR',
      card: null,
      pay: null,
      reference: true,
    });
  const vouchers = voucherOn
    ? voucherBookings(bookings, new Set(docs.filter((d) => d.blob).map((d) => d.bookingId)))
    : [];
  if (!groups.length && !vouchers.length && !nearbyOn && !arrival) return null;
  return (
    <section className="flex flex-col gap-2">
      <h3 className="text-caption font-bold text-fg-muted">{t('labs.localTitle')}</h3>
      {groups.map((g) => (
        <div key={g.key} className="flex flex-col gap-1.5">
          <span className="flex items-baseline gap-1.5 text-caption font-bold">
            {g.title}
            {g.reference && (
              <span className="text-micro font-normal text-fg-muted">
                {t('localInfo.reference')}
              </span>
            )}
          </span>
          {/* 대중교통 안내(실험실)는 교통카드 위에 (사용자 요청 2026-11-03) */}
          {guideOn && <TransitGuide country={g.country} guide={g.guide} label={g.name} />}
          {g.card && (
            <div className="flex flex-col rounded-card bg-bg-subtle px-3 py-2.5 text-caption whitespace-pre-line text-fg-sub">
              <span className="font-semibold text-fg">{t('labs.transitLabel')}</span>
              {g.card}
              <TransitCardList country={g.country} ids={g.cards} />
            </div>
          )}
          {g.pay && (
            <p className="flex flex-col rounded-card bg-bg-subtle px-3 py-2.5 text-caption whitespace-pre-line text-fg-sub">
              <span className="font-semibold text-fg">{t('labs.payLabel')}</span>
              {g.pay}
            </p>
          )}
        </div>
      ))}
      {arrival && <ArrivalRoute route={arrival} />}
      {nearbyOn && <NearbyFind domestic={countries.length === 0} />}
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
