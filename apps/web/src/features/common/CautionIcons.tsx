import {
  CloudFog,
  CloudLightning,
  Shirt,
  Snowflake,
  ThermometerSnowflake,
  ThermometerSun,
  Umbrella,
  type LucideIcon,
} from 'lucide-react';
import type { WeatherCaution } from '../../domain/weather';
import { useTranslation } from '../../i18n';

/** 날씨 주의 그림: 사진 같은 이모지 대신 작은 선 그림 + 종류별 색 (사용자 요청 2026-10-28) */
const ICON: Record<WeatherCaution, { Icon: LucideIcon; color: string }> = {
  rain: { Icon: Umbrella, color: 'text-primary' },
  storm: { Icon: CloudLightning, color: 'text-warning' },
  snow: { Icon: Snowflake, color: 'text-sky-500' },
  fog: { Icon: CloudFog, color: 'text-fg-muted' },
  cold: { Icon: Shirt, color: 'text-indigo-500' },
  freezing: { Icon: ThermometerSnowflake, color: 'text-sky-600' },
  hot: { Icon: ThermometerSun, color: 'text-danger' },
};

/** 일정 시간 아래 한 줄 — 여러 개면 모두 나란히 */
export function CautionIcons({ cautions }: { cautions?: readonly WeatherCaution[] | undefined }) {
  const { t } = useTranslation();
  if (!cautions?.length) return null;
  return (
    <span
      role="img"
      aria-label={`${t('weatherCaution.label')}: ${cautions.map((c) => t(`weatherCaution.${c}`)).join(', ')}`}
      className="mt-0.5 flex items-center gap-0.5"
    >
      {cautions.map((c) => {
        const { Icon, color } = ICON[c];
        return (
          <Icon key={c} aria-hidden="true" strokeWidth={2.2} className={`size-3.5 ${color}`} />
        );
      })}
    </span>
  );
}
