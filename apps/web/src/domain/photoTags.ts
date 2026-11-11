/**
 * 사진 분류 (실험실 photoLabels, 2026-11-11): Google이 붙인 영어 이름 → 기록 탭 묶음.
 * 점수가 높은 이름부터 보고 처음 맞는 묶음으로. 하나도 안 맞으면 기타
 */
export const PHOTO_TAGS = ['food', 'scenery', 'building', 'people', 'other'] as const;
export type PhotoTag = (typeof PHOTO_TAGS)[number];

const RULES: [PhotoTag, RegExp][] = [
  [
    'food',
    /\b(food|dish|cuisine|meal|noodle|ramen|sushi|dessert|drink|coffee|beverage|bread|meat|seafood|fruit|tableware|recipe|baked goods|soup|snack)\b/i,
  ],
  ['people', /\b(person|people|smile|selfie|face|hair|gesture|fun|crowd|child|tourism)\b/i],
  [
    'building',
    /\b(building|architecture|temple|shrine|tower|castle|church|house|city|skyscraper|landmark|facade|street|palace|place of worship)\b/i,
  ],
  [
    'scenery',
    /\b(sky|cloud|mountain|sea|ocean|beach|water|nature|landscape|tree|plant|flower|lake|river|sunset|park|forest|coast|natural landscape)\b/i,
  ],
];

export function photoTag(names: readonly { name: string; score: number }[]): PhotoTag {
  for (const { name } of [...names].sort((a, b) => b.score - a.score))
    for (const [tag, re] of RULES) if (re.test(name)) return tag;
  return 'other';
}
