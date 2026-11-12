import { addDays, diffDays, type ItineraryItem, type Trip } from '@trippocket/shared';

/**
 * 여행기 글로 복사 (실험실 tripStory, 2026-11-13): 다녀온 여행을 날짜별 글로 — 블로그·메모에 붙여 넣기.
 * 메모에 간 곳(건너뛴 곳·Plan B 후보 제외)과 하루 한 줄 기록. 문구는 부르는 쪽(labels)에서 받는다
 */
export function tripStoryText(
  trip: Pick<Trip, 'title' | 'startDate' | 'endDate' | 'destinations' | 'dayNotes'>,
  items: readonly Pick<
    ItineraryItem,
    'date' | 'order' | 'title' | 'startTime' | 'visit' | 'planId'
  >[],
  labels: { dayN: (n: number) => string; note: string },
): string {
  const dot = (d: string) => d.replaceAll('-', '.');
  const lines = [`${trip.title} (${dot(trip.startDate)} – ${dot(trip.endDate).slice(5)})`];
  const cities = trip.destinations.map((d) => d.name).join(' · ');
  if (cities) lines.push(cities);
  const days = diffDays(trip.startDate, trip.endDate) + 1;
  for (let i = 0; i < days; i++) {
    const date = addDays(trip.startDate, i);
    const places = items
      .filter((it) => it.date === date && it.visit !== 'skipped' && !it.planId)
      .sort(
        (a, b) =>
          (a.startTime ?? '99').localeCompare(b.startTime ?? '99') ||
          a.order.localeCompare(b.order),
      );
    const note = trip.dayNotes?.find((n) => n.date === date)?.text;
    if (places.length === 0 && !note) continue;
    lines.push('', `${dot(date).slice(5)} ${labels.dayN(i + 1)}`);
    for (const p of places) lines.push(`- ${p.startTime ? `${p.startTime} ` : ''}${p.title}`);
    if (note) lines.push(`${labels.note}: ${note}`);
  }
  return lines.join('\n');
}
