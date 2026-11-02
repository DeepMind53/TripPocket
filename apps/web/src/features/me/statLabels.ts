import ko from '../../i18n/ko.json';
import { t } from '../../i18n';

/**
 * 사용 통계 이름(영문 규칙) → 한국어 (관리자 화면, 2026-11-02 사용자 요청).
 * 이름에 "."·"/"가 들어 있어 t()의 점 경로로는 찾을 수 없으므로 ko.json의 stats.names를 직접 본다.
 * 모르는 이름은 그대로 보여 준다
 */
const N = ko.stats.names;
const pick = (map: Record<string, string>, key: string) => map[key];

export function statLabel(name: string): string {
  if (name.startsWith('screen:')) {
    const path = name.slice(7);
    return pick(N.screens, path) ?? path;
  }
  if (name.startsWith('sheet:')) {
    const key = name.slice(6);
    return `${pick(N.sheets, key) ?? key} (창)`;
  }
  if (name.startsWith('setting.')) return t('stats.names.setting', { key: name.slice(8) });
  const lab = /^lab\.(.+)\.(on|off)$/.exec(name);
  if (lab) return t(lab[2] === 'on' ? 'stats.names.labOn' : 'stats.names.labOff', { id: lab[1]! });
  if (name.startsWith('limit.')) return t('stats.names.limit', { key: name.slice(6) });
  return pick(N.events, name) ?? name;
}

/** 입력·수정·삭제: "trips.create" → "여행 만들기" */
export function dataLabel(name: string): string {
  const [table = '', op = ''] = name.split('.');
  return `${pick(N.tables, table) ?? table} ${pick(N.ops, op) ?? op}`;
}

export const aiLabel = (name: string) => pick(N.ai, name) ?? name;
export const searchLabel = (name: string) => pick(N.search, name) ?? name;
