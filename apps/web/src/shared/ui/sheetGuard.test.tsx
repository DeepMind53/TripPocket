import { act, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import { isSubmitEnter } from '../lib/keys';
import { BottomSheet } from './BottomSheet';
import { Button } from './Button';
import { CancelSaveRow } from './CancelSaveRow';
import { ConfirmHost } from './ConfirmHost';
import { useSheetDirty } from './sheetGuard';

/** 일정 추가처럼 시트 안 양식이 처음 값과 비교해 알리는 모양 */
function Form({ onDone }: { onDone: () => void }) {
  const [name, setName] = useState('');
  useSheetDirty(name !== '');
  return (
    <>
      <input aria-label="이름" value={name} onChange={(e) => setName(e.target.value)} />
      <CancelSaveRow onCancel={onDone}>
        <Button onClick={onDone}>저장</Button>
      </CancelSaveRow>
    </>
  );
}

function Screen() {
  const [open, setOpen] = useState(true);
  return (
    <>
      <p>{open ? '열림' : '닫힘'}</p>
      <BottomSheet open={open} onOpenChange={setOpen} title="일정 추가">
        {open && <Form onDone={() => setOpen(false)} />}
      </BottomSheet>
      <ConfirmHost />
    </>
  );
}

/** docs/31 A1·R1 (2026-11-23 사용자 결정: 바뀐 내용이 있을 때만 확인 창, 뒤로 가기는 시트만 닫기) */
describe('입력 시트 닫힘 보호', () => {
  it('아무것도 안 바꿨으면 Esc로 바로 닫힌다', async () => {
    const user = userEvent.setup();
    render(<Screen />);
    await screen.findByLabelText('이름');
    await user.keyboard('{Escape}');
    expect(await screen.findByText('닫힘')).toBeInTheDocument();
  });

  it('입력이 있으면 Esc → 확인 창, [계속 입력]이면 입력 그대로', async () => {
    const user = userEvent.setup();
    render(<Screen />);
    await user.type(await screen.findByLabelText('이름'), '센소지');
    await user.keyboard('{Escape}');
    expect(await screen.findByText('입력한 내용을 버릴까요?')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: '계속 입력' }));
    await waitFor(() => expect(screen.queryByText('입력한 내용을 버릴까요?')).toBeNull());
    expect(screen.getByText('열림')).toBeInTheDocument();
    expect(screen.getByLabelText('이름')).toHaveValue('센소지');
  });

  it('[취소]도 묻고, [버리기]를 누르면 닫힌다', async () => {
    const user = userEvent.setup();
    render(<Screen />);
    await user.type(await screen.findByLabelText('이름'), '센소지');
    await user.click(screen.getByRole('button', { name: '취소' }));
    await user.click(await screen.findByRole('button', { name: '버리기' }));
    expect(await screen.findByText('닫힘')).toBeInTheDocument();
  });

  it('[저장]처럼 양식이 직접 닫으면 묻지 않는다', async () => {
    const user = userEvent.setup();
    render(<Screen />);
    await user.type(await screen.findByLabelText('이름'), '센소지');
    await user.click(screen.getByRole('button', { name: '저장' }));
    expect(await screen.findByText('닫힘')).toBeInTheDocument();
    expect(screen.queryByText('입력한 내용을 버릴까요?')).toBeNull();
  });

  describe('휴대폰 뒤로 가기 (CloseWatcher)', () => {
    const watchers: { onclose: (() => void) | null; destroyed: boolean }[] = [];
    beforeEach(() => {
      watchers.length = 0;
      class FakeWatcher {
        onclose: (() => void) | null = null;
        destroyed = false;
        constructor() {
          watchers.push(this);
        }
        destroy() {
          this.destroyed = true;
        }
      }
      (globalThis as unknown as { CloseWatcher?: unknown }).CloseWatcher = FakeWatcher;
    });
    afterEach(() => {
      delete (globalThis as unknown as { CloseWatcher?: unknown }).CloseWatcher;
    });
    const back = () =>
      act(() =>
        watchers
          .filter((w) => !w.destroyed)
          .at(-1)
          ?.onclose?.(),
      );

    it('뒤로 가기 → 시트만 닫힌다', async () => {
      render(<Screen />);
      await screen.findByLabelText('이름');
      back();
      expect(await screen.findByText('닫힘')).toBeInTheDocument();
    });

    it('입력이 있으면 뒤로 가기 → 확인 창, 다시 뒤로 가기 → 확인 창만 닫히고 입력 그대로', async () => {
      const user = userEvent.setup();
      render(<Screen />);
      await user.type(await screen.findByLabelText('이름'), '센소지');
      back();
      expect(await screen.findByText('입력한 내용을 버릴까요?')).toBeInTheDocument();
      back(); // 맨 위 감시자 = 확인 창
      await waitFor(() => expect(screen.queryByText('입력한 내용을 버릴까요?')).toBeNull());
      expect(screen.getByLabelText('이름')).toHaveValue('센소지');
      // 감시자는 한 번 쓰면 없어지므로 시트가 새로 만들어 둔다 → 다음 뒤로 가기도 받는다
      back();
      expect(await screen.findByText('입력한 내용을 버릴까요?')).toBeInTheDocument();
    });
  });
});

describe('isSubmitEnter (docs/31 R4)', () => {
  const ev = (key: string, isComposing: boolean, keyCode = 13) =>
    ({ key, keyCode, nativeEvent: { isComposing } }) as unknown as Parameters<
      typeof isSubmitEnter
    >[0];
  it('한글 조합 중 Enter는 저장이 아니다', () => {
    expect(isSubmitEnter(ev('Enter', true))).toBe(false);
    expect(isSubmitEnter(ev('Enter', false, 229))).toBe(false);
  });
  it('조합이 끝난 Enter만 저장', () => {
    expect(isSubmitEnter(ev('Enter', false))).toBe(true);
    expect(isSubmitEnter(ev('a', false))).toBe(false);
  });
});
