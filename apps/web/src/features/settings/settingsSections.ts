import { PLAN_FEATURE_GROUPS, type PlanFeature } from '@trippocket/shared';
import { PLAN_LABELS } from './planLabels';

/**
 * 설정 첫 화면의 묶음 (사용자 요청 2026-11-14 "설정이 너무 길다" → 첫 화면은 묶음 목록, 누르면 그 묶음만).
 * items = 검색에 쓰는 항목 이름(i18n 키). 화면에 보이는 이름과 같아야 찾은 항목을 강조할 수 있다
 */
export type SectionHead = 'basic' | 'plan' | 'tools' | 'account';

export interface SettingsSection {
  id: string;
  head: SectionHead;
  /** 묶음 이름 (i18n 키) */
  title: string;
  items: readonly string[];
  /** 일정 기능 묶음이면 켜고 끄는 항목 (첫 화면에 "N개 중 M개 켜짐") */
  plan?: readonly PlanFeature[];
  /** 로그인했을 때만 */
  signedIn?: boolean;
}

const planGroup = (id: string) => PLAN_FEATURE_GROUPS.find((g) => g.id === id)?.keys ?? [];

const planSection = (id: string, extra: readonly string[] = []): SettingsSection => {
  const keys = planGroup(id);
  return {
    id,
    head: 'plan',
    title: `settings.planGroup.${id}`,
    items: [...extra, ...keys.map((k) => PLAN_LABELS[k])],
    plan: keys,
  };
};

export const SETTINGS_SECTIONS: readonly SettingsSection[] = [
  {
    id: 'display',
    head: 'basic',
    title: 'settings.startDisplay',
    items: [
      'settings.startScreen',
      'settings.dateFormat',
      'settings.quickButton',
      'settings.theme',
      'settings.fontScale',
      'settings.timeFormat',
      'settings.haptics',
    ],
  },
  {
    id: 'maps',
    head: 'basic',
    title: 'settings.maps',
    items: ['settings.directionsApp', 'settings.domesticMap', 'settings.travelMode'],
  },
  // 일정 시간 간격은 "일정 · 화면" 맨 위
  planSection('view', ['settings.timeStep']),
  planSection('notice'),
  planSection('local'),
  planSection('quick'),
  {
    id: 'ai',
    head: 'tools',
    title: 'settings.ai',
    items: ['settings.aiAnchor', 'settings.aiCats'],
  },
  { id: 'fx', head: 'tools', title: 'settings.fx', items: ['settings.fxFee'] },
  { id: 'push', head: 'account', title: 'push.title', items: ['push.all'] },
  {
    id: 'privacy',
    head: 'account',
    title: 'settings.privacy',
    items: ['settings.hideNickname'],
    signedIn: true,
  },
  {
    id: 'data',
    head: 'account',
    title: 'settings.data',
    items: [
      'deviceData.title',
      'deviceData.pastDocs',
      'deviceData.passport',
      'deviceData.reviewQueue',
      'settings.backupReminder',
    ],
  },
  { id: 'language', head: 'account', title: 'settings.language', items: [] },
];

export const SECTION_HEADS: readonly SectionHead[] = ['basic', 'plan', 'tools', 'account'];

export const sectionById = (id: string | undefined) => SETTINGS_SECTIONS.find((s) => s.id === id);

const norm = (s: string) => s.toLowerCase().replace(/\s+/g, '');

/**
 * 설정 검색 (기기 안에서만): 이름에 검색어가 들어 있는 항목만.
 * 맞는 항목이 없고 묶음 이름이 맞으면 그 묶음 자체를
 */
export function searchSettings(
  query: string,
  sections: readonly SettingsSection[],
  label: (key: string) => string,
): { section: SettingsSection; label: string | null }[] {
  const q = norm(query);
  if (!q) return [];
  const out: { section: SettingsSection; label: string | null }[] = [];
  for (const s of sections) {
    const hits = s.items.map(label).filter((l) => norm(l).includes(q));
    if (hits.length) for (const l of hits) out.push({ section: s, label: l });
    else if (norm(label(s.title)).includes(q)) out.push({ section: s, label: null });
  }
  return out;
}
