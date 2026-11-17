import { useCallback, useState } from 'react';

/**
 * 이 기기에만 기억하는 켜짐/꺼짐 값 (접기·펴기 같은 화면 편의용). 서버로 보내지 않는다.
 * 저장소를 못 쓰는 환경(사생활 보호 창 등)이면 기본값으로 동작한다
 */
export function useStoredFlag(key: string, initial: boolean): [boolean, (next: boolean) => void] {
  const [value, setValue] = useState(() => {
    try {
      const v = localStorage.getItem(key);
      return v === null ? initial : v === '1';
    } catch {
      return initial;
    }
  });
  const set = useCallback(
    (next: boolean) => {
      setValue(next);
      try {
        localStorage.setItem(key, next ? '1' : '0');
      } catch {
        // 기억 못 해도 지금 화면에는 반영됨
      }
    },
    [key],
  );
  return [value, set];
}
