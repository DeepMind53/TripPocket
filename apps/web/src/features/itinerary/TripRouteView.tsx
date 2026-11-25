import { useTranslation } from '../../i18n';
import { routeColor, routeStyle } from '../../shared/ui/routeColor';

export interface RouteDay {
  /** 일차 번호(0부터) — 노선 색 */
  index: number;
  /** 날짜 ("11.12 (목)") */
  date: string;
  /**
   * 그날 역 (메모 빼고 순서대로). n = 일정 목록의 번호 — 메모가 끼어 있어도 목록과 같은 번호 (2026-11-25).
   * 이름만 주면 1번부터 센다 (샘플)
   */
  stops: readonly (string | { name: string; n: number })[];
}

/**
 * 여행 전체 노선도 (실험실 tripRouteMap, 2026-11-10): 일차마다 노선 한 줄, 역 = 그날 장소.
 * 지하철 노선도처럼 선 위에 번호 원, 이름은 원 아래. 길면 옆으로 밀어 본다. 샘플 미리보기도 이 부품
 */
export function TripRouteView({ days }: { days: readonly RouteDay[] }) {
  const { t } = useTranslation();
  const shown = days.filter((d) => d.stops.length > 0);
  if (shown.length === 0)
    return <p className="py-6 text-center text-body-2 text-fg-muted">{t('routeMap.empty')}</p>;
  return (
    <ol className="flex flex-col gap-4">
      {shown.map((d) => (
        <li key={d.index} style={routeStyle(d.index)} className="flex flex-col gap-2">
          <span className="flex items-center gap-2">
            <span
              className="rounded-full px-2.5 py-0.5 text-caption font-semibold whitespace-nowrap text-on-primary"
              style={{ background: routeColor(d.index).ink }}
            >
              {t('plan.dayN', { n: d.index + 1 })}
            </span>
            <span className="tabular text-body-2 font-medium">{d.date}</span>
          </span>
          <div className="overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            <div className="relative w-max">
              {/* 노선: 첫 역 가운데 ~ 마지막 역 가운데 한 줄, 번호 원이 덮는다 */}
              <span
                aria-hidden="true"
                className="absolute top-[10.5px] right-8 left-8 h-[3px] rounded-full bg-[var(--route)]"
              />
              <ol aria-label={t('plan.dayN', { n: d.index + 1 })} className="relative flex">
                {d.stops.map((stop, i) => (
                  <li key={i} className="flex w-16 shrink-0 flex-col items-center gap-1">
                    <span
                      aria-hidden="true"
                      className="grid size-6 place-items-center rounded-full border-[3px] border-[var(--route)] bg-surface font-mono text-micro leading-none text-[var(--route-ink)]"
                    >
                      {typeof stop === 'string' ? i + 1 : stop.n}
                    </span>
                    <span className="line-clamp-2 px-0.5 text-center text-micro text-fg-sub">
                      {typeof stop === 'string' ? stop : stop.name}
                    </span>
                  </li>
                ))}
              </ol>
            </div>
          </div>
        </li>
      ))}
    </ol>
  );
}
