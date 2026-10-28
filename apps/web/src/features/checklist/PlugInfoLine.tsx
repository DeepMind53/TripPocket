import type { Trip } from '@trippocket/shared';
import { useLab } from '../../data/labsStore';
import { plugInfo } from '../../domain/travelExtras';
import { tripCountries } from '../../domain/tripPlace';
import { useTranslation } from '../../i18n';

const countryName = (cc: string) => {
  try {
    return new Intl.DisplayNames(['ko'], { type: 'region' }).of(cc) ?? cc;
  } catch {
    return cc;
  }
};

/** 실험실 "콘센트·전압 안내" (2026-10-28, 트리플 참고): 준비 탭 위에 여행 나라마다 한 줄 */
export function PlugInfoLine({ trip }: { trip: Trip }) {
  const { t } = useTranslation();
  const on = useLab('plugInfo');
  if (!on) return null;
  const rows = tripCountries(trip)
    .filter((c) => c !== 'KR')
    .flatMap((c) => {
      const p = plugInfo(c);
      return p ? [{ c, p }] : [];
    });
  if (!rows.length) return null;
  return (
    <ul className="flex flex-col gap-1">
      {rows.map(({ c, p }) => (
        <li
          key={c}
          className="flex flex-col rounded-card bg-bg-subtle px-4 py-2.5 text-caption text-fg-sub"
        >
          <span className="font-semibold text-fg">
            {t('labs.plug', { country: countryName(c), types: p.types, volt: p.volt })}
          </span>
          <span className={p.adapter ? 'text-warning' : ''}>
            {t(p.adapter ? 'labs.plugAdapter' : 'labs.plugOk')}
          </span>
          {p.lowVolt && <span className="text-warning">{t('labs.plugLowVolt')}</span>}
        </li>
      ))}
    </ul>
  );
}
