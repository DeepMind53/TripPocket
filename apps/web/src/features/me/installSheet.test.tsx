import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useInstall } from '../../app/pwa';
import { InstallSheet } from './InstallSheet';

describe('처음 로그인 뒤 홈 화면 추가 안내', () => {
  it('설치 창을 쓸 수 있으면 [확인]이 설치를 시작한다', async () => {
    const prompt = vi.fn(() => Promise.resolve());
    useInstall.setState({
      installed: false,
      prompt: Object.assign(new Event('beforeinstallprompt'), {
        prompt,
        userChoice: Promise.resolve({ outcome: 'accepted' as const }),
      }),
    });
    const onOpenChange = vi.fn();
    render(<InstallSheet open first onOpenChange={onOpenChange} />);
    expect(await screen.findByRole('button', { name: '나중에' })).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: '확인' }));
    expect(prompt).toHaveBeenCalled();
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  it('설치 창이 없으면 방법만 알려 주고 [확인]으로 닫는다', async () => {
    useInstall.setState({ installed: false, prompt: null });
    const onOpenChange = vi.fn();
    render(<InstallSheet open first onOpenChange={onOpenChange} />);
    await userEvent.click(await screen.findByRole('button', { name: '확인' }));
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });
});
