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
  | 'leftDrive'
  | 'tapWater'
  | 'transitCard'
  | 'payTips'
  | 'leaveDays'
  | 'firstCountry'
  | 'cancelReminder'
  | 'onsitePay'
  | 'voucherList'
  | 'earlyStart';

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
  'leftDrive',
  'tapWater',
  'transitCard',
  'payTips',
  'leaveDays',
  'firstCountry',
  'cancelReminder',
  'onsitePay',
  'voucherList',
  'earlyStart',
];

export const hasPreview = (id: string): id is PreviewId => IDS.includes(id);
