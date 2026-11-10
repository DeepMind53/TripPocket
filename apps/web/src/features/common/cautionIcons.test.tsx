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

/** 두 개까지 그림, 더 있으면 옆에 +N — 팝업에는 모두 (사용자 요청 2026-11-10) */
it('세 개 이상이면 그림 두 개 + "+N", 누르면 모두 보여 준다', async () => {
  const user = userEvent.setup();
  const { container } = render(<CautionIcons cautions={['rain', 'storm', 'cold']} />);
  const mark = screen.getByRole('img', { name: /날씨 주의/ });
  expect(mark.querySelectorAll('svg')).toHaveLength(2);
  expect(mark).toHaveTextContent('+1');
  await user.click(mark);
  const sheet = await screen.findByRole('dialog', { name: '날씨 주의' });
  expect(sheet.querySelectorAll('li')).toHaveLength(3);
  expect(container).toBeTruthy();
});
