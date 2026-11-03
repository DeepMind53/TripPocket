import { ChevronDown } from 'lucide-react';
import { useEffect, useState } from 'react';
import { api } from '../../data/api/client';
import { useTranslation } from '../../i18n';

/** 0MB · 12.5MB · 500MB (끝의 .0은 뺀다) */
const formatBytes = (n: number) => `${Number((n / 1024 / 1024).toFixed(1))}MB`;

interface Summary {
  used: number;
  expiring: number;
  limit: number;
  trips: { tripId: string; title: string; used: number; expiring: number; limit: number }[];
}

/**
 * 서버 저장 용량 (사용자 요청 2026-11-04): 예약 문서가 서버에 차지하는 양.
 * 막대 = 빨강(사용) · 연한 빨강(1주일 안에 지워질 것, 사용에 포함) · 파랑(남은 칸).
 * [자세히]를 누르면 여행마다 같은 모양 (여행 한도 250MB)
 */
export function ServerStorage() {
  const { t } = useTranslation();
  const [s, setS] = useState<Summary | null | 'off'>(null);
  const [open, setOpen] = useState(false);
  useEffect(() => {
    let alive = true;
    void api<Summary>('/api/me/storage').then((r) => alive && setS(r.ok ? r.data : 'off'));
    return () => {
      alive = false;
    };
  }, []);

  return (
    <section
      aria-label={t('storage.title')}
      className="flex flex-col gap-3 rounded-2xl border border-line bg-surface p-4"
    >
      <h2 className="text-body-1 font-bold">{t('storage.title')}</h2>
      {s === 'off' ? (
        <p className="text-body-2 whitespace-pre-line text-fg-sub">{t('storage.offline')}</p>
      ) : !s ? (
        <p className="text-body-2 text-fg-muted">{t('common.loading')}</p>
      ) : (
        <>
          <UsageBar
            used={s.used}
            expiring={s.expiring}
            limit={s.limit}
            label={t('storage.account')}
          />
          <p className="text-caption whitespace-pre-line text-fg-muted">{t('storage.hint')}</p>
          {s.trips.length > 0 && (
            <button
              type="button"
              aria-expanded={open}
              onClick={() => setOpen(!open)}
              className="flex h-10 items-center justify-between text-caption font-semibold text-primary"
            >
              {t('storage.byTrip')}
              <ChevronDown
                aria-hidden="true"
                className={`size-4 transition-transform ${open ? 'rotate-180' : ''}`}
              />
            </button>
          )}
          {open && (
            <ul className="flex flex-col gap-3">
              {s.trips.map((tr) => (
                <li key={tr.tripId}>
                  <UsageBar
                    used={tr.used}
                    expiring={tr.expiring}
                    limit={tr.limit}
                    label={tr.title || t('storage.untitled')}
                  />
                </li>
              ))}
            </ul>
          )}
        </>
      )}
    </section>
  );
}

function UsageBar({
  used,
  expiring,
  limit,
  label,
}: {
  used: number;
  expiring: number;
  limit: number;
  label: string;
}) {
  const { t } = useTranslation();
  const pct = (n: number) => `${Math.min(100, (n / limit) * 100)}%`;
  return (
    <div className="flex flex-col gap-1">
      <span className="flex items-baseline justify-between gap-2 text-caption">
        <span className="min-w-0 truncate font-semibold">{label}</span>
        <span className="tabular shrink-0">
          <span className="font-bold text-danger">{formatBytes(used)}</span>
          <span className="text-fg-muted"> / </span>
          <span className="font-bold text-primary">{formatBytes(limit)}</span>
        </span>
      </span>
      <div
        role="meter"
        aria-label={label}
        aria-valuemin={0}
        aria-valuemax={limit}
        aria-valuenow={used}
        aria-valuetext={t('storage.value', { used: formatBytes(used), limit: formatBytes(limit) })}
        className="flex h-3 overflow-hidden rounded-full bg-primary"
      >
        <span className="h-full bg-danger" style={{ width: pct(used - expiring) }} />
        <span className="h-full bg-danger/40" style={{ width: pct(expiring) }} />
      </div>
      {expiring > 0 && (
        <span className="tabular text-micro text-fg-muted">
          <span aria-hidden="true" className="mr-1 inline-block size-2 rounded-full bg-danger/40" />
          {t('storage.expiring', { size: formatBytes(expiring) })}
        </span>
      )}
    </div>
  );
}
