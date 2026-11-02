import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { CautionIcons } from './CautionIcons';

/** 날씨 주의 그림을 누르면 이유·할 일 팝업, 바깥 일정은 열리지 않는다 (사용자 요청 2026-11-02) */
it('누르면 주의 이유와 할 일을 보여 주고, 감싼 일정 버튼은 눌리지 않는다', async () => {
  const onItem = vi.fn();
  const user = userEvent.setup();
  render(
    <button type="button" onClick={onItem}>
      일정
      <CautionIcons cautions={['rain', 'cold']} />
    </button>,
  );
  await user.click(screen.getByRole('img', { name: /날씨 주의/ }));
  const sheet = await screen.findByRole('dialog', { name: '날씨 주의' });
  expect(sheet).toHaveTextContent('비 예보가 있어요');
  expect(sheet).toHaveTextContent('겉옷을 챙기세요');
  expect(onItem).not.toHaveBeenCalled();
});
