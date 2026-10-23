import i18n from '../../i18n';

/**
 * 파일 저장: 휴대폰은 공유 시트(카톡·드라이브·파일 앱), 안 되면 다운로드.
 * 사용자가 공유를 취소하면 false
 */
export async function saveFile(
  name: string,
  data: string | Blob,
  title: string,
  type = 'application/json',
): Promise<boolean> {
  const file = new File([data], name, { type });
  if (navigator.canShare?.({ files: [file] })) {
    try {
      await navigator.share({ files: [file], title });
      return true;
    } catch (e) {
      if ((e as { name?: string }).name === 'AbortError') return false;
      // 공유 실패 → 다운로드로
    }
  }
  const url = URL.createObjectURL(file);
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
  return true;
}

export function formatBytes(n: number): string {
  if (n < 1024 * 1024) return `${Math.max(1, Math.round(n / 1024))}KB`;
  return `${(n / 1024 / 1024).toFixed(1)}MB`;
}

/** "오늘", "3일 전" */
export function formatSince(iso: string, now = Date.now()): string {
  const days = Math.floor((now - Date.parse(iso)) / 86_400_000);
  return days <= 0 ? i18n.t('backup.today') : i18n.t('backup.daysAgo', { n: days });
}
