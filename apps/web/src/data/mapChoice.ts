import { create } from 'zustand';
import { useSettings } from './settingsStore';

type DomesticMap = 'naver' | 'kakao';

/** "매번 묻기"에서 이번 접속에 고른 지도. 메모리에만 두어 다음 접속 때 다시 묻는다 (사용자 요청 2026-11-02) */
const useChoice = create<{ choice: DomesticMap | null }>(() => ({ choice: null }));

export const chooseDomesticMap = (choice: DomesticMap): void => useChoice.setState({ choice });

/** 시험용 */
export const resetDomesticMapChoice = (): void => useChoice.setState({ choice: null });

/** 쓸 국내 지도. 아직 물어봐야 하면 null */
export function useDomesticMap(): DomesticMap | null {
  const setting = useSettings((s) => s.domesticMap);
  const choice = useChoice((s) => s.choice);
  return setting === 'ask' ? choice : setting;
}
