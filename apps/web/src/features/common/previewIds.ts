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
  | 'nowScroll';

export const hasPreview = (id: string): id is PreviewId =>
  [
    'dimPastItems',
    'planMapOpen',
    'sunTimes',
    'legDistance',
    'compactList',
    'nearbyWish',
    'checkoutNotice',
    'dayRecap',
    'nowScroll',
  ].includes(id);
