import { useSettings } from '../../data/settingsStore';
import { formatTime } from '../lib/dateFormat';

/**
 * 설정(시간 표기)에 맞춘 시간 글자. wide = 12시간 표기라 시간 칸을 넓혀야 함
 * 사용: const { time, wide } = useTimeText(); time(item.startTime) ?? '—'
 */
export function useTimeText() {
  const format = useSettings((s) => s.timeFormat);
  return {
    time: (value: string | undefined) => (value ? formatTime(value, format) : undefined),
    wide: format === '12h',
  };
}
