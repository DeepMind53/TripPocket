import { Moon, Sun } from 'lucide-react';

/** "------ 일몰 17:40 ------" — 좌우 '-'는 화면 폭만큼 채우고 넘치면 잘린다. 일정이 아니라 옮기거나 지울 수 없음 */
export function SunLine({
  kind,
  label,
  time,
}: {
  kind: 'rise' | 'set';
  label: string;
  time: string;
}) {
  const dashes = '-'.repeat(120);
  // 글자 양옆에 일출 = 해, 일몰 = 달 (사용자 요청 2026-10-27)
  const icon =
    kind === 'rise' ? (
      <Sun aria-hidden="true" className="size-3.5 shrink-0 text-warning" />
    ) : (
      <Moon aria-hidden="true" className="size-3.5 shrink-0 text-primary" />
    );
  return (
    <li
      aria-label={`${label} ${time}`}
      // 노선 오른쪽부터 (선 위로 '-'가 지나가지 않게, docs/29 §7.5)
      className="tabular relative flex items-center gap-1.5 pr-1 pl-12 text-micro text-fg-muted select-none"
    >
      <span
        aria-hidden="true"
        className="flex min-w-0 flex-1 justify-end overflow-hidden whitespace-nowrap"
      >
        {dashes}
      </span>
      {icon}
      <span className="shrink-0">
        {label} {time}
      </span>
      {icon}
      <span aria-hidden="true" className="min-w-0 flex-1 overflow-hidden whitespace-nowrap">
        {dashes}
      </span>
    </li>
  );
}
