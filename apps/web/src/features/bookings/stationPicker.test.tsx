import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { KR_STATIONS, krStationsFor, stationKindOf } from '../../data/krStations';
import { StationPicker } from './StationPicker';

describe('국내 역·터미널 목록', () => {
  it('칩으로 노선, 도시로 지역을 거른다 · 이름은 겹치지 않는다', () => {
    expect(new Set(KR_STATIONS.map((s) => s.name)).size).toBe(KR_STATIONS.length);
    expect(krStationsFor('SRT', '부산').map((s) => s.name)).toEqual(['부산역']);
    expect(krStationsFor('KTX', '강릉').map((s) => s.name)).toEqual(['강릉역', '정동진역']);
    expect(krStationsFor('고속버스', '강릉').map((s) => s.name)).toEqual(['강릉고속버스터미널']);
    // 칩이 없으면 기차역 전체 (터미널 빼고)
    expect(krStationsFor('', '').map((s) => s.name)).not.toContain('동서울종합터미널');
  });

  it('해외 찾기 종류: 칩 이름으로', () => {
    expect(stationKindOf('MTR')).toBe('subway');
    expect(stationKindOf('그레이하운드 버스')).toBe('bus');
    expect(stationKindOf('신칸센')).toBe('train');
  });
});

describe('역 고르기', () => {
  it('국내: 드롭다운에서 고르고, 도시에 맞는 곳이 하나면 바로 고른다', async () => {
    const user = userEvent.setup();
    const onPick = vi.fn();
    render(<StationPicker label="출발역" chip="고속버스" domestic onPick={onPick} />);
    await user.selectOptions(
      screen.getByRole('combobox', { name: '출발역 고르기' }),
      '동서울종합터미널',
    );
    expect(onPick).toHaveBeenLastCalledWith('동서울종합터미널');
    await user.type(screen.getByRole('textbox', { name: '출발역 도시' }), '속초');
    expect(onPick).toHaveBeenLastCalledWith('속초고속버스터미널');
  });

  it('해외: 도시 이름으로 서버에 묻고, 고르면 이름과 좌표', async () => {
    const sent: string[] = [];
    vi.stubGlobal('fetch', async (_u: string, init?: RequestInit) => {
      sent.push(String(init?.body));
      return Response.json({
        stations: [
          {
            name: '신오사카역',
            local: 'Shin-Osaka',
            address: '오사카',
            coords: { lat: 34.73, lng: 135.5 },
          },
        ],
      });
    });
    try {
      const user = userEvent.setup();
      const onPick = vi.fn();
      render(
        <StationPicker
          label="도착역"
          chip="신칸센"
          domestic={false}
          country="JP"
          onPick={onPick}
        />,
      );
      await user.type(screen.getByRole('textbox', { name: '도착역 도시' }), '오사카');
      await user.click(screen.getByRole('button', { name: /역 찾기/ }));
      const list = await screen.findByRole('list', { name: '도착역 찾은 곳' });
      await user.click(within(list).getByRole('button', { name: /신오사카역/ }));
      expect(onPick).toHaveBeenCalledWith('신오사카역', { lat: 34.73, lng: 135.5 });
      expect(JSON.parse(sent[0]!)).toEqual({ city: '오사카', cc: 'JP', kind: 'train' });
      await waitFor(() => expect(screen.queryByRole('list')).toBeNull());
    } finally {
      vi.unstubAllGlobals();
    }
  });
});
