import { PLAN_FEATURES } from '@trippocket/shared';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router';
import { useAuth } from '../../data/authStore';
import { resetLocalDb } from '../../data/dev';
import { loadSettings, useSettings } from '../../data/settingsStore';
import { resetSettingsConfirmed } from '../../data/settingsSync';
import { PlanFeaturePrompt } from './PlanFeaturePrompt';
import { planPromptRun } from './planPromptRun';

let server: { data: object | null; updatedAt: string | null };
let serverDown = false;

beforeEach(async () => {
  await resetLocalDb();
  await loadSettings();
  planPromptRun.asked = false;
  resetSettingsConfirmed();
  serverDown = false;
  server = { data: null, updatedAt: null };
  useAuth.setState({
    status: 'user',
    me: { id: 'u', nickname: 'n', createdAt: '', providers: [] },
  });
  vi.stubGlobal('fetch', async (_url: string, init?: RequestInit) => {
    if (serverDown) throw new Error('down');
    if (init?.method === 'PUT') {
      const body = JSON.parse(String(init.body)) as { data: object; updatedAt: string };
      server = { data: body.data, updatedAt: body.updatedAt };
    }
    return Response.json(server);
  });
});
afterEach(() => {
  vi.unstubAllGlobals();
  useAuth.setState({ status: 'unknown', me: null });
});

const show = () =>
  render(
    <MemoryRouter>
      <PlanFeaturePrompt />
    </MemoryRouter>,
  );

describe('기능 안내 팝업', () => {
  it('아직 안 물어본 기능 하나를 샘플과 묻고, 고른 값·물어본 기록을 저장한다', async () => {
    const user = userEvent.setup();
    show();
    await user.click(await screen.findByRole('button', { name: '켜기' }));
    expect(screen.queryByRole('button', { name: '켜기' })).not.toBeInTheDocument();
    const s = useSettings.getState();
    expect(s.planPromptSeen).toHaveLength(1);
    expect(s[s.planPromptSeen[0]!]).toBe(true);
    await waitFor(() => expect(server.data).toMatchObject({ planPromptSeen: s.planPromptSeen }));
  });

  it('위치 안내를 아래에 보여 주고, 끄기를 고르면 꺼진 채 기록만 남는다', async () => {
    const user = userEvent.setup();
    show();
    expect(await screen.findByText('마이 → 설정 → 일정에서 바꿀 수 있어요')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: '끄기' }));
    const s = useSettings.getState();
    expect(s.planPromptSeen).toHaveLength(1);
    expect(s[s.planPromptSeen[0]!]).toBe(false);
  });

  it('다른 기기에서 다 물어봤으면 묻지 않는다', async () => {
    server = {
      data: { planPromptV: 1, planPromptSeen: [...PLAN_FEATURES] },
      updatedAt: '2030-01-01T00:00:00.000Z',
    };
    show();
    await waitFor(() => expect(useSettings.getState().planPromptSeen).toHaveLength(13));
    expect(screen.queryByRole('button', { name: '켜기' })).not.toBeInTheDocument();
  });

  it('계정 설정을 못 받으면(오프라인) 묻지 않는다 — 다음 접속 때 다시 판단', async () => {
    serverDown = true;
    show();
    await new Promise((r) => setTimeout(r, 50));
    expect(screen.queryByRole('button', { name: '켜기' })).not.toBeInTheDocument();
    expect(useSettings.getState().planPromptSeen).toEqual([]);
    expect(planPromptRun.asked).toBe(false);
  });
});
