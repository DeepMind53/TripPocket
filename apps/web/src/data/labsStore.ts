import { create } from 'zustand';
import { countUse } from '../shared/lib/usageCount';

/**
 * 실험실 (마이 → 실험실): 정식으로 넣기 전에 시험해 보는 기능의 켜기/끄기.
 * 이 기기에만 저장 (동기화·백업 대상 아님). 새 실험은 LABS에 id를 더하고 i18n `labs.item.<id>`를 쓴다.
 * 정식 기능이 되면 LABS에서 빼고 useLab 호출을 지운다 (docs/code-map.md §3)
 */
export const LABS = [
  'offlineReady',
  // 2026-11-03 무료 API 2·3단계 (docs/26): 외교부 안전공지·국내 축제·행사·항공편 지연
  'safetyNotice',
  'festivals',
  'flightDelay',
  // 2026-11-03 정식(설정 "일정", 사용자 요청): 대중교통 안내·근처 찾기·공항 → 숙소·숙소 없는 밤·장소 맞춤 팁·
  // 미세먼지 안내·여행지 소개·Plan B. 오프라인 준비만 실험실에 남김.
  // 2026-11-03 뺐다(사용자 결정): 좌측 통행·수돗물·필요한 연차·처음 가는 나라·무료 취소 마감·현장 결제·이른 출발.
  // 2026-10-28 정식: 현지 공휴일 표시·늦은 귀가 안내(설정 "일정"). 뺐다(사용자 결정): 공항 도착 권장 시각·시간 겹침 경고·
  // 골든아워·콘센트·전압·여행 진행률·메모 체크박스·오늘 환율 한 줄·체크인 전 짐 보관.
  // 2026-10-28 정식: 날씨 주의(예전 '비 오는 날 야외 일정')·시차 안내(설정 "일정").
  // 2026-10-28 뺐다(사용자 결정): 한국 시각 같이 보기·체크인 안내·귀국 전날 안내·하루 걷는 거리·비행 중 남은 시간·
  // 오늘 요약·빈 날에 가고 싶은 곳·팁 계산기·항공권 크게 보기.
  // 2026-10-27 정식으로: 근처 가고 싶은 곳·오늘 체크아웃·하루 돌아보기·지금 일정으로 이동(설정 "일정"),
  // 2026-10-27 정식으로: 다음 장소까지 거리·촘촘히 보기(설정 "일정"), 빠듯한 하루는 뺐다(사용자 요청), 메모 속 외화 → 원화, 숙소까지 거리,
  // 하루 일정 글로 복사·날씨 맞춤 준비물·하루 동선 지도·오늘 일정 진행률·일출·일몰(설정),
  // 방문 기록·긴급 연락처·여행 안 검색·하루 일정 복제·인쇄용 일정표·여행 회고.
  // 출발 시각·빠듯한 일정은 일정 화면 위 "다음 일정" 줄로 합쳐 정식. 화면 켜짐 유지는 뺐다 (사용자 요청)
  // 2026-11-03 정식(빠른 메뉴 "현지 정보"): 교통카드·결제 팁·바우처 모아보기 (사용자 요청)
] as const;
export type LabId = (typeof LABS)[number];

const KEY = 'tp-labs';
/** 한 번 모두 끄기 (사용자 요청 2026-11-03: 샘플 테스트가 전부 켠 것을 모든 기기에서 되돌림) — 값을 바꾸면 다시 한 번 */
const RESET_KEY = 'tp-labs-reset';
const RESET_VERSION = '2026-11-03';

function load(): Partial<Record<LabId, boolean>> {
  try {
    if (localStorage.getItem(RESET_KEY) !== RESET_VERSION) {
      localStorage.removeItem(KEY);
      localStorage.setItem(RESET_KEY, RESET_VERSION);
      return {};
    }
    const v = JSON.parse(localStorage.getItem(KEY) ?? '{}') as Record<string, unknown>;
    return Object.fromEntries(LABS.filter((id) => v[id] === true).map((id) => [id, true]));
  } catch {
    return {};
  }
}

export const useLabs = create<Partial<Record<LabId, boolean>>>(load);

export const useLab = (id: LabId): boolean => useLabs((s) => s[id] === true);

export function setLab(id: LabId, on: boolean, opts: { silent?: boolean } = {}): void {
  useLabs.setState({ [id]: on });
  // 사용자가 직접 켜고 끈 것만 사용 통계로 (샘플이 켠 것은 빼기, 2026-11-02)
  if (!opts.silent) countUse(`lab.${id}.${on ? 'on' : 'off'}`);
  try {
    localStorage.setItem(KEY, JSON.stringify(useLabs.getState()));
  } catch {
    // 저장 못 해도 이번 실행에서는 적용
  }
}
