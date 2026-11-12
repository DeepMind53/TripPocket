import {
  distanceKm,
  walkMinutes,
  type Coords,
  type ItineraryItem,
  type RouteEta,
} from '@trippocket/shared';
import { useEffect, useState } from 'react';
import { routeEtaResult, routeLeftToday } from '../../data/api/routes';
import { legOptions, pickLegMode, type LegMode } from '../../domain/travelDay';
import { useTranslation } from '../../i18n';
import { useCurrentPosition } from '../../shared/hooks/useCurrentPosition';
import { toast } from '../../shared/ui';

type Drive = { key: string; from: Coords; min: number; km: number | undefined } | null;
const sameAt = (a: Coords, b: Coords) => a.lat === b.lat && a.lng === b.lng;

/**
 * 다음 일정까지 이동 (여행 모드·홈 공통, 사용자 요청 2026-11-13 "홈에도 여행 모드와 똑같이"):
 * - 다음 일정 차례가 되면 앞 일정 장소 → 다음 장소를 1번만 자동 조회 (기기에 7일 보관). 실패·한도면 도보 직선거리 어림
 * - [새로고침]은 다음 일정마다 1번 — 지금 위치 → 다음 장소 (위치는 보관하지 않음)
 * - [자동차]는 고를 때만 자동차 시간·거리를 1번 조회 (한 사람 하루 50번 안에서, 서버가 센다)
 */
export function useNextLeg(dayItems: readonly ItineraryItem[], next: ItineraryItem | undefined) {
  const { t } = useTranslation();
  const prev = next?.startTime
    ? [...dayItems]
        .filter((i) => i.place?.coords && i.startTime && i.startTime < next.startTime!)
        .pop()
    : undefined;
  const to = next?.place?.coords;
  const google = next?.place?.coordsSource === 'google' || prev?.place?.coordsSource === 'google';
  const [route, setRoute] = useState<{
    key: string;
    eta: RouteEta | null;
    from: Coords;
    live: boolean;
  } | null>(null);
  const [drive, setDrive] = useState<Drive>(null);
  const [driveBusy, setDriveBusy] = useState(false);
  const [left, setLeft] = useState(routeLeftToday);
  const autoFrom: Coords | undefined = prev?.place?.coords;
  const key = next && to ? next.id : '';
  useEffect(() => {
    if (!key || !autoFrom || !to || route?.key === key) return;
    let alive = true;
    void routeEtaResult(autoFrom, to, google).then((r) => {
      if (!alive) return;
      setRoute({ key, eta: r.eta, from: autoFrom, live: false });
      setLeft(routeLeftToday());
    });
    return () => {
      alive = false;
    };
  }, [key]); // eslint-disable-line react-hooks/exhaustive-deps -- 다음 일정이 바뀔 때만
  const mine = route?.key === key ? route : null;
  const legFrom = mine?.from ?? autoFrom;
  const myDrive =
    drive && drive.key === key && legFrom && sameAt(drive.from, legFrom) ? drive : null;
  const opts = legOptions(
    mine?.eta ?? null,
    legFrom && to ? walkMinutes(distanceKm(legFrom, to)) : undefined,
    myDrive ? { min: myDrive.min, km: myDrive.km } : undefined,
  );
  const [chosen, setChosen] = useState<LegMode | null>(null);
  const mode = pickLegMode(opts, chosen);
  const travelMin =
    mode === 'transit'
      ? opts.transit
      : mode === 'walk'
        ? opts.walk?.min
        : mode === 'drive'
          ? opts.drive?.min
          : undefined;

  const gotDrive = (r: Awaited<ReturnType<typeof routeEtaResult>>, from: Coords) => {
    setDriveBusy(false);
    setLeft(routeLeftToday());
    if (r.limited) toast(t('travel.routeLimit'));
    else if (r.eta?.drive === undefined) toast(t('travel.driveFail'));
    else setDrive({ key, from, min: r.eta.drive, km: r.eta.driveKm });
  };
  const askDrive = (from: Coords, live: boolean) => {
    if (!to) return;
    setDriveBusy(true);
    void routeEtaResult(from, to, google, live, true).then((r) => gotDrive(r, from));
  };
  const onMode = (m: LegMode) => {
    setChosen(m);
    if (m === 'drive' && !myDrive && !driveBusy && legFrom) askDrive(legFrom, !!mine?.live);
  };

  // [새로고침]: 누른 뒤 위치를 받으면 1번만 조회 (자동차를 골랐으면 자동차 길)
  const { state: here, request: askHere } = useCurrentPosition(false);
  const [hereFor, setHereFor] = useState<string | null>(null);
  useEffect(() => {
    if (!hereFor || hereFor !== key || here.status === 'asking' || here.status === 'idle') return;
    if (here.status !== 'ok' || !to) {
      toast(t('travel.hereFail'));
      return;
    }
    const at = here.coords;
    let alive = true;
    if (mode === 'drive') {
      // 자동차를 골랐으면 자동차 길만 (걷기·대중교통은 지금 위치 기준 직선거리 어림)
      void routeEtaResult(at, to, google, true, true).then((r) => {
        if (!alive) return;
        setRoute({ key, eta: null, from: at, live: true });
        gotDrive(r, at);
      });
      return () => {
        alive = false;
      };
    }
    void routeEtaResult(at, to, google, true).then((r) => {
      if (!alive) return;
      setLeft(routeLeftToday());
      if (r.limited) toast(t('travel.routeLimit'));
      else if (!r.eta) toast(t('travel.routeFail'));
      setRoute({ key, eta: r.eta, from: at, live: true });
    });
    return () => {
      alive = false;
    };
  }, [here, hereFor]); // eslint-disable-line react-hooks/exhaustive-deps -- 누름·위치가 바뀔 때만

  // 카드 아래 한 줄: 자동차면 시간·거리, 아니면 도보·대중교통
  const km = (n: number) => (Math.round(n * 10) / 10).toString();
  const note =
    mode === 'drive'
      ? opts.drive
        ? t('travel.etaDrive', {
            min: opts.drive.min,
            km: km(opts.drive.km ?? distanceKm(legFrom!, to!)),
          })
        : driveBusy
          ? t('travel.driveLoading')
          : legFrom && to
            ? t('travel.etaDriveLine', { km: km(distanceKm(legFrom, to)) })
            : undefined
      : (() => {
          const parts = [
            opts.walk &&
              t(opts.walk.straight ? 'travel.etaWalkLine' : 'travel.etaWalk', {
                min: opts.walk.min,
              }),
            opts.transit !== undefined && t('travel.etaTransit', { min: opts.transit }),
          ].filter((x): x is string => typeof x === 'string');
          return parts.length === 0
            ? undefined
            : parts.length === 2
              ? t('travel.etaBoth', { a: parts[0]!, b: parts[1]! })
              : parts[0]!;
        })();

  return {
    /** 좌표가 있어 [도보|대중교통|자동차]·[새로고침]을 보일 수 있는지 */
    hasRoute: !!to,
    opts,
    mode,
    onMode,
    travelMin,
    note: note ? t('travel.etaNote', { text: note }) : undefined,
    left,
    hereDisabled: hereFor === key || left === 0,
    onHere: () => {
      setHereFor(key);
      askHere();
    },
  };
}
