import {
  distanceKm,
  walkMinutes,
  type Coords,
  type ItineraryItem,
  type RouteEta,
} from '@trippocket/shared';
import {
  Car,
  Check,
  ChevronDown,
  Footprints,
  LocateFixed,
  RotateCw,
  TrainFront,
} from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { routeEtaResult } from '../../data/api/routes';
import { FAR_LEG_KM } from '../../domain/dayTools';
import { leaveAt, type LegMode } from '../../domain/travelDay';
import { useTranslation } from '../../i18n';
import { useCurrentPosition } from '../../shared/hooks/useCurrentPosition';
import { cn } from '../../shared/lib/cn';
import { BottomSheet } from '../../shared/ui';
import { toast } from '../../shared/ui/toastStore';

/** 이보다 오래 걸으면 도보로 가는 길이 아니다 → "도보 검색 불가" */
const MAX_WALK_MIN = 200;

const MODES = [
  { mode: 'walk', label: 'travel.modeWalk', Icon: Footprints },
  { mode: 'transit', label: 'travel.modeTransit', Icon: TrainFront },
  { mode: 'drive', label: 'travel.modeDrive', Icon: Car },
] as const;

interface Found {
  /** 어느 다음 일정의 결과인지 (다음 일정이 바뀌면 다시 눌러야 한다) */
  nextId: string;
  /** 몇 번째 위치 읽기의 결과인지 */
  press: number;
  here: Coords;
  /** 비행기로 건너갈 만큼 멀다 → 시간을 묻지 않았다 */
  far: boolean;
  /** 도보·대중교통 조회 결과 (undefined = 아직 안 물음, null = 실패) */
  eta?: RouteEta | null | undefined;
  /** 자동차 조회 결과 (undefined = 아직 안 물음, null = 실패) */
  drive?: { min: number; km: number | undefined } | null | undefined;
}

/**
 * 일정 화면 지도·편집 사이 "다음 목적지" (사용자 요청 2026-10-27, 2026-11-14 수단 고르기):
 * [다음 목적지 이동시간] → [도보|대중교통|자동차] 창 → 고른 수단으로 지금 위치에서 시간과 "N분 후 출발".
 * 홈·여행 모드 다음 일정 카드와 같은 방식. 길 찾기는 누를 때만 (자동·반복 검색은 API 낭비 — 2026-10-27),
 * 수단을 바꾸면 이미 받은 결과를 다시 쓰고, 없을 때만 1번 더 묻는다. 위치는 누를 때만 읽고 화면에서만 쓴다
 */
export function NextStopBar({ next, now }: { next: ItineraryItem; now: string }) {
  const { t } = useTranslation();
  const { state, request } = useCurrentPosition(false);
  const [sheet, setSheet] = useState(false);
  const [mode, setMode] = useState<LegMode | null>(null);
  // 몇 번째 누름인지 + 그때의 다음 일정 (다음 일정이 바뀌면 다시 눌러야 한다)
  const [pressed, setPressed] = useState<{ press: number; nextId: string } | null>(null);
  const press = pressed?.press ?? 0;
  // 조회 결과 (key = 다음 일정:누름)
  const [got, setGot] = useState<{ key: string; eta?: RouteEta | null; drive?: Found['drive'] }>({
    key: '',
  });
  const asked = useRef(new Set<string>());
  const to = next.place?.coords;
  const google = next.place?.coordsSource === 'google';
  // 누른 뒤 위치를 받으면 그 위치로. 비행기로 건너가야 할 만큼 멀면(다른 나라 등) 묻지 않는다
  // (2026-10-27: 한국에서 일본 샘플 도보 19909분)
  const key = pressed ? `${pressed.nextId}:${pressed.press}` : '';
  const current: Found | null =
    pressed && pressed.nextId === next.id && state.status === 'ok' && to
      ? {
          nextId: next.id,
          press,
          here: state.coords,
          far: distanceKm(state.coords, to) > FAR_LEG_KM,
          ...(got.key === key ? { eta: got.eta, drive: got.drive } : {}),
        }
      : null;

  // 위치를 못 받으면 알려 주고 다시 누를 수 있게
  const failed = press > 0 && (state.status === 'denied' || state.status === 'unavailable');
  useEffect(() => {
    if (failed) toast(t(state.status === 'denied' ? 'nextStop.denied' : 'nextStop.noFix'));
  }, [failed]); // eslint-disable-line react-hooks/exhaustive-deps -- 실패할 때 한 번

  // 고른 수단의 결과가 없으면 1번만 묻는다 (여행 모드와 같은 하루 50번 한도, 서버가 센다)
  const isDrive = mode === 'drive';
  const need =
    !!current && !current.far && !!mode && (isDrive ? current.drive : current.eta) === undefined;
  useEffect(() => {
    if (!need || !current || !to) return;
    const k = `${key}:${isDrive ? 'drive' : 'leg'}`;
    if (asked.current.has(k)) return;
    asked.current.add(k);
    void routeEtaResult(current.here, to, google, true, isDrive).then((r) => {
      if (r.limited) toast(t('travel.routeLimit'));
      else if (isDrive && r.eta?.drive === undefined) toast(t('travel.driveFail'));
      setGot((g) => {
        const base = g.key === key ? g : { key };
        return isDrive
          ? {
              ...base,
              drive: r.eta?.drive !== undefined ? { min: r.eta.drive, km: r.eta.driveKm } : null,
            }
          : { ...base, eta: r.eta };
      });
    });
  }, [need, mode, current?.press, current?.nextId]); // eslint-disable-line react-hooks/exhaustive-deps -- 결과가 비었을 때만

  if (!to) return null;
  const search = () => {
    setPressed({ press: press + 1, nextId: next.id });
    request();
  };
  const choose = (m: LegMode) => {
    setMode(m);
    setSheet(false);
    // 이미 지금 위치를 받았으면 그 위치로 (수단만 바꿀 때 위치를 다시 묻지 않는다)
    if (!current) search();
  };
  const locating = pressed?.nextId === next.id && !current && !failed;
  const loading = locating || need;

  const picker = (
    <BottomSheet open={sheet} onOpenChange={setSheet} title={t('travel.legGroup')}>
      <div role="radiogroup" aria-label={t('travel.legGroup')} className="flex flex-col gap-2 pb-2">
        {MODES.map(({ mode: m, label, Icon }) => (
          <button
            key={m}
            type="button"
            role="radio"
            aria-checked={mode === m}
            onClick={() => choose(m)}
            className={cn(
              'flex h-14 items-center gap-3 rounded-btn border px-4 text-body-1 font-medium',
              mode === m ? 'border-primary text-primary' : 'border-line',
            )}
          >
            <Icon aria-hidden="true" className="size-5 shrink-0" />
            <span className="flex-1 text-left">{t(label)}</span>
            {mode === m && <Check aria-hidden="true" className="size-5 shrink-0" />}
          </button>
        ))}
      </div>
    </BottomSheet>
  );

  // 아직 안 눌렀거나 다음 일정이 바뀜: [다음 목적지 이동시간]만
  if (!current || !mode)
    return (
      <>
        <button
          type="button"
          onClick={() => setSheet(true)}
          disabled={loading}
          aria-haspopup="dialog"
          className="flex min-h-9 shrink-0 items-center gap-1 rounded-full border border-primary/40 px-3 text-micro font-semibold text-primary disabled:opacity-60"
        >
          <LocateFixed aria-hidden="true" className="size-3.5" />
          {loading ? t('nextStop.loading') : t('nextStop.search')}
        </button>
        {picker}
      </>
    );

  const again = (
    <button
      type="button"
      onClick={search}
      disabled={loading}
      aria-label={t('nextStop.again')}
      title={t('nextStop.again')}
      className="grid size-9 shrink-0 place-items-center rounded-full text-fg-muted disabled:opacity-60"
    >
      <RotateCw aria-hidden="true" className={cn('size-4', loading && 'animate-spin')} />
    </button>
  );

  if (current.far)
    return (
      <div role="status" className="flex min-w-0 items-center gap-1 text-micro leading-tight">
        <span className="min-w-0 truncate text-fg-muted">{t('nextStop.far')}</span>
        {again}
      </div>
    );

  // 고른 수단 하나만 (홈·여행 모드와 같이). 받지 못하면 직선거리 어림, 길이 없으면 "검색 불가" + 지도 앱
  const km = (n: number) => (Math.round(n * 10) / 10).toString();
  const straightKm = distanceKm(current.here, to);
  let line: string;
  let travelMin: number | undefined;
  let mapMode: string | null = null;
  if (need) line = isDrive ? t('travel.driveLoading') : t('nextStop.loading');
  else if (mode === 'drive') {
    if (current.drive) {
      travelMin = current.drive.min;
      line = t('travel.etaDrive', { min: travelMin, km: km(current.drive.km ?? straightKm) });
    } else {
      line = t('travel.etaDriveLine', { km: km(straightKm) });
      mapMode = 'driving';
    }
  } else if (mode === 'transit') {
    travelMin = current.eta?.transit;
    if (travelMin !== undefined) line = t('travel.etaTransit', { min: travelMin });
    else {
      line = t('nextStop.transitNone');
      mapMode = 'transit';
    }
  } else {
    // 길 정보가 없거나 도보가 빠졌으면(한국은 Google 도보 없음) 직선거리 어림
    const straight = current.eta?.walk === undefined;
    const walk = current.eta?.walk ?? walkMinutes(straightKm);
    if (walk < MAX_WALK_MIN) {
      travelMin = walk;
      line = t(straight ? 'travel.etaWalkLine' : 'travel.etaWalk', { min: walk });
    } else {
      line = t('nextStop.walkNone');
      mapMode = 'walking';
    }
  }
  // 출발지는 넣지 않는다 (지도 앱이 현재 위치를 씀)
  const mapUrl = `https://www.google.com/maps/dir/?api=1&destination=${to.lat},${to.lng}&travelmode=${mapMode}`;

  // 홈·여행 모드처럼 "1시간 52분 후 출발" (일정 시작 − 이동 − 여유 10분)
  const leave =
    travelMin !== undefined && next.startTime ? leaveAt(next.startTime, now, travelMin) : null;
  const leaveText = !leave
    ? null
    : leave.inMin <= 0
      ? t('travel.leaveNow')
      : `${
          leave.inMin >= 60
            ? t('travel.departInH', { h: Math.floor(leave.inMin / 60), m: leave.inMin % 60 })
            : t('travel.departInM', { m: leave.inMin })
        } ${t('travel.departSuffix')}`;

  return (
    <div role="status" className="flex min-w-0 items-center gap-1 text-micro leading-tight">
      <span className="flex min-w-0 flex-col items-center">
        <button
          type="button"
          onClick={() => setSheet(true)}
          aria-haspopup="dialog"
          aria-label={`${t('travel.legGroup')} · ${line}`}
          className="flex min-h-6 max-w-full items-center gap-0.5 text-fg-sub"
        >
          <span className="truncate">{line}</span>
          <ChevronDown aria-hidden="true" className="size-3 shrink-0" />
        </button>
        {leaveText && (
          <span
            className={cn(
              'font-semibold whitespace-nowrap',
              leave!.inMin <= 0 ? 'text-warning' : 'text-primary',
            )}
          >
            {leaveText}
          </span>
        )}
        {mapMode && (
          <a
            href={mapUrl}
            target="_blank"
            rel="noreferrer"
            className="text-primary underline underline-offset-2"
          >
            {t('nextStop.map')}
          </a>
        )}
      </span>
      {again}
      {picker}
    </div>
  );
}
