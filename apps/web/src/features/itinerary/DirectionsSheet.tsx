import { ChevronRight } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useSetting } from '../../data/hooks';
import { settingsRepo } from '../../data/repositories/settingsRepo';
import {
  directionsLink,
  openMapLink,
  preferredAppOrder,
  type Destination,
  type MapApp,
  type TravelMode,
} from '../../shared/lib/directions';
import { BottomSheet, SegmentedControl } from '../../shared/ui';

const PREFS_KEY = 'directions';
interface DirectionsPrefs {
  mode: TravelMode;
}

const APP_MARK: Record<MapApp, { bg: string; fg: string; letter: string }> = {
  naver: { bg: '#03C75A', fg: '#FFFFFF', letter: 'N' },
  google: { bg: '#4285F4', fg: '#FFFFFF', letter: 'G' },
  kakao: { bg: '#FEE500', fg: '#191F28', letter: 'K' },
};

export interface DirectionsSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  destination: Destination | null;
  /** 국내 여행이면 네이버를 맨 위에 */
  isDomestic: boolean;
}

/** S-30 길찾기: 이동 방법 × 지도 앱. 출발지 = 현재 위치(지도 앱이 처리) */
export function DirectionsSheet({
  open,
  onOpenChange,
  destination,
  isDomestic,
}: DirectionsSheetProps) {
  const { t } = useTranslation();
  const { mode } = useSetting<DirectionsPrefs>(PREFS_KEY, { mode: 'transit' });
  const appName = window.location.hostname;

  return (
    <BottomSheet
      open={open}
      onOpenChange={onOpenChange}
      title={destination ? t('dir.title', { name: destination.name }) : t('detail.directions')}
      description={t('dir.hint')}
    >
      {destination && (
        <div className="flex flex-col gap-4">
          <div className="flex flex-col gap-2">
            <span className="text-caption font-semibold text-fg-sub">{t('dir.mode')}</span>
            <SegmentedControl
              label={t('dir.mode')}
              value={mode}
              onChange={(m) =>
                void settingsRepo.set(PREFS_KEY, { mode: m } satisfies DirectionsPrefs)
              }
              options={[
                { value: 'transit', label: t('dir.transit') },
                { value: 'walk', label: t('dir.walk') },
                { value: 'car', label: t('dir.car') },
              ]}
            />
          </div>
          <ul className="flex flex-col divide-y divide-line overflow-hidden rounded-card border border-line">
            {preferredAppOrder(isDomestic).map((app) => {
              const link = directionsLink(app, mode, destination, appName);
              const mark = APP_MARK[app];
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
                    <span
                      aria-hidden="true"
                      className="grid size-7 place-items-center rounded-lg text-caption font-extrabold"
                      style={{ background: mark.bg, color: mark.fg }}
                    >
                      {mark.letter}
                    </span>
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
      )}
    </BottomSheet>
  );
}
