import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { BottomSheet } from './BottomSheet';

/** 2026-11-11: 예약 입력 시트 안 [최저가 비교] 시트에서 검색을 누르면 예약이 저장되던 문제 */
it('시트 안 양식을 제출해도 시트를 연 바깥 양식은 제출되지 않는다', async () => {
  const outer = vi.fn((e: { preventDefault: () => void }) => e.preventDefault());
  const inner = vi.fn((e: { preventDefault: () => void }) => e.preventDefault());
  render(
    <form onSubmit={outer}>
      <BottomSheet open onOpenChange={() => {}} title="최저가">
        <form onSubmit={inner}>
          <button type="submit">검색</button>
        </form>
      </BottomSheet>
    </form>,
  );
  const user = userEvent.setup();
  await user.click(await screen.findByRole('button', { name: '검색' }));
  await waitFor(() => expect(inner).toHaveBeenCalledTimes(1));
  expect(outer).not.toHaveBeenCalled();
});
