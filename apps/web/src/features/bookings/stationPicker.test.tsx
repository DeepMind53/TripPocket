import type { Booking } from '@trippocket/shared';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import { MemoryRouter } from 'react-router';
import { describe, expect, it, vi } from 'vitest';
import { KR_STATIONS, krStationsFor, stationKindOf } from '../../data/krStations';
import { BookingCard } from './BookingCard';
import { StationField, type PickedStation } from './StationPicker';

describe('국내 역·터미널 목록', () => {
  it('칩으로 노선, 도시로 지역을 거른다 · 이름은 겹치지 않는다', () => {
    expect(new Set(KR_STATIONS.map((s) => s.name)).size).toBe(KR_STATIONS.length);
    expect(krStationsFor('SRT', '부산').map((s) => s.name)).toEqual(['부산역']);
    expect(krStationsFor('KTX', '강릉').map((s) => s.name)).toEqual(['강릉역', '정동진역']);
    expect(krStationsFor('고속버스', '강릉').map((s) => s.name)).toEqual(['강릉고속버스터미널']);
    expect(krStationsFor('', '').map((s) => s.name)).not.toContain('동서울종합터미널');
  });

  it('해외 찾기 종류: 칩 이름으로', () => {
    expect(stationKindOf('MTR')).toBe('subway');
    expect(stationKindOf('그레이하운드 버스')).toBe('bus');
    expect(stationKindOf('신칸센')).toBe('train');
  });
});

/** 실제 폼처럼 값을 들고 있는 감싸개 */
function Harness(props: {
  domestic: boolean;
  chip: string;
  country?: string;
  onPick: (p: PickedStation) => void;
}) {
  const [p, setP] = useState<PickedStation>({ name: '' });
  return (
    <StationField
      id="st"
      label="출발역"
      value={p.name}
      address={p.address}
      chip={props.chip}
      domestic={props.domestic}
      country={props.country}
      onChange={(next) => {
        setP(next);
        props.onPick(next);
      }}
    />
  );
}

describe('역 칸 하나 (2026-11-03)', () => {
  it('국내: 도시를 치면 그 도시 역이 아래에, 고르면 장소 검색으로 주소·좌표까지', async () => {
    vi.stubGlobal('fetch', async () =>
      Response.json({
        places: [
          {
            name: '동대구역',
            address: '대구 동구 동대구로 550',
            coords: { lat: 35.88, lng: 128.63 },
          },
        ],
      }),
    );
    try {
      const user = userEvent.setup();
      const onPick = vi.fn();
      render(<Harness domestic chip="KTX" onPick={onPick} />);
      await user.type(screen.getByRole('combobox'), '대구');
      const list = screen.getByRole('listbox', { name: '출발역 후보' });
      await user.click(within(list).getByRole('button', { name: /동대구역/ }));
      await waitFor(() =>
        expect(onPick).toHaveBeenLastCalledWith({
          name: '동대구역',
          address: '대구 동구 동대구로 550',
          coords: { lat: 35.88, lng: 128.63 },
        }),
      );
      expect(screen.getByRole('combobox')).toHaveValue('동대구역');
      expect(screen.getByText('대구 동구 동대구로 550')).toBeInTheDocument();
    } finally {
      vi.unstubAllGlobals();
    }
  });

  it('해외: 친 도시로 서버에 묻고, 고르면 이름·주소·좌표', async () => {
    const sent: string[] = [];
    vi.stubGlobal('fetch', async (_u: string, init?: RequestInit) => {
      sent.push(String(init?.body));
      return Response.json({
        stations: [
          {
            name: '신오사카역',
            local: 'Shin-Osaka',
            address: '오사카 요도가와구',
            coords: { lat: 34.73, lng: 135.5 },
          },
        ],
      });
    });
    try {
      const user = userEvent.setup();
      const onPick = vi.fn();
      render(<Harness domestic={false} chip="신칸센" country="JP" onPick={onPick} />);
      await user.type(screen.getByRole('combobox'), '오사카');
      const option = await screen.findByRole('button', { name: /신오사카역/ }, { timeout: 3000 });
      await user.click(option);
      expect(onPick).toHaveBeenLastCalledWith({
        name: '신오사카역',
        address: '오사카 요도가와구',
        coords: { lat: 34.73, lng: 135.5 },
      });
      expect(JSON.parse(sent.at(-1)!)).toEqual({ city: '오사카', cc: 'JP', kind: 'train' });
    } finally {
      vi.unstubAllGlobals();
    }
  });
});

// 탑승권 모양 (사용자 결정 2026-11-10): 윗줄 그대로, 출발역·도착역 크게 + 아래 시각, 절취선
it('예약 카드: "KTX 12월23일 (수요일)" · 동대구역 13:32 ┈ 수원역 15:44 탑승권', () => {
  const b = {
    id: 'b',
    tripId: 't',
    kind: 'train',
    title: 'KTX',
    start: { date: '2026-12-23', time: '13:32', place: '동대구역' },
    end: { date: '2026-12-23', time: '15:44', place: '수원역' },
    createdAt: '2026-11-03T00:00:00.000Z',
    updatedAt: '2026-11-03T00:00:00.000Z',
  } as Booking;
  render(
    <MemoryRouter>
      <BookingCard booking={b} onOpen={() => {}} />
    </MemoryRouter>,
  );
  expect(screen.getByText('12월23일 (수요일)')).toBeInTheDocument();
  for (const s of ['동대구역', '13:32', '수원역', '15:44'])
    expect(screen.getByText(s)).toBeInTheDocument();
  // 출발이 도착보다 앞에 온다
  const card = screen.getByRole('button', { name: /KTX/ });
  expect(card.textContent!.indexOf('동대구역')).toBeLessThan(card.textContent!.indexOf('수원역'));
});

it('기차는 기차 그림, 버스는 버스 그림 (교통편 이름으로)', async () => {
  const { isBusTitle } = await import('../../domain/travelLeg');
  expect(isBusTitle('KTX')).toBe(false);
  expect(isBusTitle('고속버스')).toBe(true);
  expect(isBusTitle('Greyhound bus')).toBe(true);
});
