import { act, render, screen, waitFor, within } from '@testing-library/react';
import { useAuth } from '../../data/authStore';
import userEvent from '@testing-library/user-event';
import { createMemoryRouter, RouterProvider } from 'react-router';
import { routes } from '../../app/router';
import { resetLocalDb } from '../../data/dev';
import { LABS, setLab } from '../../data/labsStore';
import { updateSettings, useSettings } from '../../data/settingsStore';
import { bookingRepo } from '../../data/repositories/bookingRepo';
import { itemRepo } from '../../data/repositories/itemRepo';
import { trashRepo } from '../../data/repositories/trashRepo';
import { tripRepo } from '../../data/repositories/tripRepo';
import { settingsRepo } from '../../data/repositories/settingsRepo';
import { Toaster } from '../../shared/ui';
import { localTimeLabel } from '../../shared/hooks/useMinuteClock';

beforeEach(async () => {
  await resetLocalDb();
  localStorage.removeItem('tp-labs');
});

describe('실험실', () => {
  it('마이 → 실험실: 새 실험 11개, 켜면 이 기기에 저장, 실험마다 [샘플] (2026-10-27)', async () => {
    const user = userEvent.setup();
    render(<RouterProvider router={createMemoryRouter(routes, { initialEntries: ['/me'] })} />);
    await user.click(await screen.findByRole('link', { name: '실험실' }));
    const sw = await screen.findByRole('switch', { name: /한국 시각 같이 보기/ });
    expect(sw).toHaveAttribute('aria-checked', 'false');
    await user.click(sw);
    expect(JSON.parse(localStorage.getItem('tp-labs')!)).toEqual({ homeTime: true });
    expect(LABS).toHaveLength(11);
    expect(screen.getAllByRole('switch')).toHaveLength(11);
    expect(screen.getAllByRole('button', { name: / 샘플$/ })).toHaveLength(11);
    // 정식이 된 것은 실험실에 없다
    for (const name of [/근처 가고 싶은 곳/, /오늘 체크아웃/, /하루 돌아보기/, /지금 일정으로/])
      expect(screen.queryByRole('switch', { name })).toBeNull();
    setLab('homeTime', false);
  });

  it('새 실험: 한국 시각 · 비 오는 날 · 체크인 · 귀국 전날 · 걷는 거리 · 빈 날 가고 싶은 곳', async () => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date('2026-10-22T03:00:00Z'));
    vi.stubGlobal('fetch', async () =>
      Response.json({
        daily: {
          time: ['2026-10-24', '2026-10-25', '2026-10-26'],
          weather_code: [61, 0, 0],
          temperature_2m_max: [20, 22, 22],
          temperature_2m_min: [12, 13, 13],
        },
      }),
    );
    const ids = [
      'homeTime',
      'rainMark',
      'checkinNotice',
      'returnNotice',
      'dayWalk',
      'emptyDayWish',
    ] as const;
    for (const id of ids) setLab(id, true);
    try {
      const trip = await tripRepo.create({
        title: '방콕',
        destinations: [
          { name: '방콕', kind: 'city', countryCode: 'TH', coords: { lat: 13.75, lng: 100.5 } },
        ],
        startDate: '2026-10-24',
        endDate: '2026-10-26',
        timezone: 'Asia/Bangkok',
        cover: {},
      });
      await bookingRepo.create({
        tripId: trip.id,
        kind: 'lodging',
        title: '방콕 호텔',
        start: { date: '2026-10-24', time: '14:00' },
        end: { date: '2026-10-26', time: '11:00' },
      });
      await bookingRepo.create({
        tripId: trip.id,
        kind: 'flight',
        title: 'TG658',
        start: { date: '2026-10-26', time: '23:00', place: 'BKK' },
        end: { date: '2026-10-27', time: '06:30', place: 'ICN' },
      });
      const at = (lat: number, lng: number) => ({ name: 'p', coords: { lat, lng } });
      await itemRepo.create({
        tripId: trip.id,
        date: '2026-10-24',
        kind: 'place',
        title: '왓 아룬',
        startTime: '10:00',
        place: at(13.7437, 100.4888),
      });
      await itemRepo.create({
        tripId: trip.id,
        date: '2026-10-24',
        kind: 'food',
        title: '짜뚜짝 국수',
        startTime: '13:00',
        place: at(13.7999, 100.5502),
      });
      await itemRepo.create({ tripId: trip.id, date: null, kind: 'cafe', title: '루프탑 바' });
      render(
        <RouterProvider
          router={createMemoryRouter(routes, { initialEntries: [`/trips/${trip.id}/plan`] })}
        />,
      );
      const d1 = await screen.findByRole('region', { name: /^1일차/ });
      // 방콕 10:00 = 한국 12:00
      await waitFor(() =>
        expect(
          within(screen.getByRole('region', { name: /^1일차/ })).getByText('한국 12:00'),
        ).toBeInTheDocument(),
      );
      const day1 = screen.getByRole('region', { name: /^1일차/ });
      // 비 예보 날 야외(관광) 일정에만 ☔ (맛집은 없음)
      await waitFor(() =>
        expect(
          within(screen.getByRole('region', { name: /^1일차/ })).getAllByText('☔'),
        ).toHaveLength(1),
      );
      expect(within(day1).getByText('오늘 14:00 체크인 · 방콕 호텔')).toBeInTheDocument();
      expect(within(day1).getByText(/^🚶 오늘 이동 약 \d+(\.\d)?km/)).toBeInTheDocument();
      expect(d1).toBeDefined();
      // 2일차 = 귀국 전날, 일정이 없어 가고 싶은 곳 버튼
      const day2 = screen.getByRole('region', { name: /^2일차/ });
      expect(within(day2).getByText('내일 23:00 귀국 · TG658')).toBeInTheDocument();
      expect(
        within(day2).getByRole('button', { name: '가고 싶은 곳 1곳에서 골라 넣기' }),
      ).toBeInTheDocument();
    } finally {
      for (const id of ids) setLab(id, false);
      vi.useRealTimers();
      vi.unstubAllGlobals();
    }
  });

  it('실험: 오늘 진행률 · 하루 일정 글로 복사 (2026-10-26)', async () => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date('2026-10-24T03:00:00Z')); // 서울 12:00, 여행 1일차
    try {
      const trip = await tripRepo.create({
        title: '도쿄',
        destinations: [{ name: '도쿄', kind: 'city', countryCode: 'JP' }],
        startDate: '2026-10-24',
        endDate: '2026-10-25',
        timezone: 'Asia/Seoul',
        cover: {},
      });
      const at = (lat: number) => ({ name: 'p', coords: { lat, lng: 139.69 }, address: '도쿄' });
      const a = await itemRepo.create({
        tripId: trip.id,
        date: '2026-10-24',
        kind: 'place',
        title: '센소지',
        startTime: '10:00',
        place: at(35.68),
      });
      await itemRepo.update(a.id, { done: true });
      const b = await itemRepo.create({
        tripId: trip.id,
        date: '2026-10-24',
        kind: 'food',
        title: '이치란',
        startTime: '10:10',
        place: at(35.7),
      });
      await itemRepo.setVisit(b.id, 'skipped');
      const user = userEvent.setup();
      render(
        <>
          <RouterProvider
            router={createMemoryRouter(routes, {
              initialEntries: [`/trips/${trip.id}/plan?day=1`],
            })}
          />
          <Toaster />
        </>,
      );
      const day = await screen.findByRole('region', { name: /^1일차/ });
      // 진행률(정식): 방문 1(파랑) · 미방문 1(빨강) / 2
      const bar = await within(day).findByLabelText(/^오늘 일정 2개 중\s방문 1 · 미방문 1$/);
      expect(bar.querySelector('.bg-primary')).toHaveStyle({ width: '50%' });
      expect(bar.querySelector('.bg-danger')).toHaveStyle({ width: '50%' });
      await user.click(within(day).getByRole('button', { name: /날짜 메뉴|메뉴/ }));
      await user.click(await screen.findByRole('button', { name: /일정 글로 복사/ }));
      // userEvent.setup()이 클립보드 흉내를 넣는다
      expect(await screen.findByText('하루 일정을 복사했어요')).toBeInTheDocument();
      expect(await navigator.clipboard.readText()).toMatch(
        /^1일차 · 10\.24 \(토\)\n1\. 10:00 센소지 \(도쿄\)\n2\. 10:10 이치란/,
      );
    } finally {
      vi.useRealTimers();
    }
  });

  it('일출·일몰 줄(정식) · 실험: 하루 동선 지도 (2026-10-27)', async () => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date('2026-10-22T03:00:00Z'));
    vi.stubGlobal('fetch', async () =>
      Response.json({
        daily: {
          time: ['2026-10-24', '2026-10-25'],
          weather_code: [61, 0],
          temperature_2m_max: [20, 22],
          temperature_2m_min: [12, 13],
        },
      }),
    );
    try {
      const trip = await tripRepo.create({
        title: '도쿄',
        destinations: [
          { name: '도쿄', kind: 'city', countryCode: 'JP', coords: { lat: 35.68, lng: 139.69 } },
        ],
        startDate: '2026-10-24',
        endDate: '2026-10-25',
        timezone: 'Asia/Tokyo',
        cover: {},
      });
      const at = (lat: number) => ({ name: 'p', coords: { lat, lng: 139.69 } });
      for (const [title, lat] of [
        ['센소지', 35.71],
        ['스카이트리', 35.71],
        ['신주쿠', 35.69],
      ] as const)
        await itemRepo.create({
          tripId: trip.id,
          date: '2026-10-24',
          kind: 'place',
          title,
          place: at(lat),
        });
      const user = userEvent.setup();
      render(
        <>
          <RouterProvider
            router={createMemoryRouter(routes, {
              initialEntries: [`/trips/${trip.id}/plan?day=1`],
            })}
          />
          <Toaster />
        </>,
      );
      const day = await screen.findByRole('region', { name: /^1일차/ });
      // 일출·일몰은 정식(설정 기본 켬): 시각 없는 일정 뒤 맨 아래에 한 줄씩
      expect(within(day).getByLabelText(/^일출 0[56]:\d\d$/)).toBeInTheDocument();
      expect(within(day).getByLabelText(/^일몰 1[67]:\d\d$/)).toBeInTheDocument();
      await user.click(within(day).getByRole('button', { name: /날짜 메뉴|메뉴/ }));
      const route = await screen.findByRole('link', { name: /하루 동선 지도로 보기/ });
      expect(route.getAttribute('href')).toMatch(/^https:\/\/www\.google\.com\/maps\/dir\/\?/);
      expect(route.getAttribute('target')).toBe('_blank');
    } finally {
      vi.useRealTimers();
      vi.unstubAllGlobals();
    }
  });

  it('실험: 날씨 맞춤 준비물 — 비 예보면 [우산] 제안, 누르면 초안에 들어간다', async () => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date('2026-10-22T03:00:00Z'));
    vi.stubGlobal('fetch', async () =>
      Response.json({
        daily: {
          time: ['2026-10-24', '2026-10-25'],
          weather_code: [61, 0],
          temperature_2m_max: [20, 22],
          temperature_2m_min: [12, 13],
        },
      }),
    );
    try {
      const trip = await tripRepo.create({
        title: '도쿄',
        destinations: [
          { name: '도쿄', kind: 'city', countryCode: 'JP', coords: { lat: 35.68, lng: 139.69 } },
        ],
        startDate: '2026-10-24',
        endDate: '2026-10-25',
        timezone: 'Asia/Tokyo',
        cover: {},
      });
      const user = userEvent.setup();
      render(
        <>
          <RouterProvider
            router={createMemoryRouter(routes, { initialEntries: [`/trips/${trip.id}/checklist`] })}
          />
          <Toaster />
        </>,
      );
      const box = await screen.findByRole('region', { name: '날씨 보고 챙길 것' });
      await user.click(within(box).getByRole('button', { name: '우산 추가' }));
      expect(await screen.findByText(/우산 넣었어요/)).toBeInTheDocument();
      expect(screen.queryByRole('region', { name: '날씨 보고 챙길 것' })).not.toBeInTheDocument();
    } finally {
      vi.useRealTimers();
      vi.unstubAllGlobals();
    }
  });

  it('정식 (2026-10-27): 메모 외화 → 원화 · 촘촘히 보기(설정) · 숙소까지 거리', async () => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date('2026-10-22T03:00:00Z'));
    try {
      await settingsRepo.set('fxCache', {
        source: 'koreaexim',
        date: '2026-10-22',
        fetchedAt: '2026-10-22T00:00:00Z',
        rates: { JPY: 9.2 },
      });
      const trip = await tripRepo.create({
        title: '도쿄',
        destinations: [{ name: '도쿄', kind: 'city', countryCode: 'JP' }],
        startDate: '2026-10-24',
        endDate: '2026-10-25',
        timezone: 'Asia/Tokyo',
        cover: {},
      });
      const hotel = await bookingRepo.create({
        tripId: trip.id,
        kind: 'lodging',
        title: '신주쿠 호텔',
        start: { date: '2026-10-24', time: '15:00' },
        end: { date: '2026-10-25', time: '11:00' },
      });
      const at = (lat: number, lng: number) => ({ name: 'p', coords: { lat, lng } });
      await itemRepo.create({
        tripId: trip.id,
        date: '2026-10-24',
        kind: 'lodging',
        title: '신주쿠 호텔',
        bookingId: hotel.id,
        place: at(35.69, 139.7),
      });
      await itemRepo.create({
        tripId: trip.id,
        date: '2026-10-24',
        kind: 'place',
        title: '센소지',
        memo: '입장 무료, 오미쿠지 ¥200',
        place: at(35.7148, 139.7967),
      });
      await itemRepo.create({
        tripId: trip.id,
        date: '2026-10-24',
        kind: 'place',
        title: '요코하마',
        place: at(35.45, 139.63),
      });
      // 정식(2026-10-27): 메모 외화·숙소까지 거리는 늘, 촘촘히 보기는 설정에서 켠다
      updateSettings({ compactList: true });
      const user = userEvent.setup();
      render(
        <>
          <RouterProvider
            router={createMemoryRouter(routes, {
              initialEntries: [`/trips/${trip.id}/plan?day=1`],
            })}
          />
          <Toaster />
        </>,
      );
      const day = await screen.findByRole('region', { name: /^1일차/ });
      // "빠듯해요" 표시는 뺐다 (사용자 요청 2026-10-27)
      expect(within(day).queryByText('빠듯해요')).toBeNull();
      // 마지막 장소(요코하마) → 숙소
      expect(
        within(day).getByText(/^숙소까지 \d+(\.\d)?km · 걸어서 약 \d+분$/),
      ).toBeInTheDocument();
      // 촘촘히 보기
      expect(day.querySelector('ol')?.className).toContain('gap-0.5');
      // 메모 외화 → 원화 (상세)
      await user.click(within(day).getByRole('button', { name: /센소지/ }));
      expect(await screen.findByText('💱 ¥200 ≈ 1,840원')).toBeInTheDocument();
    } finally {
      updateSettings({ compactList: false });
      vi.useRealTimers();
    }
  });

  it('정식(설정 기본 켬, 2026-10-27): 근처 가고 싶은 곳 · 오늘 체크아웃 · 하루 돌아보기', async () => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date('2026-10-25T09:00:00Z')); // 도쿄 10.25 18:00 = 2일차
    try {
      const trip = await tripRepo.create({
        title: '도쿄',
        destinations: [{ name: '도쿄', kind: 'city', countryCode: 'JP' }],
        startDate: '2026-10-24',
        endDate: '2026-10-25',
        timezone: 'Asia/Tokyo',
        cover: {},
      });
      await bookingRepo.create({
        tripId: trip.id,
        kind: 'lodging',
        title: '신주쿠 호텔',
        start: { date: '2026-10-24', time: '15:00' },
        end: { date: '2026-10-25', time: '11:00' },
      });
      const at = (lat: number, lng: number) => ({ name: 'p', coords: { lat, lng } });
      const a = await itemRepo.create({
        tripId: trip.id,
        date: '2026-10-25',
        kind: 'place',
        title: '센소지',
        startTime: '09:00',
        endTime: '10:00',
        place: at(35.7148, 139.7967),
      });
      const b = await itemRepo.create({
        tripId: trip.id,
        date: '2026-10-25',
        kind: 'shopping',
        title: '스카이트리',
        startTime: '13:00',
        place: at(35.7101, 139.8107),
      });
      await itemRepo.setVisit(a.id, 'visited');
      await itemRepo.setVisit(b.id, 'visited');
      await itemRepo.create({
        tripId: trip.id,
        date: null,
        kind: 'food',
        title: '아사쿠사 멘치',
        place: at(35.7128, 139.7951),
      });
      render(
        <RouterProvider
          router={createMemoryRouter(routes, { initialEntries: [`/trips/${trip.id}/plan?day=2`] })}
        />,
      );
      const day = await screen.findByRole('region', { name: /^2일차/ });
      await waitFor(() =>
        expect(
          within(screen.getByRole('region', { name: /^2일차/ })).getByText(/근처 가고 싶은 곳/),
        ).toBeInTheDocument(),
      );
      expect(screen.queryByText(/빈 시간/)).toBeNull();
      const now = screen.getByRole('region', { name: /^2일차/ });
      expect(within(now).getByText(/근처 가고 싶은 곳: 아사쿠사 멘치/)).toBeInTheDocument();
      expect(within(now).getByText('오늘 11:00 체크아웃 · 신주쿠 호텔')).toBeInTheDocument();
      expect(
        within(now).getByText(/^오늘 돌아보기 · 방문 2곳 · 약 1\.4km 이동$/),
      ).toBeInTheDocument();
      expect(day).toBeDefined();
    } finally {
      vi.useRealTimers();
    }
  });

  it('설정 → 일정 항목마다 [샘플]: 미리보기, 시트에서 바로 끄기 (2026-10-27)', async () => {
    const user = userEvent.setup();
    render(
      <RouterProvider router={createMemoryRouter(routes, { initialEntries: ['/settings'] })} />,
    );
    await user.click(
      await screen.findByRole('button', { name: '체크아웃 날 시각 보여 주기 샘플' }),
    );
    const sheet = await screen.findByRole('dialog', { name: '체크아웃 날 시각 보여 주기 샘플' });
    expect(within(sheet).getByText('오늘 11:00 체크아웃 · 신주쿠 호텔')).toBeInTheDocument();
    await user.click(within(sheet).getByRole('button', { name: '이 기능 끄기' }));
    expect(useSettings.getState().checkoutNotice).toBe(false);
    // 일정 표시 항목 9개 모두 샘플 버튼
    expect(screen.getAllByRole('button', { name: / 샘플$/ })).toHaveLength(9);
    updateSettings({ checkoutNotice: true });
  });

  it('새 실험: 시차(출발 전 홈) · 팁 계산기(빠른 메뉴) · 항공권 크게 보기(예약 탭)', async () => {
    const ids = ['jetLag', 'tipCalc', 'bigTicket'] as const;
    for (const id of ids) setLab(id, true);
    try {
      const trip = await tripRepo.create({
        title: '방콕',
        destinations: [{ name: '방콕', kind: 'city', countryCode: 'TH' }],
        startDate: new Intl.DateTimeFormat('en-CA').format(Date.now() + 3 * 86_400_000),
        endDate: new Intl.DateTimeFormat('en-CA').format(Date.now() + 5 * 86_400_000),
        timezone: 'Asia/Bangkok',
        cover: {},
      });
      await bookingRepo.create({
        tripId: trip.id,
        kind: 'flight',
        title: 'TG659',
        confirmationNo: 'XY98ZW',
        start: { date: trip.startDate, time: '09:00', place: 'ICN' },
        end: { date: trip.startDate, time: '13:00', place: 'BKK' },
      });
      const user = userEvent.setup();
      const router = createMemoryRouter(routes, { initialEntries: ['/'] });
      render(
        <>
          <RouterProvider router={router} />
          <Toaster />
        </>,
      );
      expect(await screen.findByText('🕒 여행지는 한국보다 2시간 느려요')).toBeInTheDocument();
      await act(() => router.navigate(`/trips/${trip.id}/bookings`));
      await user.click(await screen.findByRole('button', { name: '크게 보기' }));
      const big = await screen.findByRole('dialog', { name: 'TG659 크게 보기' });
      expect(within(big).getByText('XY98ZW')).toBeInTheDocument();
    } finally {
      for (const id of ids) setLab(id, false);
    }
  });

  it('팁 계산: 금액·비율 → 팁·합계 (저장 안 함)', async () => {
    const { TipCalc } = await import('../common/TipCalc');
    const user = userEvent.setup();
    render(<TipCalc />);
    await user.type(screen.getByLabelText('금액'), '42.5');
    expect(screen.getByRole('status')).toHaveTextContent('팁 7.65 · 합계 50.15');
    await user.click(screen.getByRole('button', { name: '20%' }));
    expect(screen.getByRole('status')).toHaveTextContent('팁 8.50 · 합계 51.00');
  });

  it('현지 시각: 시간대가 기기와 다를 때만', () => {
    const t = (_k: string, o: { time: string }) => `현지 ${o.time}`;
    const now = new Date('2026-10-24T03:05:00Z');
    const device = Intl.DateTimeFormat().resolvedOptions().timeZone;
    expect(localTimeLabel(device, now, t)).toBeNull();
    const other = device === 'Asia/Bangkok' ? 'Asia/Tokyo' : 'Asia/Bangkok';
    expect(localTimeLabel(other, now, t)).toBe(
      other === 'Asia/Bangkok' ? '현지 10:05' : '현지 12:05',
    );
    expect(localTimeLabel('Not/AZone', now, t)).toBeNull();
  });

  it('긴급 연락처 카드: 켜면 ⚡ 메뉴 맨 위, 여행 나라 번호를 누르면 전화', async () => {
    const user = userEvent.setup();
    const trip = await tripRepo.create({
      title: '도쿄',
      destinations: [{ name: '도쿄', kind: 'city', countryCode: 'JP' }],
      startDate: '2026-11-12',
      endDate: '2026-11-14',
      timezone: 'Asia/Tokyo',
      cover: { emoji: '🗼' },
    });
    render(
      <RouterProvider
        router={createMemoryRouter(routes, { initialEntries: [`/trips/${trip.id}/plan`] })}
      />,
    );
    await user.click(await screen.findByRole('button', { name: '빠른 메뉴' }));
    await user.click(await screen.findByRole('button', { name: /긴급 연락처/ }));
    const sheet = await screen.findByRole('dialog', { name: '긴급 연락처' });
    expect(within(sheet).getByRole('link', { name: /경찰\s*110/ })).toHaveAttribute(
      'href',
      'tel:110',
    );
    expect(within(sheet).getByRole('link', { name: /\+82-2-3210-0404/ })).toHaveAttribute(
      'href',
      'tel:+82232100404',
    );
  });

  it('여행 안 검색: ⋯ 메뉴에서 열어 일정·예약을 찾고, 누르면 그날 일정으로', async () => {
    const user = userEvent.setup();
    const trip = await tripRepo.create({
      title: '도쿄',
      destinations: [{ name: '도쿄', kind: 'city', countryCode: 'JP' }],
      startDate: '2026-11-12',
      endDate: '2026-11-14',
      timezone: 'Asia/Tokyo',
      cover: { emoji: '🗼' },
    });
    await itemRepo.create({
      tripId: trip.id,
      date: '2026-11-13',
      kind: 'food',
      title: '이치란 라멘',
    });
    const router = createMemoryRouter(routes, { initialEntries: [`/trips/${trip.id}/plan`] });
    render(<RouterProvider router={router} />);
    await user.click(await screen.findByRole('button', { name: '더보기' }));
    await user.click(await screen.findByRole('button', { name: '여행 안 검색' }));
    const sheet = await screen.findByRole('dialog', { name: '여행 안 검색' });
    await user.type(within(sheet).getByRole('searchbox'), '라멘');
    await user.click(await within(sheet).findByRole('button', { name: /이치란 라멘/ }));
    expect(router.state.location.search).toBe('?day=2');
  });

  it('하루 일정 복제: 날짜 메뉴에서 다른 날로, 예약 연결·다녀옴은 빼고', async () => {
    const user = userEvent.setup();
    const trip = await tripRepo.create({
      title: '도쿄',
      destinations: [{ name: '도쿄', kind: 'city', countryCode: 'JP' }],
      startDate: '2026-11-12',
      endDate: '2026-11-14',
      timezone: 'Asia/Tokyo',
      cover: { emoji: '🗼' },
    });
    await itemRepo.create({
      tripId: trip.id,
      date: '2026-11-12',
      kind: 'food',
      title: '라멘',
      startTime: '12:00',
      done: true,
      bookingId: '01890000-0000-7000-8000-000000000000',
    });
    render(
      <RouterProvider
        router={createMemoryRouter(routes, { initialEntries: [`/trips/${trip.id}/plan?day=all`] })}
      />,
    );
    await user.click(await screen.findByRole('button', { name: /1일차.*메뉴/ }));
    await user.click(await screen.findByRole('button', { name: /다른 날로 복제/ }));
    const sheet = await screen.findByRole('dialog', { name: '다른 날로 복제' });
    await user.click(within(sheet).getByRole('button', { name: /3일차/ }));
    let copies: Awaited<ReturnType<typeof itemRepo.listByTrip>> = [];
    await waitFor(async () => {
      copies = (await itemRepo.listByTrip(trip.id)).filter((i) => i.date === '2026-11-14');
      expect(copies).toHaveLength(1);
    });
    expect(copies[0]).toMatchObject({ title: '라멘', startTime: '12:00' });
    expect(copies[0]!.bookingId).toBeUndefined();
    expect(copies[0]!.done).toBeUndefined();
  });

  it('인쇄용 일정표: 여행 메뉴에서 열면 날짜별 일정·예약번호, 버튼은 브라우저 인쇄', async () => {
    const user = userEvent.setup();
    const print = vi.spyOn(window, 'print').mockImplementation(() => {});
    const trip = await tripRepo.create({
      title: '도쿄',
      destinations: [{ name: '도쿄', kind: 'city', countryCode: 'JP' }],
      startDate: '2026-11-12',
      endDate: '2026-11-13',
      timezone: 'Asia/Tokyo',
      cover: { emoji: '🗼' },
    });
    await itemRepo.create({
      tripId: trip.id,
      date: '2026-11-13',
      kind: 'place',
      title: '센소지',
      startTime: '09:30',
      place: { address: '아사쿠사 2-3-1' },
    });
    const router = createMemoryRouter(routes, { initialEntries: [`/trips/${trip.id}/plan`] });
    render(<RouterProvider router={router} />);
    await user.click(await screen.findByRole('button', { name: '더보기' }));
    await user.click(await screen.findByRole('button', { name: '인쇄용 일정표' }));
    // 주소는 일정 화면에도 있으니, 인쇄 화면으로 옮긴 뒤에 확인한다 (느린 CI에서 먼저 찾히던 문제)
    await waitFor(() => expect(router.state.location.pathname).toBe(`/trips/${trip.id}/print`));
    expect(await screen.findByRole('button', { name: '인쇄 · PDF로 저장' })).toBeInTheDocument();
    expect(await screen.findByText('아사쿠사 2-3-1')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: '인쇄 · PDF로 저장' }));
    expect(print).toHaveBeenCalled();
    print.mockRestore();
  });

  it('샘플 테스트: 관리자에게만, 누르면 오늘 출발 도쿄 5일 샘플을 만들어 열고 지울 수 있다', async () => {
    const user = userEvent.setup();
    const me = { id: 'u', nickname: '관리자', createdAt: '', providers: [] };
    useAuth.setState({ status: 'user', me: { ...me, isAdmin: false } });
    const router = createMemoryRouter(routes, { initialEntries: ['/labs'] });
    const { unmount } = render(<RouterProvider router={router} />);
    await screen.findByRole('switch', { name: /한국 시각 같이 보기/ });
    expect(screen.queryByRole('button', { name: '샘플 테스트' })).not.toBeInTheDocument();
    unmount();

    useAuth.setState({ status: 'user', me: { ...me, isAdmin: true } });
    const admin = createMemoryRouter(routes, { initialEntries: ['/labs'] });
    render(<RouterProvider router={admin} />);
    await user.click(await screen.findByRole('button', { name: '샘플 테스트' }));
    await waitFor(() => expect(admin.state.location.pathname).toMatch(/^\/trips\/.+\/plan$/));
    const trips = await tripRepo.listActive();
    expect(trips.map((t) => t.title).sort()).toEqual([
      '[샘플] 도쿄 5일',
      '[샘플] 작년 도쿄 여행',
      '[샘플] 지난 오사카 여행',
      '[샘플] 타이베이 3일',
    ]);
    // 삭제 기록 복원에서 볼 지운 일정
    expect((await trashRepo.list()).some((e) => e.title === '스카이트리')).toBe(true);
    const tokyo = trips.find((t) => t.title === '[샘플] 도쿄 5일')!;
    expect(tokyo.startDate).toBe(
      new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Tokyo' }).format(new Date()),
    );

    await act(() => admin.navigate('/labs'));
    await user.click(await screen.findByRole('button', { name: '샘플 지우기' }));
    await waitFor(async () => expect(await tripRepo.listActive()).toEqual([]));
    useAuth.setState({ status: 'unknown', me: null });
  });
});
