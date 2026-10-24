import { act, render, screen } from '@testing-library/react';
import { useAuth } from '../../data/authStore';
import { useSync } from '../../data/sync/syncStore';
import { OfflineBanner } from './OfflineBanner';
import { SyncStatusIcon } from './SyncStatusIcon';

afterEach(() => {
  useAuth.setState({ status: 'unknown', me: null });
  useSync.setState({ state: 'idle', pending: 0 });
});

it('동기화 아이콘: 저장됨 → 올리는 중 → 오프라인(기기에 저장됨)', () => {
  useAuth.setState({
    status: 'user',
    me: { id: 'u', nickname: 'n', createdAt: '', providers: [] },
  });
  render(<SyncStatusIcon />);
  expect(screen.getByRole('button', { name: '저장됨' })).toBeInTheDocument();
  act(() => useSync.setState({ pending: 2 }));
  expect(screen.getByRole('button', { name: '올리는 중' })).toBeInTheDocument();
  act(() => useSync.setState({ state: 'offline' }));
  expect(screen.getByRole('button', { name: '오프라인 — 기기에 저장됨' })).toBeInTheDocument();
});

it('오프라인 띠: 끊기면 보이고, 다시 연결되면 잠깐 "다시 연결됐어요"', async () => {
  render(<OfflineBanner />);
  expect(screen.queryByRole('status')).not.toBeInTheDocument();
  act(() => void window.dispatchEvent(new Event('offline')));
  expect(screen.getByRole('status')).toHaveTextContent('오프라인');
  act(() => void window.dispatchEvent(new Event('online')));
  expect(screen.getByRole('status')).toHaveTextContent('다시 연결됐어요');
});
