import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { createMemoryRouter, RouterProvider } from 'react-router';
import { routes } from '../../app/router';
import { resetLocalDb } from '../../data/dev';
import { useAuth } from '../../data/authStore';
import { db } from '../../data/db';
import { checklistRepo } from '../../data/repositories/checklistRepo';
import { setMemberCounts } from '../../data/tripRoles';
import { templateRepo } from '../../data/repositories/templateRepo';
import { tripRepo } from '../../data/repositories/tripRepo';
import { Toaster } from '../../shared/ui';
import { TEMPLATE_SEEDS, TEMPLATES } from './templates';
import { acceptDelete } from '../../test/confirm';

let tripId = '';

beforeEach(async () => {
  await resetLocalDb();
  const trip = await tripRepo.create({
    title: '도쿄',
    destinations: [{ name: '도쿄', kind: 'city', countryCode: 'JP' }],
    startDate: '2026-10-24',
    endDate: '2026-10-28',
    timezone: 'Asia/Tokyo',
    cover: {},
  });
  tripId = trip.id;
});

function renderAt(...entries: string[]) {
  const router = createMemoryRouter(routes, { initialEntries: entries });
  render(
    <>
      <RouterProvider router={router} />
      <Toaster />
    </>,
  );
  return router;
}

const saveBar = () => screen.queryByRole('region', { name: '저장하지 않은 변경' });

describe('저장소', () => {
  it('applyDraft: 추가·수정·삭제·순서를 한 번에', async () => {
    const a = await checklistRepo.add(tripId, 'packing', { text: '여권', category: '서류' });
    const b = await checklistRepo.add(tripId, 'packing', { text: '우산', category: '기타' });
    await checklistRepo.applyDraft(tripId, 'packing', [
      { text: '충전기', category: '전자기기', checked: false },
      { id: a.id, text: '여권', category: '서류', checked: true },
    ]);
    const list = await checklistRepo.list(tripId, 'packing');
    expect(list.map((i) => [i.text, i.checked])).toEqual([
      ['충전기', false],
      ['여권', true],
    ]);
    expect(list.find((i) => i.id === b.id)).toBeUndefined();
  });

  it('기본 템플릿은 한 번만 복사된다 (지운 뒤 다시 생기지 않음)', async () => {
    await templateRepo.seedOnce(TEMPLATE_SEEDS);
    const packing = await templateRepo.list('packing');
    expect(packing.map((t) => t.name)).toEqual(TEMPLATES.map((t) => t.name));
    await templateRepo.softDelete(packing[0]?.id as string);
    await templateRepo.seedOnce(TEMPLATE_SEEDS);
    expect(await templateRepo.list('packing')).toHaveLength(TEMPLATES.length - 1);
    expect(await templateRepo.list('todo')).toHaveLength(1);
  });
});

describe('준비 탭 (저장·취소)', () => {
  it('추가·체크는 저장 전까지 화면에만 있고, 저장하면 반영된다', async () => {
    const user = userEvent.setup();
    renderAt(`/trips/${tripId}/checklist`);
    const input = await screen.findByLabelText('준비물 추가');
    await user.click(screen.getByRole('radio', { name: '전자기기' }));
    await user.type(input, '보조배터리{Enter}');
    await user.click(await screen.findByRole('checkbox', { name: '보조배터리' }));

    expect(saveBar()).toBeInTheDocument();
    expect(await checklistRepo.list(tripId, 'packing')).toHaveLength(0);

    await user.click(within(saveBar() as HTMLElement).getByRole('button', { name: '저장' }));
    expect(await screen.findByText('저장했어요')).toBeInTheDocument();
    const [saved] = await checklistRepo.list(tripId, 'packing');
    expect(saved).toMatchObject({ text: '보조배터리', category: '전자기기', checked: true });
    await waitFor(() => expect(saveBar()).not.toBeInTheDocument());
  });

  it('취소하면 저장된 상태로 돌아간다', async () => {
    const user = userEvent.setup();
    await checklistRepo.add(tripId, 'packing', { text: '여권', category: '서류' });
    renderAt(`/trips/${tripId}/checklist`);
    await user.click(await screen.findByRole('button', { name: '여권 삭제' }));
    await acceptDelete(user);
    expect(screen.queryByRole('checkbox', { name: '여권' })).not.toBeInTheDocument();
    await user.click(within(saveBar() as HTMLElement).getByRole('button', { name: '취소' }));
    expect(await screen.findByRole('checkbox', { name: '여권' })).toBeInTheDocument();
    expect(saveBar()).not.toBeInTheDocument();
  });

  it('카테고리 칩 + 로 추가하고, 그룹 전체를 지운다', async () => {
    const user = userEvent.setup();
    renderAt(`/trips/${tripId}/checklist`);
    await user.click(await screen.findByRole('button', { name: '카테고리 추가' }));
    await user.type(screen.getByLabelText('새 카테고리'), '캠핑{Enter}');
    expect(screen.getByRole('radio', { name: '캠핑' })).toHaveAttribute('aria-checked', 'true');
    await user.type(screen.getByLabelText('준비물 추가'), '랜턴{Enter}');
    expect(await screen.findByRole('checkbox', { name: '랜턴' })).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: '캠핑 그룹 삭제' }));
    await acceptDelete(user);
    expect(screen.queryByRole('checkbox', { name: '랜턴' })).not.toBeInTheDocument();
    expect(screen.queryByRole('radio', { name: '캠핑' })).not.toBeInTheDocument();
  });

  it('저장하지 않고 다른 탭으로 가려 하면 묻는다', async () => {
    const user = userEvent.setup();
    const router = renderAt(`/trips/${tripId}/checklist`);
    await user.type(await screen.findByLabelText('준비물 추가'), '모자{Enter}');
    await user.click(screen.getByRole('link', { name: '일정' }));
    const dialog = await screen.findByRole('dialog', { name: '저장하지 않은 변경이 있어요' });
    await user.click(within(dialog).getByRole('button', { name: '저장하지 않고 나가기' }));
    await waitFor(() => expect(router.state.location.pathname).toBe(`/trips/${tripId}/plan`));
    expect(await checklistRepo.list(tripId, 'packing')).toHaveLength(0);
  });
});

describe('템플릿 관리', () => {
  it('불러오기 → 저장, 이름 바꾸기, 삭제·실행 취소, 지금 목록을 새 템플릿으로', async () => {
    const user = userEvent.setup();
    renderAt(`/trips/${tripId}/checklist`);
    await user.click(await screen.findByRole('button', { name: '템플릿 불러오기·관리' }));
    let sheet = await screen.findByRole('dialog', { name: '템플릿' });
    await user.click(await within(sheet).findByRole('button', { name: '해외 기본 불러오기' }));
    const n = TEMPLATES[0]?.packing.length ?? 0;
    expect(await screen.findByText(`${n}개를 넣었어요 [저장]을 눌러 주세요`)).toBeInTheDocument();
    await user.click(within(saveBar() as HTMLElement).getByRole('button', { name: '저장' }));
    await waitFor(async () => expect(await checklistRepo.list(tripId, 'packing')).toHaveLength(n));

    await user.click(screen.getByRole('button', { name: '템플릿 불러오기·관리' }));
    sheet = await screen.findByRole('dialog', { name: '템플릿' });
    await user.click(await within(sheet).findByRole('button', { name: '겨울 이름 바꾸기' }));
    // 목록 안의 이름 칸이 맨 위, 새 템플릿 이름 칸이 맨 아래
    const nameInput = within(sheet).getAllByLabelText('템플릿 이름')[0] as HTMLElement;
    await user.clear(nameInput);
    await user.type(nameInput, '스키 여행{Enter}');
    expect(
      await within(sheet).findByRole('button', { name: '스키 여행 불러오기' }),
    ).toBeInTheDocument();

    await user.click(within(sheet).getByRole('button', { name: '아이 동반 삭제' }));
    await acceptDelete(user);
    await waitFor(() =>
      expect(
        within(sheet).queryByRole('button', { name: '아이 동반 불러오기' }),
      ).not.toBeInTheDocument(),
    );
    await user.click(screen.getByRole('button', { name: '실행 취소' }));
    expect(
      await within(sheet).findByRole('button', { name: '아이 동반 불러오기' }),
    ).toBeInTheDocument();

    await user.type(within(sheet).getByPlaceholderText('템플릿 이름'), '우리 가족 기본{Enter}');
    expect(
      await within(sheet).findByRole('button', { name: '우리 가족 기본 불러오기' }),
    ).toHaveTextContent(`${n}개`);
  });

  it('할 일에도 템플릿이 있다', async () => {
    const user = userEvent.setup();
    renderAt(`/trips/${tripId}/checklist`);
    await user.click(await screen.findByRole('radio', { name: '할 일' }));
    await user.click(screen.getByRole('button', { name: '템플릿 불러오기·관리' }));
    const sheet = await screen.findByRole('dialog', { name: '템플릿' });
    await user.click(await within(sheet).findByRole('button', { name: '출발 전 할 일 불러오기' }));
    expect(await screen.findByRole('checkbox', { name: /여권 유효기간/ })).toBeInTheDocument();
  });

  it('빠른 메뉴의 준비물 바로가기', async () => {
    const user = userEvent.setup();
    const router = renderAt(`/trips/${tripId}/plan`);
    await user.click(await screen.findByRole('button', { name: '빠른 메뉴' }));
    await user.click(screen.getByRole('button', { name: '준비물' }));
    await waitFor(() => expect(router.state.location.pathname).toBe(`/trips/${tripId}/checklist`));
  });
});

describe('준비물 개인별 · 일행과 공유 (2026-10-27)', () => {
  afterEach(() => {
    useAuth.setState({ status: 'unknown', me: null });
    setMemberCounts({});
  });

  it('그룹 전체 체크로 공유, 일행이 공유한 것은 따로 보이고 [담기]로 내 목록에', async () => {
    useAuth.setState({
      status: 'user',
      me: { id: 'u-me', nickname: 'n', createdAt: '', providers: [] },
    });
    setMemberCounts({ [tripId]: 2 });
    await checklistRepo.add(tripId, 'packing', { text: '여권', category: '서류' });
    await checklistRepo.add(tripId, 'packing', { text: '항공권', category: '서류' });
    await checklistRepo.add(tripId, 'packing', { text: '충전기', category: '전자기기' });
    // 일행(u-friend)이 공유한 준비물 (동기화로 받은 행)
    await db.checklistItems.add({
      id: 'f1',
      tripId,
      list: 'packing',
      text: '보조배터리',
      category: '전자기기',
      checked: false,
      order: 'a0',
      ownerId: 'u-friend',
      shared: true,
      sharedAt: '2026-10-27T00:00:00.000Z',
      createdAt: '2026-10-27T00:00:00.000Z',
      updatedAt: '2026-10-27T00:00:00.000Z',
      dirty: 0,
    });
    // 일행의 공유 안 한 준비물은 안 보인다
    await db.checklistItems.add({
      id: 'f2',
      tripId,
      list: 'packing',
      text: '비밀 메모',
      checked: false,
      order: 'a1',
      ownerId: 'u-friend',
      createdAt: '2026-10-27T00:00:00.000Z',
      updatedAt: '2026-10-27T00:00:00.000Z',
      dirty: 0,
    });
    const user = userEvent.setup();
    renderAt(`/trips/${tripId}/checklist`);
    const others = await screen.findByRole('region', { name: '일행이 공유한 준비물' });
    expect(within(others).getByText('보조배터리')).toBeInTheDocument();
    expect(screen.queryByText('비밀 메모')).toBeNull();
    // 내 목록에는 일행 것이 섞이지 않는다
    expect((await checklistRepo.list(tripId, 'packing')).map((i) => i.text)).toEqual([
      '여권',
      '항공권',
      '충전기',
    ]);

    await user.click(screen.getByRole('button', { name: '일행과 준비물 공유' }));
    const sheet = await screen.findByRole('dialog', { name: '일행과 공유할 준비물' });
    await user.click(within(sheet).getByRole('checkbox', { name: '서류 전체' }));
    await user.click(within(sheet).getByRole('button', { name: '2개 공유하기' }));
    await waitFor(async () =>
      expect(
        (await checklistRepo.list(tripId, 'packing')).filter((i) => i.shared).map((i) => i.text),
      ).toEqual(['여권', '항공권']),
    );
    expect(
      await screen.findByRole('button', { name: '일행과 공유 중 2개 · 바꾸기' }),
    ).toBeInTheDocument();

    await user.click(within(others).getByRole('button', { name: '보조배터리 내 목록에 담기' }));
    expect(await screen.findByText(/보조배터리 넣었어요/)).toBeInTheDocument();
  });
});
