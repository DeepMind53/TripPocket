import { ChevronRight } from 'lucide-react';
import { useTranslation } from '../../i18n';
import { updateSettings, useSettings } from '../../data/settingsStore';
import {
  directionApps,
  directionsLink,
  openMapLink,
  type Destination,
} from '../../shared/lib/directions';
import { SegmentedControl } from '../../shared/ui';
import { MapAppMark } from './MapAppMark';

/** 이동 방법 × 지도 앱 (길찾기 시트·숙소 상세에서 함께 씀). 출발지 = 현재 위치(지도 앱이 처리) */
export function DirectionsPanel({
  destination,
  isDomestic,
}: {
  destination: Destination;
  isDomestic: boolean;
}) {
  const { t } = useTranslation();
  const mode = useSettings((st) => st.travelMode);
  const appName = window.location.hostname;
  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-2">
        <span className="text-caption font-semibold text-fg-sub">{t('dir.mode')}</span>
        <SegmentedControl
          label={t('dir.mode')}
          value={mode}
          onChange={(m) => updateSettings({ travelMode: m })}
          options={[
            { value: 'transit', label: t('dir.transit') },
            { value: 'walk', label: t('dir.walk') },
            { value: 'car', label: t('dir.car') },
          ]}
        />
      </div>
      <ul className="flex flex-col divide-y divide-line overflow-hidden rounded-card border border-line">
        {directionApps(isDomestic).map((app) => {
          const link = directionsLink(app, mode, destination, appName);
          return (
            <li key={app}>
              <a
                href={link.web}
                target="_blank"
                rel="noopener noreferrer"
                onClick={(e) => {
                  e.preventDefault();
                  openMapLink(link);
                }}
                className="flex min-h-14 items-center gap-3 bg-surface px-4"
              >
                <MapAppMark app={app} />
                <span className="flex-1 text-body-2 font-medium">
                  {t('dir.openWith', { app: t(`dir.${app}`) })}
                </span>
                <ChevronRight aria-hidden="true" className="size-5 text-fg-muted" />
              </a>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
