import { create } from 'zustand';

/**
 * 실험실 (마이 → 실험실): 정식으로 넣기 전에 시험해 보는 기능의 켜기/끄기.
 * 이 기기에만 저장 (동기화·백업 대상 아님). 새 실험은 LABS에 id를 더하고 i18n `labs.item.<id>`를 쓴다.
 * 정식 기능이 되면 LABS에서 빼고 useLab 호출을 지운다 (docs/code-map.md §3)
 */
export const LABS = [
  // 2026-10-28 새 실험 10개 (TripIt·Kayak·Google 여행·Wanderlog·Polarsteps·트리플·Citymapper 참고)
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
  // 2026-10-28 정식: 날씨 주의(예전 '비 오는 날 야외 일정')·시차 안내(설정 "일정").
  // 2026-10-28 뺐다(사용자 결정): 한국 시각 같이 보기·체크인 안내·귀국 전날 안내·하루 걷는 거리·비행 중 남은 시간·
  // 오늘 요약·빈 날에 가고 싶은 곳·팁 계산기·항공권 크게 보기.
  // 2026-10-27 정식으로: 근처 가고 싶은 곳·오늘 체크아웃·하루 돌아보기·지금 일정으로 이동(설정 "일정"),
  // 2026-10-27 정식으로: 다음 장소까지 거리·촘촘히 보기(설정 "일정"), 빠듯한 하루는 뺐다(사용자 요청), 메모 속 외화 → 원화, 숙소까지 거리,
  // 하루 일정 글로 복사·날씨 맞춤 준비물·하루 동선 지도·오늘 일정 진행률·일출·일몰(설정),
  // 방문 기록·긴급 연락처·여행 안 검색·하루 일정 복제·인쇄용 일정표·여행 회고.
  // 출발 시각·빠듯한 일정은 일정 화면 위 "다음 일정" 줄로 합쳐 정식. 화면 켜짐 유지는 뺐다 (사용자 요청)
] as const;
export type LabId = (typeof LABS)[number];

const KEY = 'tp-labs';

function load(): Partial<Record<LabId, boolean>> {
  try {
    const v = JSON.parse(localStorage.getItem(KEY) ?? '{}') as Record<string, unknown>;
    return Object.fromEntries(LABS.filter((id) => v[id] === true).map((id) => [id, true]));
  } catch {
    return {};
  }
}

const useLabs = create<Partial<Record<LabId, boolean>>>(load);

export const useLab = (id: LabId): boolean => useLabs((s) => s[id] === true);

export function setLab(id: LabId, on: boolean): void {
  useLabs.setState({ [id]: on });
  try {
    localStorage.setItem(KEY, JSON.stringify(useLabs.getState()));
  } catch {
    // 저장 못 해도 이번 실행에서는 적용
  }
}
