import i18n from '../../i18n';

/**
 * PC 크롬·엣지의 파일 저장·열기 창 (File System Access API). 같은 id를 쓰면 지난번 폴더에서 열린다 —
 * 백업을 저장한 폴더에서 복원 창이 바로 열리게 (2026-11-12 사용자 요청). 휴대폰(손가락 화면)은 쓰지 않는다:
 * 안드로이드 크롬에는 없고, 공유 시트(드라이브·카톡)가 더 맞다
 */
interface PickerType {
  description: string;
  accept: Record<string, string[]>;
}
interface PickerWindow {
  showSaveFilePicker?: (o: {
    id: string;
    startIn: 'downloads';
    suggestedName: string;
    types: PickerType[];
  }) => Promise<FileSystemFileHandle>;
  showOpenFilePicker?: (o: {
    id: string;
    startIn: 'downloads';
    types: PickerType[];
  }) => Promise<FileSystemFileHandle[]>;
}
const BACKUP_PICKER = 'tp-backup';
const JSON_TYPE = (description: string): PickerType[] => [
  { description, accept: { 'application/json': ['.json'] } },
];
const pickerWindow = () => window as unknown as PickerWindow;
/** 마우스로 쓰는 PC이고 파일 창 API가 있을 때만 */
export const hasFolderPicker = () =>
  typeof window !== 'undefined' &&
  !!pickerWindow().showOpenFilePicker &&
  !!window.matchMedia?.('(pointer: fine)').matches;

const aborted = (e: unknown) => (e as { name?: string }).name === 'AbortError';

/**
 * 백업 파일 열기 (PC: 저장했던 폴더에서). 창을 닫으면 null, PC 창이 없으면 undefined (부르는 쪽이 파일 입력으로)
 */
export async function openBackupFile(description: string): Promise<File | null | undefined> {
  const open = hasFolderPicker() ? pickerWindow().showOpenFilePicker : undefined;
  if (!open) return undefined;
  try {
    const [h] = await open({
      id: BACKUP_PICKER,
      startIn: 'downloads',
      types: JSON_TYPE(description),
    });
    return h ? await h.getFile() : null;
  } catch (e) {
    return aborted(e) ? null : undefined;
  }
}

/**
 * 파일 저장: PC 크롬·엣지는 저장 창(폴더 기억), 휴대폰은 공유 시트(카톡·드라이브·파일 앱), 안 되면 다운로드.
 * 사용자가 창·공유를 취소하면 false
 */
export async function saveFile(
  name: string,
  data: string | Blob,
  title: string,
  type = 'application/json',
): Promise<boolean> {
  const save = hasFolderPicker() ? pickerWindow().showSaveFilePicker : undefined;
  if (save && type === 'application/json') {
    try {
      const h = await save({
        id: BACKUP_PICKER,
        startIn: 'downloads',
        suggestedName: name,
        types: JSON_TYPE(title),
      });
      const w = await h.createWritable();
      await w.write(data);
      await w.close();
      return true;
    } catch (e) {
      if (aborted(e)) return false;
      // 저장 창 실패 → 아래 공유·다운로드로
    }
  }
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
