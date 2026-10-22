// 무료 공휴일 API(Nager.Date)가 없는 나라의 공휴일을 Google 캘린더 공휴일 피드(무료·키 없음)에서 받아
// src/data/holidays/{CC}.json 으로 저장한다 (앱에 담겨 오프라인에서도 동작, 해당 나라를 고를 때만 불러옴).
// 전국 공휴일만 (지역 공휴일·기념일 제외). 데이터는 피드가 주는 해까지 — 해마다 다시 실행.
//   node scripts/gen-holidays.mjs
import { mkdirSync, writeFileSync } from 'node:fs';

const FEEDS = { TH: 'en.th', MY: 'en.malaysia' };
const out = new URL('../src/data/holidays/', import.meta.url);
mkdirSync(out, { recursive: true });

const day = (ymd) => `${ymd.slice(0, 4)}-${ymd.slice(4, 6)}-${ymd.slice(6, 8)}`;
const next = (iso) => {
  const d = new Date(`${iso}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + 1);
  return d.toISOString().slice(0, 10);
};
/** "Day off for X", "X observed" → 대체공휴일 */
const clean = (raw) => {
  const name = raw.replace(/\\,/g, ',').replace(/ \(tentative\)$/i, '');
  if (/^Day off for |\bobserved$|^Substitute Holiday/i.test(name)) return 'Substitute Holiday';
  if (/^Bridge Public Holiday$|^Extra holiday$/i.test(name)) return 'Bridge Holiday';
  // "송끄란 연휴", "하리 라야 연휴 2일째" 등은 본 공휴일 이름으로 묶는다 (기간을 한 줄로 표시)
  return name.replace(/ Holiday( Day \d+)?$/i, '');
};
const FROM = String(new Date().getFullYear());

for (const [cc, id] of Object.entries(FEEDS)) {
  const url = `https://calendar.google.com/calendar/ical/${encodeURIComponent(`${id}#holiday@group.v.calendar.google.com`)}/public/basic.ics`;
  const ics = (await (await fetch(url)).text()).replace(/\r?\n[ \t]/g, '');
  const list = [];
  for (const ev of ics.split('BEGIN:VEVENT').slice(1)) {
    const desc = /DESCRIPTION:(.*)/.exec(ev)?.[1] ?? '';
    // 전국 공휴일만: "Public holiday" (지역은 "Public holiday in …")
    if (!desc.startsWith('Public holiday') || desc.startsWith('Public holiday in')) continue;
    const start = day(/DTSTART;VALUE=DATE:(\d{8})/.exec(ev)?.[1] ?? '');
    const end = day(/DTEND;VALUE=DATE:(\d{8})/.exec(ev)?.[1] ?? '');
    const name = clean((/SUMMARY:(.*)/.exec(ev)?.[1] ?? '').trim());
    for (let d = start; d < end; d = next(d)) if (d >= FROM) list.push([d, name]);
  }
  list.sort((a, b) => a[0].localeCompare(b[0]));
  writeFileSync(new URL(`${cc}.json`, out), `${JSON.stringify(list)}\n`);
  console.log(cc, list.length, list[0]?.[0], '…', list.at(-1)?.[0]);
}
