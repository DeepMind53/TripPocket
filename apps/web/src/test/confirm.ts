import { screen, within } from '@testing-library/react';
import type { UserEvent } from '@testing-library/user-event';

/** 삭제 확인 창(confirmDelete)에서 [삭제]를 누른다 */
export async function acceptDelete(user: UserEvent): Promise<void> {
  const dialog = await screen.findByRole('dialog', { name: '삭제할까요?' });
  await user.click(within(dialog).getByRole('button', { name: '삭제' }));
}
