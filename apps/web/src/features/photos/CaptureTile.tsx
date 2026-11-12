import { Camera, Image as ImageIcon } from 'lucide-react';
import { useRef } from 'react';
import { useTranslation } from '../../i18n';

/**
 * 빠른 메뉴 [사진]·[영수증] 칸 (사용자 요청 2026-11-11, 모양 2026-11-13): 한 칸에 첫 줄 이름,
 * 둘째 줄 [찍기]·[고르기] 버튼 둘. 찍기 = 카메라, 고르기 = 휴대폰 사진(여러 장 한 번에)
 */
export function CaptureTile({
  kind,
  onFiles,
  label,
  multiple = true,
}: {
  kind: 'photo' | 'receipt';
  onFiles: (files: File[]) => void;
  /** 칸 이름 (없으면 사진·영수증) — 사진으로 번역 등 다른 곳에서도 같은 칸 */
  label?: string;
  /** 고르기에서 여러 장 */
  multiple?: boolean;
}) {
  const { t } = useTranslation();
  const shoot = useRef<HTMLInputElement | null>(null);
  const pick = useRef<HTMLInputElement | null>(null);
  const name = label ?? t(`quickMenu.${kind}`);
  const half = (mode: 'shoot' | 'pick') => {
    const Icon = mode === 'shoot' ? Camera : ImageIcon;
    const ref = mode === 'shoot' ? shoot : pick;
    return (
      <button
        type="button"
        onClick={() => ref.current?.click()}
        aria-label={t(mode === 'shoot' ? 'quickMenu.shootOf' : 'quickMenu.pickOf', { name })}
        className="flex min-h-11 min-w-0 flex-1 items-center justify-center gap-1 rounded-btn bg-surface px-1 text-caption font-medium"
      >
        <Icon aria-hidden="true" className="size-4 shrink-0 text-primary" />
        <span className="truncate">
          {t(mode === 'shoot' ? 'quickMenu.shoot' : 'quickMenu.pick')}
        </span>
        <input
          ref={ref}
          type="file"
          accept="image/*"
          // 찍기만 바로 뒤 카메라, 고르기는 사진 앱(여러 장)
          {...(mode === 'shoot' ? { capture: 'environment' } : { multiple })}
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
    <div className="flex min-w-0 flex-col gap-1.5 rounded-card bg-bg-subtle p-2">
      <span className="truncate px-1 text-body-2 font-semibold">{name}</span>
      <div className="flex gap-1.5">
        {half('shoot')}
        {half('pick')}
      </div>
    </div>
  );
}
