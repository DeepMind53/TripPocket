import { describe, expect, it } from 'vitest';
import { parseSettings, SETTINGS_DEFAULTS } from './settings';

describe('설정 검사', () => {
  it('비어 있으면 기본값', () => {
    expect(parseSettings(undefined)).toEqual(SETTINGS_DEFAULTS);
  });

  it('잘못된 항목만 기본값으로, 나머지는 유지', () => {
    const s = parseSettings({
      theme: 'dark',
      fontScale: 2,
      timeStepMin: 7,
      backupReminderDays: 21,
      haptics: 'yes',
      unknown: 1,
    });
    expect(s.theme).toBe('dark');
    expect(s.fontScale).toBe(1);
    expect(s.timeStepMin).toBe(15);
    expect(s.backupReminderDays).toBe(21);
    expect(s.haptics).toBe(true);
    expect('unknown' in s).toBe(false);
  });

  it('백업 알림은 0(끄기) 또는 7일 단위 56일까지', () => {
    expect(parseSettings({ backupReminderDays: 0 }).backupReminderDays).toBe(0);
    expect(parseSettings({ backupReminderDays: 10 }).backupReminderDays).toBe(14);
    expect(parseSettings({ backupReminderDays: 63 }).backupReminderDays).toBe(14);
  });
});
