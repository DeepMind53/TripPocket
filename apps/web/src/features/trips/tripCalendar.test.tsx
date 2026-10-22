import type { Destination } from '@trippocket/shared';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import { resetLocalDb } from '../../data/dev';
import { getHolidays } from '../../data/services/travelInfo';
import type { DateRange } from '../../shared/lib/dateRange';
import { TripCalendar } from './TripCalendar';

const HOLIDAYS: Record<string, unknown[]> = {
  KR: [
    {
      date: '2026-12-25',
      localName: '크리스마스',
      name: 'Christmas Day',
      countryCode: 'KR',
      global: true,
    },
    {
      date: '2027-02-06',
      localName: '설날',
      name: 'Lunar New Year',
      countryCode: 'KR',
      global: true,
    },
    {
      date: '2027-02-07',
      localName: '설날',
      name: 'Lunar New Year',
      countryCode: 'KR',
      global: true,
    },
    {
      date: '2027-02-08',
      localName: '설날',
      name: 'Lunar New Year',
      countryCode: 'KR',
      global: true,
    },
  ],
  JP: [
    {
      date: '2026-11-03',
      localName: '文化の日',
      name: 'Culture Day',
      countryCode: 'JP',
      global: true,
    },
    { date: '2026-11-04', localName: '地域', name: 'Local Day', countryCode: 'JP', global: false },
  ],
};

let calls: string[] = [];
function mockFetch() {
  calls = [];
  vi.stubGlobal('fetch', (url: string) => {
    calls.push(url);
    if (url.includes('TaiwanCalendar/data/2026'))
      return Promise.resolve(
        Response.json([
          { date: '20261009', week: '五', isHoliday: true, description: '補假' },
          { date: '20261010', week: '六', isHoliday: true, description: '國慶日' },
          { date: '20261011', week: '日', isHoliday: true, description: '' },
        ]),
      );
    if (url.includes('TaiwanCalendar')) return Promise.resolve(new Response(null, { status: 404 }));
    const holiday = /PublicHolidays\/(\d+)\/(\w+)/.exec(url);
    if (holiday) {
      const list = HOLIDAYS[holiday[2]!];
      if (!list) return Promise.resolve(new Response(null, { status: 404 }));
      const year = holiday[1]!;
      const body = list.filter((h) => (h as { date: string }).date.startsWith(year));
      return Promise.resolve(Response.json(body));
    }
    return Promise.resolve(
      Response.json({
        daily: {
          time: ['2026-10-22', '2026-10-23'],
          weather_code: [0, 63],
          temperature_2m_max: [19.4, 15],
          temperature_2m_min: [11.6, 9],
        },
      }),
    );
  });
}

const tokyo: Destination = {
  name: '도쿄',
  kind: 'city',
  countryCode: 'JP',
  coords: { lat: 35.68, lng: 139.69 },
  timezone: 'Asia/Tokyo',
};

function Harness({ destinations }: { destinations: Destination[] }) {
  const [range, setRange] = useState<DateRange>({ start: null, end: null });
  return (
    <TripCalendar
      destinations={destinations}
      value={range}
      onChange={setRange}
      today="2026-10-22"
    />
  );
}

beforeEach(async () => {
  await resetLocalDb();
  mockFetch();
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('여행 날짜 달력 — 공휴일·날씨', () => {
  it('한국·목적지 공휴일과 날씨를 날짜에 보여주고, 칩으로 끈다', { timeout: 30_000 }, async () => {
    const user = userEvent.setup();
    render(<Harness destinations={[tokyo]} />);

    // 날씨: 날짜 칸 설명 + 이모지·기온
    expect(
      await screen.findByRole(
        'button',
        { name: /^10\.22 \(목\).*맑음 12°\/19°/ },
        // 13개월 달력을 처음 그리는 데 다른 테스트와 동시에 돌면 5초를 넘기기도 한다
        { timeout: 15_000 },
      ),
    ).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /^10\.23 \(금\) · 비 9°\/15°/ })).toBeInTheDocument();
    expect(screen.getByText('도쿄 기준', { exact: false })).toBeInTheDocument();

    // 공휴일: 일본(한국어 이름 + 영어), 지역 공휴일은 뺌, 긴 연휴는 날마다 + 아래 목록에 한 줄
    expect(
      await screen.findByRole('button', { name: '11.03 (화) · 문화의 날 (Culture Day)' }),
    ).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '11.04 (수)' })).toBeInTheDocument();
    for (const d of ['02.06 (토)', '02.07 (일)', '02.08 (월)'])
      expect(
        screen.getByRole('button', { name: `${d} · 설날 (Lunar New Year)` }),
      ).toBeInTheDocument();
    expect(screen.getByText('02.06 (토)–02.08 (월)')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: /공휴일/, pressed: true }));
    expect(await screen.findByRole('button', { name: '11.03 (화)' })).toBeInTheDocument();
    expect(screen.queryByText('02.06 (토)–02.08 (월)')).not.toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: /날씨/, pressed: true }));
    expect(await screen.findByRole('button', { name: '10.23 (금)' })).toBeInTheDocument();
    expect(screen.queryByText('도쿄 기준', { exact: false })).not.toBeInTheDocument();
  });

  it('대만 공휴일은 대만 정부 달력에서', async () => {
    const holidays = await getHolidays('TW', 2026);
    expect(holidays?.map((h) => [h.date, h.name])).toEqual([
      ['2026-10-09', 'Substitute Holiday'],
      ['2026-10-10', 'National Day'],
    ]);
  });

  it('태국·말레이시아는 앱에 담긴 공휴일 (네트워크 없이)', async () => {
    const th = await getHolidays('TH', 2026);
    expect(th?.find((h) => h.date === '2026-04-13')).toMatchObject({ name: 'Songkran' });
    expect(calls).toHaveLength(0);
    expect(await getHolidays('MY', 2026)).not.toHaveLength(0);
  });

  it('공휴일 정보가 없는 나라는 안내한다', async () => {
    render(
      <Harness
        destinations={[{ name: '양곤', kind: 'city', countryCode: 'MM', timezone: 'Asia/Yangon' }]}
      />,
    );
    expect(await screen.findByText(/미얀마 공휴일은 무료 정보가 없어 빠져요/)).toBeInTheDocument();
  });
});

describe('공휴일·날씨 저장', () => {
  it('한 번 받은 공휴일은 기기에 저장해 다시 묻지 않고, 오프라인에서도 보여준다', async () => {
    expect(await getHolidays('JP', 2026)).toHaveLength(1);
    expect(await getHolidays('JP', 2026)).toHaveLength(1);
    expect(calls).toHaveLength(1);
  });

  it('네트워크 오류면 빈 목록 (앱은 그대로 동작)', async () => {
    vi.stubGlobal('fetch', () => Promise.reject(new Error('offline')));
    expect(await getHolidays('KR', 2026)).toEqual([]);
  });
});
