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
