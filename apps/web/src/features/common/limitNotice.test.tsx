import { render, screen } from '@testing-library/react';
import { api } from '../../data/api/client';
import { resetLimitNotices, useLimitNotice } from '../../data/limitNotice';
import { LimitNoticeSheet } from './LimitNoticeSheet';

afterEach(() => {
  vi.unstubAllGlobals();
  resetLimitNotices();
});

const reply = (status: number, body: object) =>
  vi.stubGlobal('fetch', async () => Response.json(body, { status }));

it('AI 하루 한도(429) → 이유 팝업, 같은 이유는 한 번만', async () => {
  reply(429, { error: 'daily_limit', feature: 'ai', limit: 20 });
  const res = await api('/api/v1/ai/recommend', { method: 'POST', body: '{}' });
  expect(res).toMatchObject({ ok: false, reason: 'limit', status: 429 });
  render(<LimitNoticeSheet />);
  expect(await screen.findByRole('dialog', { name: '사용량 한도 초과' })).toHaveTextContent(
    'AI 추천은 하루 20번까지예요',
  );
  useLimitNotice.setState({ notice: null });
  await api('/api/v1/ai/recommend', { method: 'POST', body: '{}' });
  expect(useLimitNotice.getState().notice).toBeNull();
});

it('관리자가 멈춘 API(503 api_paused) → 어느 기능이 멈췄는지', async () => {
  reply(503, { error: 'api_paused', api: 'google_places_details' });
  const res = await api('/api/places/google/abc');
  expect(res).toMatchObject({ reason: 'limit' });
  render(<LimitNoticeSheet />);
  expect(await screen.findByRole('dialog')).toHaveTextContent('Google 장소 상세');
});

it('한도가 아닌 503(서버 없음)은 지금처럼 오프라인', async () => {
  reply(503, { error: 'server_not_configured' });
  expect(await api('/api/me')).toMatchObject({ reason: 'offline' });
  expect(useLimitNotice.getState().notice).toBeNull();
});

it('한도로 막히면 대신 볼 페이지: 국내 장소 검색 → 네이버 지도·카카오맵 (검색어 그대로)', async () => {
  const { attachFallback } = await import('../../data/limitNotice');
  const { placeSearchLinks } = await import('../../shared/lib/fallbackLinks');
  const open = vi.fn();
  vi.stubGlobal('open', open);
  reply(429, { error: 'daily_limit', feature: 'places_search' });
  await api('/api/places/search', { method: 'POST', body: '{}' });
  attachFallback(placeSearchLinks('성수 카페', true));
  render(<LimitNoticeSheet />);
  const sheet = await screen.findByRole('dialog');
  (await import('@testing-library/react')).fireEvent.click(
    screen.getByRole('button', { name: /네이버 지도에서 보기/ }),
  );
  expect(open).toHaveBeenCalledWith(
    'https://map.naver.com/p/search/%EC%84%B1%EC%88%98%20%EC%B9%B4%ED%8E%98',
    '_blank',
    'noopener',
  );
  expect(sheet).toHaveTextContent('카카오맵에서 보기');
  expect(placeSearchLinks('Shibuya', false).map((l) => l.id)).toEqual(['googleMap']);
});
