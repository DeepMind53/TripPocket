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
import { useState } from 'react';
import type { WeatherCaution } from '../../domain/weather';
import { useTranslation } from '../../i18n';
import { BottomSheet } from '../../shared/ui';

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

/**
 * 일정 시간 아래 한 줄 — 여러 개면 모두 나란히.
 * 누르면 일정 상세 대신 왜 떴는지·어떻게 하면 좋은지 짧게 보여 준다 (사용자 요청 2026-11-02).
 * 일정 버튼 안에 있어 키보드로는 일정 이름(aria-label)으로 읽히고, 손가락으로 누를 때만 따로 연다
 */
export function CautionIcons({ cautions }: { cautions?: readonly WeatherCaution[] | undefined }) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  if (!cautions?.length) return null;
  return (
    <>
      <span
        role="img"
        aria-label={`${t('weatherCaution.label')}: ${cautions.map((c) => t(`weatherCaution.${c}`)).join(', ')}`}
        data-caution-icons=""
        onClick={(e) => {
          // 일정 상세가 열리지 않게
          e.stopPropagation();
          e.preventDefault();
          setOpen(true);
        }}
        className="mt-1 flex cursor-pointer flex-wrap items-center gap-1"
      >
        {cautions.map((c) => {
          const { Icon, color } = ICON[c];
          return (
            <Icon key={c} aria-hidden="true" strokeWidth={2.4} className={`size-[18px] ${color}`} />
          );
        })}
      </span>
      {open && (
        <span
          // 시트 안을 눌러도 바깥 일정 버튼이 눌리지 않게
          onClick={(e) => e.stopPropagation()}
          className="contents"
        >
          <BottomSheet
            open={open}
            onOpenChange={setOpen}
            title={t('weatherCaution.label')}
            description={t('weatherCaution.sheetDesc')}
            autoFocusInput={false}
          >
            <ul className="flex flex-col gap-3 pb-2">
              {cautions.map((c) => {
                const { Icon, color } = ICON[c];
                return (
                  <li key={c} className="flex items-start gap-3">
                    <Icon
                      aria-hidden="true"
                      strokeWidth={2.4}
                      className={`mt-0.5 size-5 shrink-0 ${color}`}
                    />
                    <span className="flex flex-col">
                      <span className="text-body-2 font-semibold">{t(`weatherCaution.${c}`)}</span>
                      <span className="text-caption whitespace-pre-line text-fg-sub">
                        {t(`weatherCaution.why.${c}`)}
                      </span>
                    </span>
                  </li>
                );
              })}
            </ul>
          </BottomSheet>
        </span>
      )}
    </>
  );
}
