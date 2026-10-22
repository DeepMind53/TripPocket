/** 조건부 className 합치기 (falsy 값은 무시) */
export function cn(...classes: Array<string | false | null | undefined>): string {
  return classes.filter(Boolean).join(' ');
}
