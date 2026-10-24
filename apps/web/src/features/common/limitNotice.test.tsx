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
  expect(await screen.findByRole('dialog', { name: '사용량 한도에 닿았어요' })).toHaveTextContent(
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
