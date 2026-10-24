import { lazy, Suspense, type ComponentType } from 'react';
import type { RadioListProps } from './RadioListImpl';

export type { RadioListOption, RadioListProps } from './RadioListImpl';

// Radix RadioGroup(약 6KB)는 시트 안에서만 쓰므로 그릴 때 불러온다 (첫 화면 크기)
let Loaded: ComponentType<RadioListProps<string>> | null = null;
// eslint-disable-next-line react-refresh/only-export-components -- 미리 받기 함수(시험 준비에서도 씀), 개발 중 새로고침 방식에만 영향
export const preloadRadioList = () =>
  import('./RadioListImpl').then(
    (m) => (Loaded = m.RadioListImpl as ComponentType<RadioListProps<string>>),
  );
const Lazy = lazy(async () => ({ default: await preloadRadioList() }));

/** 세로 라디오 목록 — 실제 구현은 RadioListImpl.tsx */
export function RadioList<T extends string>(props: RadioListProps<T>) {
  const p = props as unknown as RadioListProps<string>;
  if (Loaded) return <Loaded {...p} />;
  return (
    <Suspense fallback={<div className="min-h-24" />}>
      <Lazy {...p} />
    </Suspense>
  );
}
