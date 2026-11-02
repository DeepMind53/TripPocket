import { describe, expect, it } from 'vitest';
import {
  mergePlanSeen,
  nextPlanPrompt,
  parseSettings,
  PLAN_FEATURES,
  SETTINGS_DEFAULTS,
} from './settings';

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

  it('일정 기능: 처음엔 모두 끔, 옛 설정도 끄고 다시 묻는다, 새 설정은 그대로 (2026-11-02)', () => {
    const fresh = parseSettings(undefined);
    expect(PLAN_FEATURES.every((f) => fresh[f] === false)).toBe(true);
    expect(fresh.planPromptSeen).toEqual([]);
    const old = parseSettings({ sunTimes: true, weatherMark: true, dateFormat: 'korean' });
    expect(old.sunTimes).toBe(false);
    expect(old.weatherMark).toBe(false);
    expect(old.dateFormat).toBe('korean');
    const cur = parseSettings({
      planPromptV: 1,
      sunTimes: true,
      planPromptSeen: ['sunTimes', 'x'],
    });
    expect(cur.sunTimes).toBe(true);
    expect(cur.planPromptSeen).toEqual([]);
  });

  it('기능 안내: 안 물어본 것 중 하나, 다 물었으면 없음, 기록은 합친다', () => {
    expect(nextPlanPrompt(['sunTimes'], () => 0)).toBe('dimPastItems');
    expect(nextPlanPrompt(PLAN_FEATURES)).toBeNull();
    for (let i = 0; i < 20; i++) expect(nextPlanPrompt(['jetLag'])).not.toBe('jetLag');
    expect(mergePlanSeen(['jetLag'], ['jetLag', 'sunTimes'])).toEqual(['jetLag', 'sunTimes']);
  });

  it('국내 지도: 네이버·카카오·매번 묻기', () => {
    expect(parseSettings({ domesticMap: 'ask' }).domesticMap).toBe('ask');
    expect(parseSettings({ domesticMap: 'google' }).domesticMap).toBe('naver');
  });

  it('백업 알림은 0(끄기) 또는 7일 단위 56일까지', () => {
    expect(parseSettings({ backupReminderDays: 0 }).backupReminderDays).toBe(0);
    expect(parseSettings({ backupReminderDays: 10 }).backupReminderDays).toBe(14);
    expect(parseSettings({ backupReminderDays: 63 }).backupReminderDays).toBe(14);
  });
});
