import { parseBackup, type ParsedBackup } from '@trippocket/shared';
import { Download, ShieldCheck, ShieldAlert, Upload } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import {
  backupFileName,
  createBackup,
  lastBackupAt,
  markBackedUp,
  restoreBackup,
  type RestoreMode,
} from '../../data/services/backupService';
import { useTranslation } from '../../i18n';
import { useRouteSheet } from '../../shared/hooks/useRouteSheet';
import { BottomSheet, Button, RadioList, TopBar, toast } from '../../shared/ui';
import { formatBytes, formatSince, saveFile } from './backupUtils';

type Ok = Extract<ParsedBackup, { ok: true }>;

/** S-22 백업 · 복원 (docs/06 §3) + 저장공간 보호 */
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

  useEffect(() => {
    void lastBackupAt().then(setLast);
    void navigator.storage?.estimate?.().then((e) => setUsage(e.usage ?? null));
    void navigator.storage?.persisted?.().then(setPersisted);
  }, []);

  async function backup() {
    setBusy(true);
    try {
      const file = await createBackup();
      const saved = await saveFile(
        backupFileName(file),
        JSON.stringify(file),
        t('backup.shareTitle'),
      );
      if (saved) {
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
    const result = parseBackup(await file.text());
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
            onClick={() => fileInput.current?.click()}
          >
            <Upload aria-hidden="true" className="size-5" />
            {t('backup.restore')}
          </Button>
          <input
            ref={fileInput}
            type="file"
            accept="application/json,.json"
            aria-label={t('backup.restore')}
            className="hidden"
            onChange={(e) => {
              void pick(e.target.files?.[0]);
              e.target.value = '';
            }}
          />
        </section>

        <section className="flex flex-col gap-3 rounded-2xl border border-line bg-surface p-4">
          <h2 className="text-body-1 font-bold">{t('backup.storage')}</h2>
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
