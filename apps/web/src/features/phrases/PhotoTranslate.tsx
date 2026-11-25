import type { PhotoTranslation } from '@trippocket/shared';
import { useEffect, useState } from 'react';
import { translatePhoto } from '../../data/services/photoVision';
import { useTranslation } from '../../i18n';
import { shrinkImage } from '../../shared/lib/shrinkImage';
import { BottomSheet, SegmentedControl, Spinner, toast } from '../../shared/ui';
import { TranslatedPhoto } from '../photos/TranslatedPhoto';
import { CaptureTile } from '../photos/CaptureTile';

/**
 * 번역·회화 [사진으로 번역] (실험실 photoTranslate, ADR-0012 — 2026-11-11): 메뉴판·안내문을 찍거나 골라
 * 글자를 읽고 한국어로 옮긴다. 누를 때만 그 사진 한 장을 보내고, 사진·결과는 어디에도 저장하지 않는다
 */
export function PhotoTranslate() {
  const { t } = useTranslation();
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<PhotoTranslation | null>(null);
  // 보낸 사진(줄인 것)을 화면에만 — 번역을 그 위에 덮는다 (2026-11-25). 닫으면 지운다
  const [url, setUrl] = useState<string | null>(null);
  const [view, setView] = useState<'photo' | 'list'>('photo');
  useEffect(() => () => void (url && URL.revokeObjectURL(url)), [url]);

  const run = async (file: File) => {
    setBusy(true);
    try {
      const small = await shrinkImage(file);
      const r = await translatePhoto(small);
      if (r === 'limit') toast(t('photoTranslate.limit'));
      else if (r === 'unavailable') toast(t('photoTranslate.failed'));
      else if (r.lines.length === 0) toast(t('photoTranslate.empty'));
      else {
        setUrl(URL.createObjectURL(small));
        setView('photo');
        setResult(r);
      }
    } finally {
      setBusy(false);
    }
  };

  return (
    <section aria-label={t('photoTranslate.title')} className="flex flex-col gap-2">
      <h2 className="text-body-2 font-semibold">{t('photoTranslate.title')}</h2>
      <CaptureTile
        kind="photo"
        label={t('photoTranslate.tile')}
        multiple={false}
        onFiles={(f) => void run(f[0]!)}
      />
      {busy && (
        <p role="status" className="flex items-center gap-2 text-caption text-fg-sub">
          <Spinner />
          {t('photoTranslate.reading')}
        </p>
      )}
      <p className="text-caption whitespace-pre-line text-fg-muted">{t('photoTranslate.note')}</p>
      <BottomSheet
        open={result !== null}
        onOpenChange={(o) => {
          if (o) return;
          setResult(null);
          setUrl(null);
        }}
        title={t('photoTranslate.title')}
        autoFocusInput={false}
      >
        {url && result?.lines.some((l) => l.box) && (
          <SegmentedControl
            label={t('photoTranslate.view')}
            value={view}
            onChange={setView}
            options={[
              { value: 'photo', label: t('photoTranslate.viewPhoto') },
              { value: 'list', label: t('photoTranslate.viewList') },
            ]}
            className="mb-3"
          />
        )}
        {url && view === 'photo' && result?.lines.some((l) => l.box) ? (
          <TranslatedPhoto url={url} lines={result.lines} />
        ) : (
          <ul className="flex flex-col divide-y divide-line pb-2">
            {result?.lines.map((l, i) => (
              <li key={i} className="flex flex-col gap-0.5 py-2">
                <span className="text-body-1 font-medium">{l.ko ?? l.text}</span>
                {l.ko !== null && l.ko !== l.text && (
                  <span className="text-caption text-fg-muted">{l.text}</span>
                )}
              </li>
            ))}
          </ul>
        )}
        {result?.lines.some((l) => l.ko === null) && (
          <p className="pb-2 text-caption whitespace-pre-line text-fg-muted">
            {t('photoTranslate.noAi')}
          </p>
        )}
      </BottomSheet>
    </section>
  );
}
