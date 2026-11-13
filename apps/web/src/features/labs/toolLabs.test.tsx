import { act, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { resetLocalDb } from '../../data/dev';
import { LABS, setLab } from '../../data/labsStore';
import { itemRepo } from '../../data/repositories/itemRepo';
import { tripRepo } from '../../data/repositories/tripRepo';
import { Toaster } from '../../shared/ui';
import { useToastStore } from '../../shared/ui/toastStore';
import { BulkAddSheet } from './BulkAddSheet';
import { MapLinkField } from './MapLinkField';
import { QuickTimer } from './QuickTimer';
import { ShiftDaySheet } from './ShiftDaySheet';
import { TimerWatch } from './TimerWatch';
import { setTimer } from './timerStore';
import { UnitConverter } from './UnitConverter';

beforeEach(async () => {
  await resetLocalDb();
});
afterEach(() => {
  for (const id of LABS) setLab(id, false, { silent: true });
  setTimer(null);
  vi.useRealTimers();
});

async function tokyo() {
  return tripRepo.create({
    title: '도쿄',
    destinations: [{ name: '도쿄', kind: 'city', countryCode: 'JP' }],
    startDate: '2026-11-03',
    endDate: '2026-11-04',
    timezone: 'Asia/Tokyo',
    cover: {},
  });
}

it('여러 일정 붙여 넣기: 줄마다 일정, 시각도 함께', async () => {
  const trip = await tokyo();
  const user = userEvent.setup();
  render(<BulkAddSheet open onOpenChange={() => {}} tripId={trip.id} date="2026-11-03" />);
  await user.type(
    await screen.findByRole('textbox', { name: '여러 일정 붙여 넣기' }),
    '10:00 센소지{enter}스카이트리',
  );
  expect(screen.getByRole('list', { name: '넣을 일정' }).children).toHaveLength(2);
  await user.click(screen.getByRole('button', { name: '2개 넣기' }));
  await waitFor(async () => {
    const day = await itemRepo.listByDay(trip.id, '2026-11-03');
    expect(day.map((i) => [i.startTime, i.title])).toEqual([
      ['10:00', '센소지'],
      [undefined, '스카이트리'],
    ]);
  });
});

it('남은 일정 미루기: 30분 미루고 [실행 취소]로 되돌린다', async () => {
  const trip = await tokyo();
  const a = await itemRepo.create({
    tripId: trip.id,
    date: '2026-11-03',
    kind: 'place',
    title: '센소지',
    startTime: '10:00',
    endTime: '11:00',
  });
  const user = userEvent.setup();
  render(
    <>
      <ShiftDaySheet open onOpenChange={() => {}} items={[a]} now={undefined} />
      <Toaster />
    </>,
  );
  await user.click(await screen.findByRole('button', { name: '일정 1개 옮기기' }));
  await waitFor(async () => expect((await itemRepo.get(a.id))?.startTime).toBe('10:30'));
  expect((await itemRepo.get(a.id))?.endTime).toBe('11:30');
  await user.click(await screen.findByRole('button', { name: '실행 취소' }));
  await waitFor(async () => expect((await itemRepo.get(a.id))?.startTime).toBe('10:00'));
});

it('지도 링크로 장소: 켜야 칸이 보이고, 좌표를 찾으면 알려 준다', async () => {
  const found: unknown[] = [];
  const { rerender } = render(<MapLinkField onFound={(p) => found.push(p)} />);
  expect(screen.queryByRole('textbox')).toBeNull();
  setLab('mapLink', true, { silent: true });
  rerender(<MapLinkField onFound={(p) => found.push(p)} />);
  const user = userEvent.setup();
  await user.click(screen.getByRole('textbox', { name: '지도 링크로 위치 넣기' }));
  await user.paste('https://maps.google.com/?q=34.6687,135.5013');
  expect(found).toEqual([{ lat: 34.6687, lng: 135.5013 }]);
  expect(screen.getByText('위치를 찾았어요 · 34.6687, 135.5013')).toBeInTheDocument();
});

it('단위 바꾸기: 77°F → 25°C, 반대로도', async () => {
  setLab('unitConvert', true, { silent: true });
  const user = userEvent.setup();
  render(<UnitConverter />);
  await user.click(screen.getByRole('button', { name: '단위 바꾸기' }));
  await user.type(await screen.findByRole('textbox', { name: '°F' }), '77');
  expect(screen.getByText('25 °C')).toBeInTheDocument();
  await user.click(screen.getByRole('button', { name: '반대로 바꾸기' }));
  expect(screen.getByText('170.6 °F')).toBeInTheDocument();
});

it('타이머: 맞추면 남은 시간, 끝나면 알림 줄', async () => {
  setLab('quickTimer', true, { silent: true });
  const user = userEvent.setup();
  render(
    <>
      <QuickTimer />
      <TimerWatch />
    </>,
  );
  await user.click(screen.getByRole('button', { name: '타이머' }));
  await user.click(await screen.findByRole('button', { name: '10분' }));
  // 메뉴 버튼 옆과 시트 가운데 두 곳
  expect(await screen.findAllByText(/^(10:00|9:5\d)$/)).toHaveLength(2);
  // 끝나는 때를 지금으로 당겨 끝을 확인
  act(() => setTimer(0));
  await waitFor(() =>
    expect(useToastStore.getState().items.map((x) => x.message)).toContain('타이머가 끝났어요'),
  );
});
