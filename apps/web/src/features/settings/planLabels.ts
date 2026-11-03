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
} as const satisfies Record<PlanFeature, string>;
