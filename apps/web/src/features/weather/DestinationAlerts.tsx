import {
  flagEmoji,
  MOFA_SAFETY_URL,
  warningLinkFor,
  type DestinationAlert,
} from '@trippocket/shared';
import { ExternalLink } from 'lucide-react';
import { useEffect, useState } from 'react';
import { fetchAlerts, type AlertsResult } from '../../data/api/alerts';
import { useTranslation } from '../../i18n';
import { cn } from '../../shared/lib/cn';

/**
 * 날씨 정보 화면 맨 위 "여행지 특이사항" (docs/24 §2, ADR-0008, 1단계):
 * GDACS·USGS·외교부 특보 + 나라마다 그 나라 기상청 공식 특보 링크(모르는 나라는 WMO).
 * 공식 출처 내용을 옮기기만 한다 — 자체 판단 문구 없음 (docs/24 §5)
 */
export function DestinationAlerts({
  countries,
  points = [],
}: {
  countries: readonly string[];
  /** 일본·미국 목적지 도시 좌표 "JP:35.7:139.7" */
  points?: readonly string[];
}) {
  const { t } = useTranslation();
  const key = [...new Set(countries)].sort().join(',');
  const pointKey = [...new Set(points)].sort().join(',');
  const fetchKey = `${key}|${pointKey}`;
  const [result, setResult] = useState<{ key: string; value: AlertsResult | null } | null>(null);

  useEffect(() => {
    if (!key) return;
    let alive = true;
    void fetchAlerts(key.split(','), pointKey ? pointKey.split(',') : []).then((value) => {
      if (alive) setResult({ key: fetchKey, value });
    });
    return () => {
      alive = false;
    };
  }, [key, pointKey, fetchKey]);

  if (!key) return null;
  const current = result && result.key === fetchKey ? result : undefined;
  const data = current?.value?.data;
  const many = key.includes(',');

  return (
    <section aria-label={t('alerts.title')} className="flex flex-col gap-2">
      <h2 className="text-caption font-bold text-fg-muted">{t('alerts.title')}</h2>
      <div className="flex flex-col gap-2 rounded-card border border-line p-3">
        {!current ? (
          <p className="text-caption text-fg-muted">{t('alerts.loading')}</p>
        ) : !data ? (
          <p className="text-caption whitespace-pre-line text-fg-muted">{t('alerts.offline')}</p>
        ) : data.alerts.length === 0 ? (
          <p className="text-body-2">{t('alerts.none')}</p>
        ) : (
          <ul className="flex flex-col gap-2">
            {data.alerts.map((a) => (
              <AlertRow key={a.id} alert={a} flag={many} />
            ))}
          </ul>
        )}
        {current?.value?.stale && data && (
          <p className="text-micro text-fg-muted">
            {t('alerts.stale', { time: localHm(data.checkedAt) })}
          </p>
        )}
        {data && data.missing.length > 0 && (
          <p className="text-micro text-fg-muted">{t('alerts.missing')}</p>
        )}
      </div>
      <div className="flex flex-wrap gap-1.5" aria-label={t('alerts.officialTitle')}>
        {key.split(',').map((c) => {
          const link = warningLinkFor(c);
          return (
            <a
              key={c}
              href={link.url}
              target="_blank"
              rel="noreferrer"
              className="inline-flex min-h-9 items-center gap-1 rounded-full border border-line px-3 text-caption"
            >
              {flagEmoji(c)} {link.name}
              <ExternalLink aria-hidden="true" className="size-3 text-fg-muted" />
            </a>
          );
        })}
        <a
          href={MOFA_SAFETY_URL}
          target="_blank"
          rel="noreferrer"
          className="inline-flex min-h-9 items-center gap-1 rounded-full border border-line px-3 text-caption"
        >
          {t('alerts.mofaLink')}
          <ExternalLink aria-hidden="true" className="size-3 text-fg-muted" />
        </a>
      </div>
      <p className="text-micro whitespace-pre-line text-fg-muted">{t('alerts.note')}</p>
    </section>
  );
}

/** ISO 시각 → 이 기기 시각 "HH:mm" */
const localHm = (iso: string) => {
  const d = new Date(iso);
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
};

function AlertRow({ alert: a, flag }: { alert: DestinationAlert; flag: boolean }) {
  const { t } = useTranslation();
  const head =
    a.kind === 'weather'
      ? t('alerts.national', {
          agency: t(`alerts.agency.${a.source}` as 'alerts.agency.kma'),
          names: a.names?.join(' · ') || t('alerts.announced'),
        })
      : a.source === 'mofa'
        ? a.special
          ? t(`alerts.${a.special}`)
          : t('alerts.step', { n: a.step ?? 1 })
        : a.source === 'usgs'
          ? t('alerts.quake', { mag: a.magnitude?.toFixed(1) ?? '' })
          : t('alerts.gdacs', {
              kind: t(`alerts.kind.${a.kind}`),
              level: t(`alerts.level.${a.level}`),
            });
  // 외교부·나라 기상청은 지역 설명(일본은 발표 요약 원문), 그 밖은 원문 이름
  const detail =
    a.source === 'mofa'
      ? a.whole
        ? t('alerts.whole')
        : a.area
      : a.source === 'jma'
        ? a.title
        : a.kind === 'weather'
          ? a.area
          : a.title;
  return (
    <li
      className={cn(
        'flex items-start gap-2 rounded-lg border-l-4 px-2 py-1.5',
        a.level === 'red'
          ? 'border-danger bg-danger/5'
          : a.level === 'orange'
            ? 'border-warning bg-warning/10'
            : 'border-line bg-bg-subtle',
      )}
    >
      <span className="flex min-w-0 flex-1 flex-col">
        <span className="text-body-2 font-semibold">
          {flag ? `${flagEmoji(a.country)} ` : ''}
          {head}
        </span>
        {detail && <span className="text-caption break-words text-fg-sub">{detail}</span>}
      </span>
      <a
        href={a.url}
        target="_blank"
        rel="noreferrer"
        aria-label={t('alerts.sourceOf', { title: a.title })}
        className="inline-flex min-h-9 shrink-0 items-center gap-0.5 text-caption text-primary"
      >
        {t('alerts.source')}
        <ExternalLink aria-hidden="true" className="size-3" />
      </a>
    </li>
  );
}
