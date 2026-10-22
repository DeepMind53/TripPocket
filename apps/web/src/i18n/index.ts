import ko from './ko.json';

/**
 * 화면 문구 (한국어 우선, docs/08 A3). i18next 대신 직접 만든 작은 함수 — 번들 크기 약 18KB 절약.
 * - 키는 ko.json 구조에서 자동으로 만들어진 타입이라, 없는 키는 타입 검사에서 걸린다.
 * - {{name}} 자리에 값을 넣는다. React가 화면에 넣을 때 이스케이프하므로 여기서는 하지 않는다.
 * - 영어를 추가할 때는 en.json을 같은 구조로 만들고 언어 선택만 붙이면 된다.
 */
type Leaves<T, P extends string = ''> = {
  [K in keyof T & string]: T[K] extends string ? `${P}${K}` : Leaves<T[K], `${P}${K}.`>;
}[keyof T & string];

export type TKey = Leaves<typeof ko>;
export type TVars = Record<string, string | number>;

function lookup(key: string): string {
  let node: unknown = ko;
  for (const part of key.split('.')) {
    node = (node as Record<string, unknown> | undefined)?.[part];
  }
  return typeof node === 'string' ? node : key;
}

export function t(key: TKey, vars?: TVars): string {
  const text = lookup(key);
  return vars
    ? text.replace(/\{\{(\w+)\}\}/g, (_, name: string) => String(vars[name] ?? ''))
    : text;
}

/** 컴포넌트에서 쓰는 형태 (기존 react-i18next와 같은 모양) */
export function useTranslation() {
  return { t };
}

const i18n = { t };
export default i18n;
