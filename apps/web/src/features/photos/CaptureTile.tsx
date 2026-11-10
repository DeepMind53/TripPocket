import { Camera, Image as ImageIcon } from 'lucide-react';
import { useRef } from 'react';
import { useTranslation } from '../../i18n';

/**
 * 빠른 메뉴 [사진]·[영수증] 칸 하나를 둘로 (사용자 요청 2026-11-11): 왼쪽 = 카메라로 찍기, 오른쪽 = 휴대폰 사진에서 고르기.
 * 고르기는 여러 장을 한 번에 고를 수 있다
 */
export function CaptureTile({
  kind,
  onFiles,
}: {
  kind: 'photo' | 'receipt';
  onFiles: (files: File[]) => void;
}) {
  const { t } = useTranslation();
  const shoot = useRef<HTMLInputElement | null>(null);
  const pick = useRef<HTMLInputElement | null>(null);
  const name = t(`quickMenu.${kind}`);
  const half = (mode: 'shoot' | 'pick') => {
    const Icon = mode === 'shoot' ? Camera : ImageIcon;
    const ref = mode === 'shoot' ? shoot : pick;
    return (
      <button
        type="button"
        onClick={() => ref.current?.click()}
        aria-label={t(mode === 'shoot' ? 'quickMenu.shootOf' : 'quickMenu.pickOf', { name })}
        className="flex min-h-20 min-w-0 flex-1 flex-col items-center justify-center gap-1 rounded-card bg-bg-subtle px-1 py-2.5"
      >
        <Icon aria-hidden="true" className="size-5 shrink-0 text-primary" />
        <span className="text-body-2 font-semibold">{name}</span>
        <span className="text-micro text-fg-muted">
          {t(mode === 'shoot' ? 'quickMenu.shoot' : 'quickMenu.pick')}
        </span>
        <input
          ref={ref}
          type="file"
          accept="image/*"
          // 찍기만 바로 뒤 카메라, 고르기는 사진 앱(여러 장)
          {...(mode === 'shoot' ? { capture: 'environment' } : { multiple: true })}
          hidden
          aria-hidden="true"
          tabIndex={-1}
          onChange={(e) => {
            const files = [...(e.target.files ?? [])];
            e.target.value = '';
            if (files.length) onFiles(files);
          }}
        />
      </button>
    );
  };
  return (
    <div className="flex gap-1.5">
      {half('shoot')}
      {half('pick')}
    </div>
  );
}
