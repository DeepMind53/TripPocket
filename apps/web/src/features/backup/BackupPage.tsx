import { parseBackup, type ParsedBackup } from '@trippocket/shared';
import { Download, History, ShieldCheck, ShieldAlert, Upload } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import {
  backupFileName,
  createBackup,
  lastBackupAt,
  markBackedUp,
  restoreBackup,
  type RestoreMode,
} from '../../data/services/backupService';
import {
  listLocalBackups,
  localBackupName,
  readLocalBackup,
  saveLocalBackup,
  type LocalBackup,
} from '../../data/services/localBackups';
import { useTranslation } from '../../i18n';
import { useRouteSheet } from '../../shared/hooks/useRouteSheet';
import { BottomSheet, Button, RadioList, TopBar, toast } from '../../shared/ui';
import { formatBytes, formatSince, hasFolderPicker, openBackupFile, saveFile } from './backupUtils';
import { ServerStorage } from './ServerStorage';

type Ok = Extract<ParsedBackup, { ok: true }>;

/** S-22 백업 · 복원 · 용량 (docs/06 §3) + 서버 저장 용량(2026-11-04) + 저장공간 보호 */
export function BackupPage() {
  const { t } = useTranslation();
  const [last, setLast] = useState<string | null>(null);
  const [usage, setUsage] = useState<number | null>(null);
  const [persisted, setPersisted] = useState<boolean | null>(null);
  const [busy, setBusy] = useState(false);
  const [parsed, setParsed] = useState<Ok | null>(null);
  const [mode, setMode] = useState<RestoreMode>('merge');
  const [sheetOpen, setSheetOpen] = useRouteSheet('restore');
  const fileInput = useRef<HTMLInputElement>(null);
  const [recent, setRecent] = useState<LocalBackup[]>([]);

  useEffect(() => {
    void lastBackupAt().then(setLast);
    void listLocalBackups().then(setRecent);
    void navigator.storage?.estimate?.().then((e) => setUsage(e.usage ?? null));
    void navigator.storage?.persisted?.().then(setPersisted);
  }, []);

  async function backup() {
    setBusy(true);
    try {
      const file = await createBackup();
      const json = JSON.stringify(file);
      const saved = await saveFile(backupFileName(file), json, t('backup.shareTitle'));
      if (saved) {
        // 이 기기에도 한 벌 (최근 3개) — 복원할 때 파일을 찾지 않아도 되게
        await saveLocalBackup(localBackupName(file.exportedAt), json);
        setRecent(await listLocalBackups());
        await markBackedUp();
        setLast(await lastBackupAt());
        toast(t('backup.done'));
      }
    } finally {
      setBusy(false);
    }
  }

  async function pick(file: File | undefined) {
    if (!file) return;
    await preview(await file.text());
  }

  /** PC는 저장했던 폴더에서 열리는 창, 휴대폰은 파일 고르기 */
  async function chooseFile() {
    // 휴대폰은 누른 그 자리에서 바로 열어야 한다 (기다리면 브라우저가 파일 창을 막음)
    if (!hasFolderPicker()) return fileInput.current?.click();
    const f = await openBackupFile(t('backup.shareTitle'));
    if (f === undefined) fileInput.current?.click();
    else if (f) await pick(f);
  }

  async function preview(text: string | null) {
    if (text === null) return toast(t('backup.error.notJson'));
    const result = parseBackup(text);
    if (!result.ok) {
      toast(t(`backup.error.${result.reason}`));
      return;
    }
    setParsed(result);
    setMode('merge');
    setSheetOpen(true);
  }

  async function restore() {
    if (!parsed) return;
    setBusy(true);
    try {
      await restoreBackup(parsed, mode);
      setSheetOpen(false);
      toast(t('backup.restored'));
    } catch {
      toast(t('backup.error.failed'));
    } finally {
      setBusy(false);
    }
  }

  async function protect() {
    const ok = (await navigator.storage?.persist?.()) ?? false;
    setPersisted(ok);
    toast(ok ? t('backup.protected') : t('backup.protectDenied'));
  }

  return (
    <div className="mx-auto min-h-dvh max-w-[560px] pb-10">
      <TopBar title={t('backup.title')} backTo="/me" />
      <div className="flex flex-col gap-6 px-5 pt-2">
        <section className="flex flex-col gap-3 rounded-2xl border border-line bg-surface p-4">
          <p className="text-body-2 text-fg-sub">{t('backup.why')}</p>
          <p className="text-caption text-fg-muted" aria-live="polite">
            {t('backup.last')}: {last ? formatSince(last) : t('backup.never')}
          </p>
          <Button size="lg" fullWidth loading={busy} onClick={() => void backup()}>
            <Download aria-hidden="true" className="size-5" />
            {t('backup.create')}
          </Button>
          <Button
            size="lg"
            variant="secondary"
            fullWidth
            disabled={busy}
            onClick={() => void chooseFile()}
          >
            <Upload aria-hidden="true" className="size-5" />
            {t('backup.restore')}
          </Button>
          <input
            ref={fileInput}
            type="file"
            // 안드로이드는 공유·다운로드로 저장한 백업을 text/plain·octet-stream으로 적어 JSON만 고르면 흐리게 보인다
            accept=".json,application/json,text/plain,application/octet-stream"
            aria-label={t('backup.restore')}
            className="hidden"
            onChange={(e) => {
              void pick(e.target.files?.[0]);
              e.target.value = '';
            }}
          />
          {last && (
            // 휴대폰 파일 창에서 찾기 쉽게 마지막 파일 이름 (보통 다운로드 폴더)
            <p className="text-caption break-all text-fg-muted">
              {t('backup.lastFile', { name: `trippocket-backup-${last.slice(0, 10)}.json` })}
            </p>
          )}
        </section>

        {recent.length > 0 && (
          <section
            aria-label={t('backup.recentTitle')}
            className="flex flex-col gap-2 rounded-2xl border border-line bg-surface p-4"
          >
            <h2 className="flex items-center gap-1.5 text-body-1 font-semibold">
              <History aria-hidden="true" className="size-5 text-fg-sub" />
              {t('backup.recentTitle')}
            </h2>
            <p className="text-caption whitespace-pre-line text-fg-muted">
              {t('backup.recentNote')}
            </p>
            <ul className="flex flex-col divide-y divide-line">
              {recent.map((b) => (
                <li key={b.name}>
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => void readLocalBackup(b.name).then(preview)}
                    className="flex min-h-12 w-full items-center justify-between gap-3 py-2 text-left"
                  >
                    <span className="tabular text-body-2">
                      {new Date(b.savedAt).toLocaleString('ko-KR', {
                        month: 'numeric',
                        day: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                      <span className="ml-2 text-caption text-fg-muted">{formatBytes(b.size)}</span>
                    </span>
                    <span className="text-body-2 font-semibold text-primary">
                      {t('backup.recentRestore')}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          </section>
        )}

        <ServerStorage />

        <section className="flex flex-col gap-3 rounded-2xl border border-line bg-surface p-4">
          <h2 className="text-body-1 font-semibold">{t('backup.storage')}</h2>
          {usage !== null && (
            <p className="text-body-2 text-fg-sub">
              {t('backup.usage', { size: formatBytes(usage) })}
            </p>
          )}
          <div className="flex items-start gap-2">
            {persisted ? (
              <ShieldCheck aria-hidden="true" className="mt-0.5 size-5 shrink-0 text-success" />
            ) : (
              <ShieldAlert aria-hidden="true" className="mt-0.5 size-5 shrink-0 text-warning" />
            )}
            <p className="text-body-2">
              {persisted ? t('backup.isProtected') : t('backup.notProtected')}
            </p>
          </div>
          {persisted === false && (
            <Button variant="secondary" onClick={() => void protect()}>
              {t('backup.protect')}
            </Button>
          )}
        </section>
      </div>

      <BottomSheet
        open={sheetOpen}
        onOpenChange={setSheetOpen}
        title={t('backup.previewTitle')}
        footer={
          <Button
            size="lg"
            fullWidth
            loading={busy}
            variant={mode === 'replace' ? 'danger' : 'primary'}
            onClick={() => void restore()}
          >
            {mode === 'replace' ? t('backup.doReplace') : t('backup.doMerge')}
          </Button>
        }
      >
        {parsed && (
          <div className="flex flex-col gap-4">
            <p className="text-body-2 text-fg-sub">
              {t('backup.preview', {
                date: formatSince(parsed.exportedAt),
                trips: parsed.counts.trips,
                items: parsed.counts.items,
                bookings: parsed.counts.bookings,
              })}
            </p>
            <RadioList
              label={t('backup.mode')}
              value={mode}
              onChange={setMode}
              options={[
                { value: 'merge', label: t('backup.merge'), description: t('backup.mergeDesc') },
                {
                  value: 'replace',
                  label: t('backup.replace'),
                  description: t('backup.replaceDesc'),
                },
              ]}
            />
          </div>
        )}
      </BottomSheet>
    </div>
  );
}
