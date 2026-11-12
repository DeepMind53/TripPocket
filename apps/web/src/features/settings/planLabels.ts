import type { PlanFeature } from '@trippocket/shared';

/** 설정 "일정"의 켜고 끄는 항목 → 이름 문구 (설정 화면·기능 안내 팝업이 함께 쓴다) */
export const PLAN_LABELS = {
  dimPastItems: 'settings.dimPast',
  planMapOpen: 'settings.planMapOpen',
  sunTimes: 'settings.sunTimes',
  legDistance: 'settings.legDistance',
  compactList: 'settings.compactList',
  nearbyWish: 'settings.nearbyWish',
  checkoutNotice: 'settings.checkoutNotice',
  dayRecap: 'settings.dayRecap',
  nowScroll: 'settings.nowScroll',
  weatherMark: 'settings.weatherMark',
  jetLag: 'settings.jetLag',
  localHoliday: 'settings.localHoliday',
  lateNight: 'settings.lateNight',
  planB: 'settings.planB',
  placeTips: 'settings.placeTips',
  missingStay: 'settings.missingStay',
  airQuality: 'settings.airQuality',
  cityIntro: 'settings.cityIntro',
  transitGuide: 'settings.transitGuide',
  nearbyFind: 'settings.nearbyFind',
  arrivalRoute: 'settings.arrivalRoute',
  // 2026-11-10 실험실에서 정식 — 이름은 실험실에서 쓰던 문구 그대로
  offlineReady: 'labs.item.offlineReady.name',
  safetyNotice: 'labs.item.safetyNotice.name',
  festivals: 'labs.item.festivals.name',
  flightDelay: 'labs.item.flightDelay.name',
  tripMode: 'labs.item.travelMode.name',
  routeMap: 'settings.routeMap',
  // 2026-11-13 실험실에서 정식
  sunsetDark: 'labs.item.sunsetDark.name',
  dayNote: 'labs.item.dayNote.name',
  nextStopDayColor: 'labs.item.nextStopDayColor.name',
} as const satisfies Record<PlanFeature, string>;
