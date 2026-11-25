import { fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { TranslatedPhoto } from './TranslatedPhoto';

it('사진 위에 번역 덮기: 원래 자리에, 누르면 원문과 함께, [원문 보기]로 끄기 (2026-11-25)', async () => {
  const user = userEvent.setup();
  const { container } = render(
    <TranslatedPhoto
      url="blob:x"
      lines={[
        { text: 'ラーメン ¥980', ko: '라멘 980엔', box: { cx: 500, cy: 100, w: 400, h: 40, a: 0 } },
        // 번역이 원문과 같거나 없으면 덮지 않는다
        { text: '¥210', ko: '¥210', box: { cx: 500, cy: 200, w: 100, h: 40, a: 0 } },
        { text: '替玉', ko: null, box: { cx: 500, cy: 300, w: 100, h: 40, a: 0 } },
      ]}
    />,
  );
  const img = container.querySelector('img')!;
  Object.defineProperty(img, 'naturalWidth', { value: 1000 });
  Object.defineProperty(img, 'naturalHeight', { value: 1000 });
  fireEvent.load(img);
  const label = screen.getByRole('button', { name: 'ラーメン ¥980 — 라멘 980엔' });
  expect(label).toHaveStyle({ left: '50%', top: '10%' });
  expect(screen.queryByRole('button', { name: /¥210 —/ })).not.toBeInTheDocument();
  await user.click(label);
  expect(screen.getByRole('status')).toHaveTextContent('라멘 980엔ラーメン ¥980');
  await user.click(screen.getByRole('button', { name: '원문 보기' }));
  expect(screen.queryByRole('button', { name: /라멘 980엔/ })).not.toBeInTheDocument();
  expect(screen.getByRole('button', { name: '번역 보기' })).toBeInTheDocument();
});
