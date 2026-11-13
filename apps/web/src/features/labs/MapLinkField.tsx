import { Link2 } from 'lucide-react';
import { useState } from 'react';
import { useLab } from '../../data/labsStore';
import { parseMapLink } from '../../domain/labTools';
import { useTranslation } from '../../i18n';

/**
 * 지도 링크로 장소 (실험실 mapLink, 2026-11-13): 구글·네이버·애플 지도에서 복사한 링크를 붙여 넣으면
 * 그 좌표(와 이름)를 일정 장소로. 링크에서 글자만 읽고 인터넷 요청은 하지 않는다
 */
export function MapLinkField({
  onFound,
}: {
  onFound: (p: { lat: number; lng: number; name?: string }) => void;
}) {
  const { t } = useTranslation();
  const on = useLab('mapLink');
  const [text, setText] = useState('');
  if (!on) return null;
  const found = text.trim() ? parseMapLink(text) : null;
  return (
    <div className="flex flex-col gap-1">
      <label className="flex flex-col gap-1.5">
        <span className="flex items-center gap-1 text-caption font-semibold text-fg-sub">
          <Link2 aria-hidden="true" className="size-3.5" />
          {t('tool.mapLink')}
        </span>
        <input
          value={text}
          inputMode="url"
          maxLength={2000}
          placeholder={t('tool.mapLinkPlaceholder')}
          onChange={(e) => {
            setText(e.target.value);
            const p = parseMapLink(e.target.value);
            if (p) onFound(p);
          }}
          className="h-12 w-full rounded-btn border border-line bg-bg-subtle px-3 text-body-1 outline-none focus:border-primary"
        />
      </label>
      {text.trim() && (
        <p
          aria-live="polite"
          className={
            found ? 'text-caption text-primary' : 'text-caption whitespace-pre-line text-fg-muted'
          }
        >
          {found
            ? t('tool.mapLinkFound', { lat: found.lat.toFixed(4), lng: found.lng.toFixed(4) })
            : t('tool.mapLinkNone')}
        </p>
      )}
    </div>
  );
}
