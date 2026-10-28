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
  | 'airportArrive'
  | 'localHoliday'
  | 'overlapWarn'
  | 'goldenHour'
  | 'plugInfo'
  | 'tripProgress'
  | 'memoChecklist'
  | 'lateNight'
  | 'fxLine'
  | 'luggageGap';

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
  'airportArrive',
  'localHoliday',
  'overlapWarn',
  'goldenHour',
  'plugInfo',
  'tripProgress',
  'memoChecklist',
  'lateNight',
  'fxLine',
  'luggageGap',
];

export const hasPreview = (id: string): id is PreviewId => IDS.includes(id);
