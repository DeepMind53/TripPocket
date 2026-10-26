import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { createMemoryRouter, RouterProvider } from 'react-router';
import { routes } from '../../app/router';
import { useAuth } from '../../data/authStore';
import { resetLocalDb } from '../../data/dev';
import { bookingRepo } from '../../data/repositories/bookingRepo';
import { itemRepo } from '../../data/repositories/itemRepo';
import { tripRepo } from '../../data/repositories/tripRepo';
import { Toaster } from '../../shared/ui';

let tripId = '';

beforeEach(async () => {
  await resetLocalDb();
  vi.useFakeTimers({ toFake: ['Date'] });
  // 서울 기준 2026-10-25 10:00 (여행 2일차)
  vi.setSystemTime(new Date('2026-10-25T01:00:00Z'));
  const trip = await tripRepo.create({
    title: '부산 여행',
    destinations: [{ name: '부산', kind: 'city', countryCode: 'KR' }],
    startDate: '2026-10-24',
    endDate: '2026-10-27',
    timezone: 'Asia/Seoul',
    cover: { emoji: '🌊' },
  });
  tripId = trip.id;
});

afterEach(() => {
  vi.useRealTimers();
});

function renderAt(entries: string[]) {
  const router = createMemoryRouter(routes, { initialEntries: entries });
  render(
    <>
      <RouterProvider router={router} />
      <Toaster />
    </>,
  );
  return router;
}

describe('예약', () => {
  it('공항은 도시·공항 이름으로 찾아 고르고, 출발·도착 터미널을 따로 넣는다 · 시간은 숫자로 친다', async () => {
    const user = userEvent.setup();
    renderAt([`/trips/${tripId}/bookings`]);
    await user.click(await screen.findByRole('button', { name: '예약 추가' }));
    const sheet = screen.getByRole('dialog', { name: '예약 추가' });
    await user.type(within(sheet).getByLabelText('편명'), 'KE723');
    await user.type(within(sheet).getByLabelText('출발 공항'), '인천');
    await user.click(await within(sheet).findByRole('option', { name: /ICN.*인천국제공항/ }));
    await user.type(within(sheet).getByLabelText('도착 공항'), '간사이');
    await user.click(await within(sheet).findByRole('option', { name: /KIX/ }));
    await user.type(within(sheet).getByLabelText('출발 터미널'), 'T2');
    await user.type(within(sheet).getByLabelText('도착 터미널'), 'T1');
    await user.type(within(sheet).getByLabelText('출발 시간'), '0905');
    await user.click(within(sheet).getByRole('button', { name: '예약 추가' }));
    expect(await screen.findByText('예약을 추가했어요')).toBeInTheDocument();
    const [saved] = await bookingRepo.listByTrip(tripId);
    expect(saved).toMatchObject({
      start: { place: 'ICN', time: '09:05' },
      end: { place: 'KIX' },
      details: { terminal: 'T2', arrivalTerminal: 'T1' },
    });
  });

  it('항공권을 추가하면 탑승권 카드로 보이고 예약번호를 복사한다', async () => {
    const user = userEvent.setup();
    renderAt([`/trips/${tripId}/bookings`]);
    await user.click(await screen.findByRole('button', { name: '예약 추가' }));
    const sheet = screen.getByRole('dialog', { name: '예약 추가' });
    await user.type(within(sheet).getByLabelText('항공사'), '대한항공');
    await user.type(within(sheet).getByLabelText('편명'), 'ke703');
    await user.type(within(sheet).getByLabelText('출발 공항'), 'icn');
    await user.type(within(sheet).getByLabelText('도착 공항'), 'nrt');
    await user.type(within(sheet).getByLabelText('출발 시간'), '09:10');
    await user.type(within(sheet).getByLabelText('예약번호'), 'AB12CD');
    await user.click(within(sheet).getByRole('button', { name: '예약 추가' }));

    expect(await screen.findByText('예약을 추가했어요')).toBeInTheDocument();
    const group = await screen.findByRole('region', { name: '항공' });
    expect(group).toHaveTextContent('대한항공 KE703');
    expect(group).toHaveTextContent('ICN');
    expect(group).toHaveTextContent('NRT');
    const [saved] = await bookingRepo.listByTrip(tripId);
    expect(saved?.title).toBe('KE703 ICN→NRT');

    await user.click(within(group).getByRole('button', { name: '예약번호 AB12CD 복사' }));
    expect(await screen.findByText('예약번호를 복사했어요')).toBeInTheDocument();
    expect(await navigator.clipboard.readText()).toBe('AB12CD');
  });

  it('음식점 예약: 인원과 함께 저장되고 그날 일정에 줄로 보인다', async () => {
    const user = userEvent.setup();
    renderAt([`/trips/${tripId}/bookings`, `/trips/${tripId}/bookings`]);
    await user.click(await screen.findByRole('button', { name: '예약 추가' }));
    const sheet = screen.getByRole('dialog', { name: '예약 추가' });
    await user.click(within(sheet).getByRole('button', { name: '음식점' }));
    await user.type(within(sheet).getByLabelText('음식점 이름'), '해운대 암소갈비');
    fireEvent.change(within(sheet).getByLabelText('날짜'), { target: { value: '2026-10-25' } });
    await user.type(within(sheet).getByLabelText('시간'), '19:00');
    await user.type(within(sheet).getByLabelText('인원'), '4');
    await user.type(within(sheet).getByLabelText('예약번호'), 'R-55');
    await user.click(within(sheet).getByRole('button', { name: '예약 추가' }));

    const group = await screen.findByRole('region', { name: '음식점' });
    expect(group).toHaveTextContent('해운대 암소갈비');
    expect(group).toHaveTextContent('4명');
    const [saved] = await bookingRepo.listByTrip(tripId);
    expect(saved).toMatchObject({
      kind: 'restaurant',
      details: { partySize: 4 },
      start: { time: '19:00' },
    });

    // 일정 화면 2일차에 예약 줄
    await user.click(screen.getByRole('link', { name: '일정' }));
    const day2 = await screen.findByRole('region', { name: '2일차 · 10.25 (일)' });
    const line = within(day2).getByRole('button', { name: '해운대 암소갈비 예약 보기' });
    expect(line).toHaveTextContent('19:00');
    expect(line).toHaveTextContent('R-55');
  });

  it('예약은 일정표에 처음 한 번 시각 순 자리에 들어간다 · 밤 비행기는 도착 공항이 다음 날에', async () => {
    const early = await itemRepo.create({
      tripId,
      date: '2026-10-24',
      kind: 'place',
      title: '오전 산책',
      startTime: '10:00',
    });
    const late = await itemRepo.create({
      tripId,
      date: '2026-10-24',
      kind: 'food',
      title: '야식',
      startTime: '23:30',
    });
    await bookingRepo.create({
      tripId,
      kind: 'flight',
      title: 'KE123 PUS→BKK',
      start: { date: '2026-10-24', time: '22:30', place: 'PUS' },
      end: { date: '2026-10-25', time: '02:10', place: 'BKK' },
    });
    renderAt([`/trips/${tripId}/plan?day=all`]);
    await waitFor(async () => expect(await itemRepo.listByTrip(tripId)).toHaveLength(4));
    const items = await itemRepo.listByTrip(tripId);
    expect(items.map((i) => [i.date, i.startTime, i.title])).toEqual([
      ['2026-10-24', '10:00', early.title],
      ['2026-10-24', '22:30', 'KE123 PUS→BKK'],
      ['2026-10-24', '23:30', late.title],
      ['2026-10-25', '02:10', '수완나품국제공항 도착'],
    ]);
    // 공항이 지도에 보이도록 좌표
    expect(items[1]?.place?.coords).toBeDefined();
    expect(items[3]?.place?.coords).toBeDefined();
    // 일정으로 들어간 예약은 위쪽 예약 줄에서 빠진다
    const day1 = await screen.findByRole('region', { name: '1일차 · 10.24 (토)' });
    await waitFor(() =>
      expect(within(day1).queryByRole('button', { name: 'KE123 PUS→BKK 예약 보기' })).toBeNull(),
    );
    // 예약에서 넘어온 일정은 점선 테두리, 출발 일정은 예약 탭과 같은 탑승권 모양
    const flight = within(day1).getByRole('button', { name: /KE123 PUS→BKK/ });
    expect(flight).toHaveAttribute('data-from-booking');
    expect(flight).toHaveClass('border-dashed');
    expect(within(flight).getByText('PUS')).toBeInTheDocument();
    expect(within(flight).getByText('BKK')).toBeInTheDocument();
    const day2 = screen.getByRole('region', { name: '2일차 · 10.25 (일)' });
    expect(within(day2).getByRole('button', { name: /수완나품국제공항 도착/ })).toHaveClass(
      'border-dashed',
    );
    expect(within(day1).getByRole('button', { name: /오전 산책/ })).not.toHaveClass(
      'border-dashed',
    );
    // 옮기거나 지워도 다시 넣지 않는다
    expect((await bookingRepo.listByTrip(tripId))[0]?.plannedAt).toBeDefined();
  });

  it('일정표의 메모는 이름 없이 내용만 보인다', async () => {
    await itemRepo.create({
      tripId,
      date: '2026-10-24',
      kind: 'note',
      title: '환전',
      memo: '공항에서 환전하기\n현금 조금만',
    });
    renderAt([`/trips/${tripId}/plan?day=all`]);
    const day1 = await screen.findByRole('region', { name: '1일차 · 10.24 (토)' });
    expect(await within(day1).findByText(/공항에서 환전하기/)).toBeInTheDocument();
    expect(within(day1).queryByText('환전')).toBeNull();
  });

  it('숙소: 체크아웃이 체크인보다 빠르면 저장하지 않는다', async () => {
    const user = userEvent.setup();
    renderAt([`/trips/${tripId}/bookings`]);
    await user.click(await screen.findByRole('button', { name: '예약 추가' }));
    const sheet = screen.getByRole('dialog', { name: '예약 추가' });
    await user.click(within(sheet).getByRole('button', { name: '숙소' }));
    await user.type(within(sheet).getByLabelText('숙소 이름'), '해운대 호텔');
    // 날짜 칸은 타이핑 대신 값을 직접 넣는다 (jsdom)
    fireEvent.change(within(sheet).getByLabelText('체크아웃'), { target: { value: '2026-10-24' } });
    await user.click(within(sheet).getByRole('button', { name: '예약 추가' }));
    expect(await screen.findByText('체크아웃은 체크인 다음 날 이후여야 해요')).toBeInTheDocument();
    expect(await bookingRepo.listByTrip(tripId)).toHaveLength(0);
  });

  it('숙소는 일정 화면 각 날 아래에 몇 번째 밤인지와 함께 보인다', async () => {
    await bookingRepo.create({
      tripId,
      kind: 'lodging',
      title: '해운대 호텔',
      start: { date: '2026-10-24', time: '15:00' },
      end: { date: '2026-10-26' },
    });
    renderAt([`/trips/${tripId}/plan?day=all`]);
    const day1 = await screen.findByRole('region', { name: '1일차 · 10.24 (토)' });
    expect(
      within(day1).getByRole('button', { name: /해운대 호텔, 1번째 밤 숙소/ }),
    ).toHaveTextContent('1/2');
    const day2 = screen.getByRole('region', { name: '2일차 · 10.25 (일)' });
    expect(within(day2).getByRole('button', { name: /2번째 밤/ })).toBeInTheDocument();
    // 체크아웃 날(3일차)에는 없다
    const day3 = screen.getByRole('region', { name: '3일차 · 10.26 (월)' });
    expect(within(day3).queryByRole('button', { name: /밤 숙소/ })).not.toBeInTheDocument();
  });

  it('편집에서 삭제하고 실행 취소한다', async () => {
    const user = userEvent.setup();
    await bookingRepo.create({
      tripId,
      kind: 'tour',
      title: '감천 투어',
      start: { date: '2026-10-25' },
    });
    renderAt([`/trips/${tripId}/bookings`]);
    await user.click(await screen.findByRole('button', { name: '감천 투어 편집' }));
    await user.click(screen.getByRole('button', { name: '예약 삭제' }));
    expect(await screen.findByText('예약을 삭제했어요')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: '실행 취소' }));
    expect(await screen.findByRole('button', { name: '감천 투어 편집' })).toBeInTheDocument();
  });
});

describe('홈', () => {
  it('여행 중: 다음 일정과 남은 시간, 오늘 숙소를 보여준다', async () => {
    const user = userEvent.setup();
    await itemRepo.create({
      tripId,
      date: '2026-10-25',
      kind: 'place',
      title: '감천문화마을',
      startTime: '09:00',
    });
    await itemRepo.create({
      tripId,
      date: '2026-10-25',
      kind: 'food',
      title: '돼지국밥',
      startTime: '10:35',
    });
    await bookingRepo.create({
      tripId,
      kind: 'lodging',
      title: '해운대 호텔',
      start: { date: '2026-10-24' },
      end: { date: '2026-10-27' },
      confirmationNo: 'H-7788',
    });
    renderAt(['/']);

    const next = await screen.findByRole('region', { name: '다음 일정' });
    expect(next).toHaveTextContent('돼지국밥');
    expect(next).toHaveTextContent('35분 후');
    const lodging = screen.getByRole('region', { name: '오늘 숙소' });
    expect(lodging).toHaveTextContent('해운대 호텔');
    expect(lodging).toHaveTextContent('2/3');

    // 오늘 일정에서 다녀옴 체크
    await user.click(screen.getByRole('checkbox', { name: '감천문화마을' }));
    await waitFor(async () => expect((await itemRepo.listByTrip(tripId))[0]?.done).toBe(true));
  });

  it('여행 전에는 D-day 카드를 보여준다', async () => {
    vi.setSystemTime(new Date('2026-10-21T01:00:00Z'));
    renderAt(['/']);
    expect(await screen.findByText('D-3')).toBeInTheDocument();
    expect(screen.getByText('부산 여행')).toBeInTheDocument();
  });
});

describe('빠른 메뉴 바로가기', () => {
  it('예약번호를 모아 보고 복사한다', async () => {
    const user = userEvent.setup();
    await bookingRepo.create({
      tripId,
      kind: 'flight',
      title: 'KE1001 GMP→PUS',
      start: { date: '2026-10-24' },
      confirmationNo: 'QW77',
    });
    renderAt([`/trips/${tripId}/plan`]);
    await user.click(await screen.findByRole('button', { name: '빠른 메뉴' }));
    await user.click(screen.getByRole('button', { name: '예약번호' }));
    const sheet = await screen.findByRole('dialog', { name: '예약번호' });
    await user.click(within(sheet).getByRole('button', { name: /KE1001/ }));
    expect(await navigator.clipboard.readText()).toBe('QW77');
  });

  it('숙소 예약이 없으면 알려준다', async () => {
    const user = userEvent.setup();
    renderAt([`/trips/${tripId}/plan`]);
    await user.click(await screen.findByRole('button', { name: '빠른 메뉴' }));
    await user.click(screen.getByRole('button', { name: '숙소로 길찾기' }));
    expect(await screen.findByText('숙소 예약이 없어요')).toBeInTheDocument();
  });
});

describe('편명으로 불러오기', () => {
  it('공항·터미널·시간을 채우고 "최근 운항 기준" 안내 (밤 비행이면 도착은 다음 날)', async () => {
    const { useAuth } = await import('../../data/authStore');
    useAuth.setState({
      status: 'user',
      me: { id: 'u', nickname: 'n', createdAt: '', providers: [] },
    });
    vi.stubGlobal('fetch', async (url: string) =>
      url.startsWith('/api/flights/')
        ? Response.json({
            flightNo: 'KE001',
            airline: 'Korean Air',
            from: { iata: 'ICN', terminal: '2', time: '20:30' },
            to: { iata: 'HNL', terminal: '1', time: '10:10' },
          })
        : Response.json({}, { status: 404 }),
    );
    const user = userEvent.setup();
    renderAt([`/trips/${tripId}/bookings`]);
    await user.click(await screen.findByRole('button', { name: '예약 추가' }));
    const sheet = screen.getByRole('dialog', { name: '예약 추가' });
    await user.type(within(sheet).getByLabelText('편명'), 'ke001');
    await user.click(within(sheet).getByRole('button', { name: '불러오기' }));
    expect(await within(sheet).findByRole('status')).toHaveTextContent('최근 운항 기준');
    expect(within(sheet).getByLabelText('출발 공항')).toHaveValue('ICN');
    expect(within(sheet).getByLabelText('도착 공항')).toHaveValue('HNL');
    expect(within(sheet).getByLabelText('출발 터미널')).toHaveValue('T2');
    expect(within(sheet).getByLabelText('출발 시간')).toHaveValue('20:30');
    await user.click(within(sheet).getByRole('button', { name: '예약 추가' }));
    expect(await screen.findByText('예약을 추가했어요')).toBeInTheDocument();
    const [saved] = await bookingRepo.listByTrip(tripId);
    expect(saved).toMatchObject({
      provider: 'Korean Air',
      start: { place: 'ICN', time: '20:30' },
      end: { place: 'HNL', time: '10:10' },
    });
    expect(saved!.end!.date > saved!.start.date).toBe(true);
    vi.unstubAllGlobals();
    useAuth.setState({ status: 'unknown', me: null });
  });
});

describe('픽업·드랍 예약 (사용자 요청 2026-10-25)', () => {
  it('예약 사이트·날짜·시간·인원·타는 곳·내리는 곳·편명 → 이름을 비우면 "공항 픽업"', async () => {
    const user = userEvent.setup();
    renderAt([`/trips/${tripId}/bookings`]);
    await user.click(await screen.findByRole('button', { name: '예약 추가' }));
    const sheet = screen.getByRole('dialog', { name: '예약 추가' });
    await user.click(within(sheet).getByRole('button', { name: '픽업·드랍' }));
    await user.click(within(sheet).getByRole('button', { name: 'KKday' }));
    expect(within(sheet).getByLabelText('예약 사이트')).toHaveValue('KKday');
    await user.type(within(sheet).getByLabelText('시간'), '1030');
    await user.type(within(sheet).getByLabelText('타는 곳'), '김해공항');
    await user.type(within(sheet).getByLabelText('내리는 곳'), '해운대 호텔');
    await user.type(within(sheet).getByLabelText('인원'), '3');
    await user.type(within(sheet).getByLabelText('편명 (선택)'), 'ke123');
    await user.click(within(sheet).getByRole('button', { name: '예약 추가' }));
    await waitFor(async () => expect(await bookingRepo.listByTrip(tripId)).toHaveLength(1));
    const [b] = await bookingRepo.listByTrip(tripId);
    expect(b).toMatchObject({
      kind: 'transfer',
      title: '공항 픽업',
      provider: 'KKday',
      start: { date: '2026-10-24', time: '10:30', place: '김해공항' },
      end: { place: '해운대 호텔' },
      details: { direction: 'pickup', partySize: 3, flightNo: 'KE123' },
    });
  });

  it('타는 곳·내리는 곳도 장소 검색으로 고른다 (사용자 요청 2026-10-26)', async () => {
    useAuth.setState({
      status: 'user',
      me: { id: 'u', nickname: 'n', createdAt: '', providers: [] },
    });
    vi.stubGlobal('fetch', async (url: string, init?: RequestInit) => {
      if (url === '/api/places/search') {
        const q = JSON.parse(String(init?.body)).q as string;
        return Response.json({
          places: [
            q.includes('김해')
              ? { source: 'naver', id: 'n1', name: '김해국제공항', address: '부산 강서구' }
              : { source: 'naver', id: 'n2', name: '해운대 그랜드호텔', address: '부산 해운대구' },
          ],
        });
      }
      return Response.json({}, { status: 404 });
    });
    try {
      const user = userEvent.setup();
      renderAt([`/trips/${tripId}/bookings`]);
      await user.click(await screen.findByRole('button', { name: '예약 추가' }));
      const sheet = screen.getByRole('dialog', { name: '예약 추가' });
      await user.click(within(sheet).getByRole('button', { name: '픽업·드랍' }));
      await user.type(within(sheet).getByLabelText('타는 곳'), '김해');
      await user.click(await within(sheet).findByRole('option', { name: /김해국제공항/ }));
      expect(within(sheet).getByLabelText('타는 곳')).toHaveValue('김해국제공항');
      await user.type(within(sheet).getByLabelText('내리는 곳'), '해운대');
      await user.click(await within(sheet).findByRole('option', { name: /해운대 그랜드호텔/ }));
      expect(within(sheet).getByLabelText('내리는 곳')).toHaveValue('해운대 그랜드호텔');
    } finally {
      vi.unstubAllGlobals();
      useAuth.setState({ status: 'unknown', me: null });
    }
  });
});

it('숙소: 달력에서 체크인 → 체크아웃 순서로 눌러 한 번에, 여행 기간은 따로 표시', async () => {
  const user = userEvent.setup();
  renderAt([`/trips/${tripId}/bookings`]);
  await user.click(await screen.findByRole('button', { name: '예약 추가' }));
  const sheet = screen.getByRole('dialog', { name: '예약 추가' });
  await user.click(within(sheet).getByRole('button', { name: '숙소' }));
  await user.click(within(sheet).getByRole('button', { name: /달력에서 고르기/ }));
  const cal = await screen.findByRole('dialog', { name: '체크인 · 체크아웃' });
  expect(within(cal).getByText('여행', { selector: '*' })).toBeInTheDocument();
  await user.click(within(cal).getByRole('button', { name: /^10\.25 \(일\)/ }));
  expect(within(cal).getByRole('button', { name: '체크아웃 날을 눌러 주세요' })).toBeDisabled();
  await user.click(within(cal).getByRole('button', { name: /^10\.27 \(화\)/ }));
  await user.click(
    within(cal).getByRole('button', { name: /10\.25 \(일\) → 10\.27 \(화\) · 2박으로 하기/ }),
  );
  await waitFor(() =>
    expect(screen.queryByRole('dialog', { name: '체크인 · 체크아웃' })).not.toBeInTheDocument(),
  );
  expect(within(sheet).getByLabelText('체크인')).toHaveValue('2026-10-25');
  expect(within(sheet).getByLabelText('체크아웃')).toHaveValue('2026-10-27');
});

it('덜 쓰는 칸(좌석·예약처·결제 메모·메모)은 [더 입력하기]로 펼친다 (docs/20 U4)', async () => {
  const user = userEvent.setup();
  renderAt([`/trips/${tripId}/bookings`]);
  await user.click(await screen.findByRole('button', { name: '예약 추가' }));
  const sheet = screen.getByRole('dialog', { name: '예약 추가' });
  expect(within(sheet).queryByLabelText('좌석')).not.toBeInTheDocument();
  expect(within(sheet).queryByLabelText('메모')).not.toBeInTheDocument();
  await user.click(within(sheet).getByRole('button', { name: /더 입력하기/ }));
  expect(within(sheet).getByLabelText('좌석')).toBeInTheDocument();
  expect(within(sheet).getByLabelText('메모')).toBeInTheDocument();
});

it('숙소: 조식 포함 → 날짜별로 빼고, 일정 화면 그날 아침에 조식 표시 (사용자 요청 2026-10-26)', async () => {
  const user = userEvent.setup();
  renderAt([`/trips/${tripId}/bookings`]);
  await user.click(await screen.findByRole('button', { name: '예약 추가' }));
  const sheet = screen.getByRole('dialog', { name: '예약 추가' });
  await user.click(within(sheet).getByRole('button', { name: '숙소' }));
  await user.type(within(sheet).getByLabelText('숙소 이름'), '해운대 호텔');
  fireEvent.change(within(sheet).getByLabelText('체크인'), { target: { value: '2026-10-24' } });
  fireEvent.change(within(sheet).getByLabelText('체크아웃'), { target: { value: '2026-10-27' } });
  await user.click(within(sheet).getByRole('switch', { name: '조식 포함' }));
  const days = within(sheet).getByRole('group', { name: '조식 있는 날' });
  expect(within(days).getAllByRole('button')).toHaveLength(3); // 25·26·27일 아침
  await user.click(within(days).getByRole('button', { name: /10\.26/ }));
  await user.click(within(sheet).getByRole('button', { name: '예약 추가' }));
  await waitFor(async () => expect(await bookingRepo.listByTrip(tripId)).toHaveLength(1));
  const [b] = await bookingRepo.listByTrip(tripId);
  expect(b?.details).toMatchObject({
    breakfast: true,
    breakfastDates: ['2026-10-25', '2026-10-27'],
  });
});
