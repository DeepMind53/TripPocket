import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { CancelSaveRow } from './CancelSaveRow';

/** 저장 버튼 왼쪽 빨간 [취소] (사용자 요청 2026-11-02) */
it('취소를 누르면 저장하지 않고 닫는다', async () => {
  const cancel = vi.fn();
  const save = vi.fn();
  const user = userEvent.setup();
  render(
    <CancelSaveRow onCancel={cancel}>
      <button type="button" onClick={save}>
        저장
      </button>
    </CancelSaveRow>,
  );
  await user.click(screen.getByRole('button', { name: '취소' }));
  expect(cancel).toHaveBeenCalledTimes(1);
  expect(save).not.toHaveBeenCalled();
  expect(screen.getByRole('button', { name: '취소' })).toHaveClass('w-1/5', 'bg-danger');
});
