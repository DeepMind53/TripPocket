import type { LocalDate } from '@trippocket/shared';
import { ScanText } from 'lucide-react';
import { useRef, useState } from 'react';
import {
  guessBookingKind,
  parseBoardingPass,
  scanBooking,
  type BookingScan,
} from '../../domain/bookingScan';
import { useTranslation } from '../../i18n';
import { shrinkImage } from '../../shared/lib/shrinkImage';
import { Button, toast } from '../../shared/ui';

/** 브라우저 바코드 읽기 (Android Chrome 등 — 없는 브라우저는 글자 인식으로) */
type Detector = { detect: (img: ImageBitmapSource) => Promise<{ rawValue: string }[]> };
type DetectorCtor = new (o: { formats: string[] }) => Detector;

/** 탑승권 바코드(PDF417·Aztec·QR)를 기기 안에서 읽는다 — 사진을 보내지 않는다 */
async function readBoardingPass(file: Blob, ref: LocalDate): Promise<BookingScan | undefined> {
  const Ctor = (globalThis as { BarcodeDetector?: DetectorCtor }).BarcodeDetector;
  if (!Ctor || typeof createImageBitmap !== 'function') return undefined;
  try {
    const img = await createImageBitmap(file);
    const codes = await new Ctor({
      formats: ['pdf417', 'aztec', 'qr_code', 'data_matrix'],
    }).detect(img);
    img.close();
    for (const c of codes) {
      const r = parseBoardingPass(c.rawValue, ref);
      if (r) return r;
    }
  } catch {
    // 지원하지 않는 형식·읽기 실패 — 글자 인식으로
  }
  return undefined;
}

/**
 * 사진으로 예약 정보 자동 채우기 (사용자 요청 2026-11-24, 같은 날 실험실 → 정식, ADR-0012 추가):
 * 1) 탑승권 바코드가 있으면 기기 안에서 읽고 끝 (사진을 보내지 않음) — 항공
 * 2) 없으면 고른 한 장만 글자 인식(홈 서버 → Google Vision → Azure, 안 되면 기기 안)으로 보내고,
 *    사진은 저장하지 않는다. 읽은 글로 예약 종류를 알아내고(모르면 지금 종류) 기기에서 칸으로 나눈다
 */
export function BookingScanButton({
  kind,
  refDate,
  currency,
  onScan,
}: {
  /** 지금 고른 종류 — 사진에서 종류를 알 수 없을 때 */
  kind: string;
  /** 연도 없는 날짜의 기준 (여행 시작일) */
  refDate: LocalDate;
  currency: string | undefined;
  onScan: (scan: BookingScan, kind: string, from: 'barcode' | 'text') => void;
}) {
  const { t } = useTranslation();
  const input = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  return (
    <>
      <Button
        variant="secondary"
        fullWidth
        loading={busy}
        leading={<ScanText aria-hidden="true" className="size-4" />}
        onClick={() => input.current?.click()}
      >
        {t('tool.scanButton')}
      </Button>
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
              const pass = await readBoardingPass(file, refDate);
              if (pass) {
                onScan(pass, 'flight', 'barcode');
                return;
              }
              const [{ readReceipt }, img] = await Promise.all([
                import('../../data/services/receiptOcr'),
                shrinkImage(file),
              ]);
              const r = await readReceipt(img, currency);
              const k = guessBookingKind(r.text) ?? kind;
              onScan(scanBooking(r.text, { kind: k, ref: refDate }), k, 'text');
            } catch {
              toast(t('tool.scanFailed'));
            } finally {
              setBusy(false);
            }
          })();
        }}
      />
    </>
  );
}
