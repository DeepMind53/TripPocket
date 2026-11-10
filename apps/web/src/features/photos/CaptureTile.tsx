import { Camera, ReceiptText } from 'lucide-react';
import { useRef } from 'react';
import { useTranslation } from '../../i18n';

/** 빠른 메뉴 칸 하나 — 누르면 숨은 파일 칸으로 카메라를 연다 */
export function CaptureTile({
  kind,
  onFile,
}: {
  kind: 'photo' | 'receipt';
  onFile: (f: File) => void;
}) {
  const { t } = useTranslation();
  const input = useRef<HTMLInputElement | null>(null);
  const Icon = kind === 'photo' ? Camera : ReceiptText;
  return (
    <button
      type="button"
      onClick={() => input.current?.click()}
      className="flex min-h-20 flex-col justify-center gap-0.5 rounded-card bg-bg-subtle px-3 py-2.5 text-left"
    >
      <span className="flex items-center gap-1.5">
        <Icon aria-hidden="true" className="size-5 shrink-0 text-primary" />
        <span className="text-body-2 font-semibold">{t(`quickMenu.${kind}`)}</span>
      </span>
      <span className="text-micro text-fg-muted">{t(`quickMenu.${kind}Desc`)}</span>
      {/* 휴대폰은 바로 뒤 카메라가 열린다 (사진 앱에서 고를 수도 있음) */}
      <input
        ref={input}
        type="file"
        accept="image/*"
        capture="environment"
        hidden
        aria-hidden="true"
        tabIndex={-1}
        onChange={(e) => {
          const f = e.target.files?.[0];
          e.target.value = '';
          if (f) onFile(f);
        }}
      />
    </button>
  );
}
