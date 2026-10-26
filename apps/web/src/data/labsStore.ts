import { create } from 'zustand';

/**
 * 실험실 (마이 → 실험실): 정식으로 넣기 전에 시험해 보는 기능의 켜기/끄기.
 * 이 기기에만 저장 (동기화·백업 대상 아님). 새 실험은 LABS에 id를 더하고 i18n `labs.item.<id>`를 쓴다.
 * 정식 기능이 되면 LABS에서 빼고 useLab 호출을 지운다 (docs/code-map.md §3)
 */
export const LABS = [
  'legDistance',
  'wakeLock',
  // 2026-10-26 새 실험 (현지 시각·꾹 눌러 편집·밀어 날짜 넘기기·시트 높이·당겨서 동기화·화면 전환은 이날 정식 기능으로)
  'dayProgress',
  'tightGap',
  'copyDay',
  // 2026-10-26 저녁 (사용자 선택)
  'emergency',
  'visitLog',
  'departure',
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
