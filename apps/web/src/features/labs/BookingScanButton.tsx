import { ScanText } from 'lucide-react';
import { useRef, useState } from 'react';
import { useLab } from '../../data/labsStore';
import { useTranslation } from '../../i18n';
import { shrinkImage } from '../../shared/lib/shrinkImage';
import { Button, toast } from '../../shared/ui';

/**
 * 예약 확인 캡처로 채우기 (실험실 bookingScan, 사용자 요청 2026-11-24, ADR-0012 추가):
 * 누를 때 고른 한 장만 글자 인식(홈 서버 → Google Vision → Azure, 안 되면 기기 안)으로 보내고,
 * 사진은 저장하지 않는다. 읽은 글은 기기에서 칸으로 나눈다 (domain/bookingScan)
 */
export function BookingScanButton({
  currency,
  onText,
}: {
  currency: string | undefined;
  onText: (text: string) => void;
}) {
  const { t } = useTranslation();
  const on = useLab('bookingScan');
  const input = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  if (!on) return null;
  return (
    <div className="flex flex-col gap-1">
      <Button
        variant="secondary"
        fullWidth
        loading={busy}
        leading={<ScanText aria-hidden="true" className="size-4" />}
        onClick={() => input.current?.click()}
      >
        {t('tool.scanButton')}
      </Button>
      <p className="text-micro whitespace-pre-line text-fg-muted">{t('tool.scanHint')}</p>
      <input
        ref={input}
        type="file"
        accept="image/*"
        hidden
        aria-label={t('tool.scanButton')}
        onChange={(e) => {
          const file = e.target.files?.[0];
          e.target.value = '';
          if (!file) return;
          setBusy(true);
          void (async () => {
            try {
              const [{ readReceipt }, img] = await Promise.all([
                import('../../data/services/receiptOcr'),
                shrinkImage(file),
              ]);
              const r = await readReceipt(img, currency);
              onText(r.text);
            } catch {
              toast(t('tool.scanFailed'));
            } finally {
              setBusy(false);
            }
          })();
        }}
      />
    </div>
  );
}
