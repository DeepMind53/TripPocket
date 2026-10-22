import i18n from '../../i18n';
import { toast } from '../ui/toastStore';

/** 클립보드 복사 + 결과 알림. 막힌 환경(일부 인앱 브라우저)에서는 직접 복사 안내 */
export async function copyText(
  text: string,
  doneMessage = i18n.t('common.copied'),
): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    toast(doneMessage);
    return true;
  } catch {
    toast(i18n.t('common.copyFailed'));
    return false;
  }
}
