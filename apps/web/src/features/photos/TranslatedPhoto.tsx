import { Languages, ZoomIn, ZoomOut } from 'lucide-react';
import { useState } from 'react';
import { placeBox, type Box } from '../../domain/photoText';
import { useTranslation } from '../../i18n';
import { cn } from '../../shared/lib/cn';
import { Button } from '../../shared/ui';

export interface PhotoLine {
  text: string;
  ko?: string | null | undefined;
  box?: Box | undefined;
}

/**
 * 사진 위에 번역 덮기 (2026-11-25 사용자 요청 "글씨만 따로 보면 헷갈림"): 원래 글자 자리에 한국어를 덮는다.
 * 덮개를 누르면 아래에 원문·번역을 크게, [원문 보기]로 덮개 끄기, [크게]로 두 배 (안에서 밀어 보기).
 * 사진·번역은 저장하지 않는다 (영수증은 기기에만 — ADR-0012)
 */
export function TranslatedPhoto({ url, lines }: { url: string; lines: readonly PhotoLine[] }) {
  const { t } = useTranslation();
  const [size, setSize] = useState<{ w: number; h: number } | null>(null);
  const [original, setOriginal] = useState(false);
  const [zoom, setZoom] = useState(false);
  const [picked, setPicked] = useState<number | null>(null);
  const shown = lines
    .map((l, i) => ({ ...l, i }))
    .filter((l): l is PhotoLine & { i: number; box: Box } => !!l.box && !!l.ko && l.ko !== l.text);
  const pick = picked !== null ? lines[picked] : undefined;

  return (
    <div className="flex flex-col gap-2">
      <div className="max-h-[60dvh] overflow-auto rounded-card bg-bg-subtle">
        <div
          className={cn('relative', zoom ? 'w-[200%]' : 'w-full')}
          style={{ containerType: 'inline-size' }}
        >
          <img
            src={url}
            alt=""
            className="block h-auto w-full"
            onLoad={(e) =>
              setSize({ w: e.currentTarget.naturalWidth, h: e.currentTarget.naturalHeight })
            }
          />
          {size &&
            !original &&
            shown.map((l) => {
              const p = placeBox(l.box, size.w, size.h);
              return (
                <button
                  key={l.i}
                  type="button"
                  aria-label={t('photoTranslate.lineLabel', { text: l.text, ko: l.ko ?? '' })}
                  onClick={() => setPicked(l.i)}
                  className={cn(
                    'absolute flex items-center justify-center overflow-hidden bg-surface/95 px-0.5 leading-none whitespace-nowrap text-fg shadow-card',
                    picked === l.i && 'ring-2 ring-primary',
                  )}
                  style={{
                    left: `${p.left}%`,
                    top: `${p.top}%`,
                    // 글이 상자보다 길면 조금 넓게 (원래 자리에서 크게 벗어나지 않게 1.3배까지)
                    minWidth: `${p.width}%`,
                    maxWidth: `${p.width * 1.3}%`,
                    height: `${Math.max(p.height, 2)}%`,
                    fontSize: `max(11px, ${p.fontCqw}cqw)`,
                    transform: `translate(-50%, -50%) rotate(${p.deg}deg)`,
                  }}
                >
                  <span className="truncate">{l.ko}</span>
                </button>
              );
            })}
        </div>
      </div>
      <div className="flex gap-2">
        <Button
          size="sm"
          variant="secondary"
          aria-pressed={original}
          leading={<Languages aria-hidden="true" className="size-4" />}
          onClick={() => setOriginal(!original)}
        >
          {original ? t('photoTranslate.showKo') : t('photoTranslate.showOriginal')}
        </Button>
        <Button
          size="sm"
          variant="secondary"
          aria-pressed={zoom}
          leading={
            zoom ? (
              <ZoomOut aria-hidden="true" className="size-4" />
            ) : (
              <ZoomIn aria-hidden="true" className="size-4" />
            )
          }
          onClick={() => setZoom(!zoom)}
        >
          {zoom ? t('photoTranslate.zoomOut') : t('photoTranslate.zoomIn')}
        </Button>
      </div>
      {pick && (
        <div role="status" className="flex flex-col gap-0.5 rounded-card border border-line p-3">
          <span className="text-body-1 font-semibold">{pick.ko ?? pick.text}</span>
          <span className="text-caption text-fg-muted">{pick.text}</span>
        </div>
      )}
      {shown.length > 0 && !pick && (
        <p className="text-caption text-fg-muted">{t('photoTranslate.tapHint')}</p>
      )}
    </div>
  );
}
