import type { SavedPlace } from '@trippocket/shared';
import { Heart } from 'lucide-react';
import { useState } from 'react';
import { useSavedPlaces } from '../../data/hooks';
import { useTranslation } from '../../i18n';

/**
 * 일정 추가에서 "저장한 장소에서 고르기" (사용자 요청 2026-10-26): 그 여행 나라에 저장한 곳만.
 * 고르면 이름·종류·주소·좌표를 채운다 (저장 목록은 그대로 — 일정과 따로 관리)
 */
export function SavedPick({
  countries,
  onPick,
}: {
  /** 여행 목적지 나라 코드 */
  countries: readonly string[];
  onPick: (place: SavedPlace) => void;
}) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const list = (useSavedPlaces() ?? []).filter(
    (p) => p.countryCode && countries.includes(p.countryCode),
  );
  if (countries.length === 0) return null;
  return (
    <div className="flex flex-col gap-2">
      <button
        type="button"
        aria-expanded={open}
        onClick={() => setOpen(!open)}
        className="flex h-10 items-center gap-1.5 self-start rounded-full border border-line px-3 text-caption font-semibold text-fg-sub"
      >
        <Heart aria-hidden="true" className="size-4 text-danger" />
        {t('saved.pick')} · {list.length}
      </button>
      {open &&
        (list.length === 0 ? (
          <p className="text-caption text-fg-muted">{t('saved.pickEmpty')}</p>
        ) : (
          <ul className="flex max-h-48 flex-col divide-y divide-line overflow-y-auto rounded-card border border-line">
            {list.map((p) => (
              <li key={p.id}>
                <button
                  type="button"
                  onClick={() => {
                    onPick(p);
                    setOpen(false);
                  }}
                  className="flex min-h-11 w-full flex-col justify-center px-3 py-1.5 text-left"
                >
                  <span className="truncate text-body-2 font-medium">{p.name}</span>
                  {p.address && (
                    <span className="truncate text-caption text-fg-muted">{p.address}</span>
                  )}
                </button>
              </li>
            ))}
          </ul>
        ))}
    </div>
  );
}
