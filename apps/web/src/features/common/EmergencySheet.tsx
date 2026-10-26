import {
  CONSULAR_CALL_CENTER,
  EMERGENCY_CHECKED_AT,
  MOFA_SAFETY_URL,
  emergencyFor,
  flagEmoji,
  telHref,
} from '@trippocket/shared';
import { ExternalLink, Phone } from 'lucide-react';
import { useTranslation } from '../../i18n';
import { BottomSheet } from '../../shared/ui';

/** 나라 이름 (기기 글꼴·데이터 없이 브라우저가 아는 이름) */
function countryName(code: string): string {
  try {
    return new Intl.DisplayNames(['ko'], { type: 'region' }).of(code) ?? code;
  } catch {
    return code;
  }
}

/**
 * 실험실 "긴급 연락처 카드" (사용자 요청 2026-10-26): 여행 나라의 경찰·구급 번호와 영사안전콜센터.
 * 앱에 들어 있는 자료라 오프라인에서도 보이고, 누르면 바로 전화가 걸린다
 */
export function EmergencySheet({
  open,
  onOpenChange,
  countries,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** 여행 나라 코드 (중복 없이) */
  countries: readonly string[];
}) {
  const { t } = useTranslation();
  const abroad = countries.filter((c) => c !== 'KR');
  return (
    <BottomSheet open={open} onOpenChange={onOpenChange} title={t('emergency.title')}>
      <div className="flex flex-col gap-4">
        {countries.map((code) => {
          const data = emergencyFor(code);
          return (
            <section key={code} className="flex flex-col gap-2">
              <h3 className="text-body-1 font-bold">
                <span aria-hidden="true">{flagEmoji(code)} </span>
                {countryName(code)}
              </h3>
              {data ? (
                <ul className="grid grid-cols-2 gap-2">
                  {data.lines.map((l) => (
                    <li
                      key={`${l.kind}-${l.number}`}
                      className={l.kind === 'visitor' || l.kind === 'embassy' ? 'col-span-2' : ''}
                    >
                      <a
                        href={telHref(l.number)}
                        className="flex min-h-14 items-center gap-2 rounded-card border border-line bg-surface px-3 py-2"
                      >
                        <Phone aria-hidden="true" className="size-4 shrink-0 text-danger" />
                        <span className="flex min-w-0 flex-col">
                          <span className="text-caption text-fg-sub">
                            {t(`emergency.kind.${l.kind}`)}
                          </span>
                          <span className="tabular text-body-1 font-bold">{l.number}</span>
                          {l.note && (
                            <span className="text-micro text-fg-muted">
                              {t(`emergency.note.${l.note}`)}
                            </span>
                          )}
                        </span>
                      </a>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-body-2 text-fg-sub">{t('emergency.unknown')}</p>
              )}
            </section>
          );
        })}
        {(abroad.length > 0 || countries.length === 0) && (
          <section className="flex flex-col gap-2">
            <h3 className="text-body-1 font-bold">{t('emergency.consularTitle')}</h3>
            <a
              href={telHref(CONSULAR_CALL_CENTER)}
              className="flex min-h-14 items-center gap-2 rounded-card bg-primary-weak px-3 py-2"
            >
              <Phone aria-hidden="true" className="size-4 shrink-0 text-primary" />
              <span className="flex min-w-0 flex-col">
                <span className="tabular text-body-1 font-bold">{CONSULAR_CALL_CENTER}</span>
                <span className="text-micro text-fg-sub">{t('emergency.consularDesc')}</span>
              </span>
            </a>
            <a
              href={MOFA_SAFETY_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1 text-caption font-semibold text-primary"
            >
              {t('emergency.mofa')}
              <ExternalLink aria-hidden="true" className="size-3.5" />
            </a>
          </section>
        )}
        <p className="text-micro text-fg-muted">
          {t('emergency.checked', { date: EMERGENCY_CHECKED_AT })}
        </p>
      </div>
    </BottomSheet>
  );
}
