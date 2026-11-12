import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import { BottomSheet } from './BottomSheet';
import { ConfirmHost } from './ConfirmHost';
import { closeConfirm, confirmDelete } from './confirmStore';

/** 예약 입력 → 최저가 비교 → 가격 적기처럼 시트 안에서 시트를 여는 화면 */
function Nested() {
  const [outer, setOuter] = useState(true);
  const [inner, setInner] = useState(false);
  const [third, setThird] = useState(false);
  return (
    <BottomSheet open={outer} onOpenChange={setOuter} title="예약 입력">
      <input aria-label="메모" />
      <button type="button" onClick={() => setInner(true)}>
        최저가 비교
      </button>
      <BottomSheet open={inner} onOpenChange={setInner} title="최저가">
        <input aria-label="숙소 이름" />
        <button type="button" onClick={() => setThird(true)}>
          가격 적기
        </button>
        <BottomSheet open={third} onOpenChange={setThird} title="가격 적기">
          <p>본 가격을 적어 주세요</p>
        </BottomSheet>
      </BottomSheet>
    </BottomSheet>
  );
}

// 숨은 시트는 접근성 트리에서 빠지므로(이름으로 못 찾음) 제목 글자로 찾는다
const sheet = (name: string) =>
  waitFor(() => {
    const found = [...document.querySelectorAll<HTMLElement>('[role="dialog"]')].find(
      (el) => el.querySelector('h2')?.textContent === name,
    );
    if (!found) throw new Error(`시트 없음: ${name}`);
    return found;
  });
const hidden = (el: HTMLElement) => el.classList.contains('invisible');

/** 2026-11-12 사용자 요청: 창 위에 또 창이 뜨면 헷갈린다 → 한 번에 하나만 */
describe('시트 위의 시트', () => {
  it('혼자 열린 시트에는 "뒤로"가 없다', async () => {
    render(<Nested />);
    expect(hidden(await sheet('예약 입력'))).toBe(false);
    expect(screen.queryByRole('button', { name: '뒤로' })).toBeNull();
  });

  it('안쪽 시트가 열리면 바깥 시트는 숨고, "뒤로"를 누르면 입력하던 내용 그대로 돌아온다', async () => {
    const user = userEvent.setup();
    render(<Nested />);
    await user.type(await screen.findByLabelText('메모'), '조식 포함');
    await user.click(screen.getByRole('button', { name: '최저가 비교' }));

    const inner = await sheet('최저가');
    expect(hidden(inner)).toBe(false);
    expect(hidden(await sheet('예약 입력'))).toBe(true);
    // 첫 포커스는 "뒤로"가 아니라 입력칸 (휴대폰 키보드가 전처럼 바로 뜬다)
    await waitFor(() => expect(screen.getByLabelText('숙소 이름')).toHaveFocus());

    await user.click(screen.getByRole('button', { name: '뒤로' }));
    await waitFor(() => expect(screen.queryByRole('dialog', { name: '최저가' })).toBeNull());
    expect(hidden(await sheet('예약 입력'))).toBe(false);
    expect(screen.getByLabelText('메모')).toHaveValue('조식 포함');
    expect(screen.queryByRole('button', { name: '뒤로' })).toBeNull();
  });

  it('3겹이면 맨 위 하나만 보이고, 닫을 때마다 한 겹씩 돌아온다 (ESC도 맨 위만 닫는다)', async () => {
    const user = userEvent.setup();
    render(<Nested />);
    await user.click(await screen.findByRole('button', { name: '최저가 비교' }));
    await user.click(await screen.findByRole('button', { name: '가격 적기' }));

    expect(hidden(await sheet('가격 적기'))).toBe(false);
    expect(hidden(await sheet('최저가'))).toBe(true);
    expect(hidden(await sheet('예약 입력'))).toBe(true);

    await user.keyboard('{Escape}');
    await waitFor(() => expect(screen.queryByRole('dialog', { name: '가격 적기' })).toBeNull());
    expect(hidden(await sheet('최저가'))).toBe(false);
    expect(hidden(await sheet('예약 입력'))).toBe(true);

    await user.keyboard('{Escape}');
    await waitFor(() => expect(screen.queryByRole('dialog', { name: '최저가' })).toBeNull());
    expect(hidden(await sheet('예약 입력'))).toBe(false);
  });

  it('삭제 확인 창은 아래 시트를 숨기되 "뒤로"는 두지 않는다 (취소·삭제가 곧 답)', async () => {
    render(
      <>
        <BottomSheet open onOpenChange={() => {}} title="일정 상세">
          <p>내용</p>
        </BottomSheet>
        <ConfirmHost />
      </>,
    );
    await sheet('일정 상세');
    const answer = confirmDelete('이 일정을 지울까요');
    await waitFor(async () => expect(hidden(await sheet('일정 상세'))).toBe(true));
    expect(screen.getByRole('button', { name: '취소' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: '뒤로' })).toBeNull();
    closeConfirm(false);
    await expect(answer).resolves.toBe(false);
    await waitFor(async () => expect(hidden(await sheet('일정 상세'))).toBe(false));
  });
});
