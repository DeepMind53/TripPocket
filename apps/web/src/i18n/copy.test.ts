/// <reference types="node" />
import { readFileSync } from 'node:fs';
import ko from './ko.json';

/**
 * 문구 규칙 (docs/20 §1.1): 한 줄 = 한 문장 → 문장 사이는 줄바꿈(\n), 줄 끝 마침표 없음.
 * 새 문구도 이 규칙을 따르게 (어기면 실패)
 */
function strings(o: unknown, path = ''): [string, string][] {
  if (typeof o === 'string') return [[path, o]];
  if (o && typeof o === 'object')
    return Object.entries(o).flatMap(([k, v]) => strings(v, path ? `${path}.${k}` : k));
  return [];
}

const midSentence = /(요|다|세요|니다)\. +\S/;
const trailingPeriod = /(요|다|세요|니다)\.(\n|$)/;

it('ko.json: 문장 사이는 줄바꿈, 줄 끝 마침표 없음', () => {
  const bad = strings(ko).filter(([, s]) => midSentence.test(s) || trailingPeriod.test(s));
  expect(bad.map(([k, s]) => `${k}: ${s}`)).toEqual([]);
});

it('나라별 필수 항목 문구도 같은 규칙', () => {
  const src = readFileSync('../../packages/shared/src/data/essentials.ts', 'utf8');
  const texts = [...src.matchAll(/(?:desc|title): ['`]([^'`]*)['`]/g)].map((m) =>
    m[1]!.replaceAll('\n', '\n'),
  );
  expect(texts.length).toBeGreaterThan(50);
  expect(texts.filter((s) => midSentence.test(s) || trailingPeriod.test(s))).toEqual([]);
});

it('가운뎃점: 같은 종류 묶음은 붙이고, 다른 정보 나열만 띄운다 (docs/31 U7)', () => {
  // 띄운 " · " 양쪽이 모두 짧은 낱말(숫자 없음)이면 묶음 이름 — "일정·화면", "카페·맛집"
  // 예외: 관리자 통계 이름(나라 범위 · 결과 상태는 서로 다른 정보), 현지 정보 한 줄
  const allow = /^stats\.names\.|^localInfo\./;
  const bad = strings(ko).filter(
    ([k, s]) =>
      !allow.test(k) &&
      s.split('\n').some((line) => {
        const parts = line.split(' · ');
        return parts.length > 1 && parts.every((x) => x.length <= 6 && !/[0-9{]/.test(x));
      }),
  );
  expect(bad.map(([k, s]) => `${k}: ${s}`)).toEqual([]);
});
