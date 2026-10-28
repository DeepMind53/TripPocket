import type { Trip } from '@trippocket/shared';
import { useLab } from '../../data/labsStore';
import { tapWater } from '../../domain/localInfo';
import { tripCountries } from '../../domain/tripPlace';
import { useTranslation } from '../../i18n';

const countryName = (cc: string) => {
  try {
    return new Intl.DisplayNames(['ko'], { type: 'region' }).of(cc) ?? cc;
  } catch {
    return cc;
  }
};

const KEY = { ok: 'labs.tapWaterOk', boil: 'labs.tapWaterBoil', no: 'labs.tapWaterNo' } as const;

/** 실험실 "수돗물 안내" (2026-10-28, 트리플 참고): 준비 탭 위에 여행 나라마다 한 줄 */
export function TapWaterLine({ trip }: { trip: Trip }) {
  const { t } = useTranslation();
  const on = useLab('tapWater');
  if (!on) return null;
  const rows = tripCountries(trip)
    .filter((c) => c !== 'KR')
    .flatMap((c) => {
      const w = tapWater(c);
      return w ? [{ c, w }] : [];
    });
  if (!rows.length) return null;
  return (
    <ul className="flex flex-col gap-1">
      {rows.map(({ c, w }) => (
        <li
          key={c}
          className={`rounded-card px-4 py-2.5 text-caption whitespace-pre-line ${w === 'ok' ? 'bg-bg-subtle text-fg-sub' : 'bg-warning/10 text-fg-sub'}`}
        >
          {t(KEY[w], { country: countryName(c) })}
        </li>
      ))}
    </ul>
  );
}
