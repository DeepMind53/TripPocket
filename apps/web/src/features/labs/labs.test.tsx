import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { createMemoryRouter, RouterProvider } from 'react-router';
import { routes } from '../../app/router';
import { resetLocalDb } from '../../data/dev';
import { LABS, setLab } from '../../data/labsStore';
import { itemRepo } from '../../data/repositories/itemRepo';
import { tripRepo } from '../../data/repositories/tripRepo';
import { Toaster } from '../../shared/ui';
import { localTimeLabel } from '../../shared/hooks/useMinuteClock';

beforeEach(async () => {
  await resetLocalDb();
  localStorage.removeItem('tp-labs');
});

describe('실험실', () => {
  it('마이 → 실험실에서 켜고 끄면 이 기기에 저장', async () => {
    const user = userEvent.setup();
    render(<RouterProvider router={createMemoryRouter(routes, { initialEntries: ['/me'] })} />);
    await user.click(await screen.findByRole('link', { name: '실험실' }));
    const sw = await screen.findByRole('switch', { name: /다음 장소까지 거리/ });
    expect(sw).toHaveAttribute('aria-checked', 'false');
    await user.click(sw);
    expect(sw).toHaveAttribute('aria-checked', 'true');
    expect(JSON.parse(localStorage.getItem('tp-labs')!)).toEqual({ legDistance: true });
    expect(screen.getByRole('switch', { name: /화면 켜짐 유지/ })).toBeInTheDocument();
    // 실험실 목록(LABS)마다 스위치 하나
    expect(
      screen.getAllByRole('switch').map((s) => s.getAttribute('aria-label') ?? s.id),
    ).toHaveLength(LABS.length);
    expect(screen.queryByRole('switch', { name: /현지 시각 표시/ })).toBeNull();
    expect(screen.queryByRole('switch', { name: /당겨서 동기화/ })).toBeNull();
    for (const name of [/오늘 일정 진행률/, /빠듯한 일정 알림/, /하루 일정 글로 복사/])
      expect(screen.getByRole('switch', { name })).toBeInTheDocument();
  });

  it('새 실험: 오늘 진행률 · 빠듯한 일정 알림 · 하루 일정 글로 복사 (2026-10-26)', async () => {
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
      await itemRepo.create({
        tripId: trip.id,
        date: '2026-10-24',
        kind: 'food',
        title: '이치란',
        startTime: '10:10',
        place: at(35.7),
      });
      setLab('dayProgress', true);
      setLab('tightGap', true);
      setLab('copyDay', true);
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
      expect(
        await within(day).findByLabelText('오늘 일정 2개 중 1개 다녀왔어요'),
      ).toBeInTheDocument();
      expect(within(day).getByText(/걸어서 약 \d+분인데 10분 뒤 일정이에요/)).toBeInTheDocument();
      await user.click(within(day).getByRole('button', { name: /날짜 메뉴|메뉴/ }));
      await user.click(await screen.findByRole('button', { name: /일정 글로 복사/ }));
      // userEvent.setup()이 클립보드 흉내를 넣는다
      expect(await screen.findByText('하루 일정을 복사했어요')).toBeInTheDocument();
      expect(await navigator.clipboard.readText()).toMatch(
        /^1일차 · 10\.24 \(토\)\n1\. 10:00 센소지 \(도쿄\)\n2\. 10:10 이치란/,
      );
    } finally {
      for (const id of ['dayProgress', 'tightGap', 'copyDay'] as const) setLab(id, false);
      vi.useRealTimers();
    }
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
    setLab('emergency', true);
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
    setLab('tripSearch', true);
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
    setLab('dupDay', true);
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
});
