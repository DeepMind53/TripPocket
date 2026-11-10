/** [샘플]이 있는 기능 (설정 "일정" 항목·실험실) */
export type PreviewId =
  | 'dimPastItems'
  | 'planMapOpen'
  | 'sunTimes'
  | 'legDistance'
  | 'compactList'
  | 'nearbyWish'
  | 'checkoutNotice'
  | 'dayRecap'
  | 'nowScroll'
  | 'weatherMark'
  | 'jetLag'
  | 'localHoliday'
  | 'lateNight'
  | 'transitGuide'
  | 'nearbyFind'
  | 'arrivalRoute'
  | 'missingStay'
  | 'offlineReady'
  | 'placeTips'
  | 'airQuality'
  | 'cityIntro'
  | 'planB'
  | 'safetyNotice'
  | 'festivals'
  | 'flightDelay'
  | 'travelMode'
  | 'tripMode'
  | 'lodgingPrice'
  | 'dayMiniMap'
  | 'nextStopDayColor'
  | 'stampImage'
  | 'sunsetDark'
  | 'dayNote'
  | 'tripRouteMap'
  | 'tripCard';

const IDS: readonly string[] = [
  'dimPastItems',
  'planMapOpen',
  'sunTimes',
  'legDistance',
  'compactList',
  'nearbyWish',
  'checkoutNotice',
  'dayRecap',
  'nowScroll',
  'weatherMark',
  'jetLag',
  'localHoliday',
  'lateNight',
  'transitGuide',
  'nearbyFind',
  'arrivalRoute',
  'missingStay',
  'offlineReady',
  'placeTips',
  'airQuality',
  'cityIntro',
  'planB',
  'safetyNotice',
  'festivals',
  'flightDelay',
  'travelMode',
  'tripMode',
  'lodgingPrice',
  'dayMiniMap',
  'nextStopDayColor',
  'stampImage',
  'sunsetDark',
  'dayNote',
  'tripRouteMap',
  'tripCard',
];

export const hasPreview = (id: string): id is PreviewId => IDS.includes(id);
