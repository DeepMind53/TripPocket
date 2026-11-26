import type { PhraseLang } from '@trippocket/shared';
import { useEffect, useState } from 'react';
import {
  downloadPhraseAudio,
  phraseAudioStatus,
  type AudioProgress,
  type AudioStatus,
} from '../../data/phraseAudioCache';
import { audioSize } from '../../domain/phraseAudio';
import { useTranslation } from '../../i18n';

/**
 * 회화 화면 위 한 줄: 이 말 소리 받기 (2026-11-26 사용자 요청 "중국어 학습 앱과 같게 받은 뒤 재생").
 * [받기] → 받는 중 12/20 → 받음 (기기에 저장, 인터넷 없이 들림). 받기 목록을 못 읽으면(인터넷 없음) 숨긴다
 */
export function PhraseAudioRow({ lang }: { lang: PhraseLang }) {
  const { t } = useTranslation();
  const [status, setStatus] = useState<AudioStatus | null>(null);
  const [progress, setProgress] = useState<AudioProgress | null>(null);
  useEffect(() => {
    let alive = true;
    void phraseAudioStatus([lang.code])
      .then((s) => alive && setStatus(s))
      .catch(() => alive && setStatus(null));
    return () => {
      alive = false;
    };
  }, [lang.code]);
  if (!status) return null;
  const done = status.total > 0 && status.have >= status.total;
  const get = () => {
    setProgress({ done: 0, total: status.total - status.have });
    void downloadPhraseAudio([lang.code], setProgress)
      .then(setStatus)
      .catch(() => undefined)
      .finally(() => setProgress(null));
  };
  return (
    <div
      data-phrase-audio=""
      className="flex min-h-12 items-center justify-between gap-3 rounded-card border border-line bg-surface px-4 py-1.5"
    >
      <span className="tabular min-w-0 text-body-2 text-fg-sub">
        {progress
          ? t('phrases.audioLoading', progress)
          : done
            ? t('phrases.audioDone', { lang: lang.name })
            : t('phrases.audioOffer', {
                lang: lang.name,
                n: status.total,
                size: audioSize(status.bytes),
              })}
      </span>
      {!done && (
        <button
          type="button"
          disabled={!!progress}
          onClick={get}
          className="h-10 shrink-0 rounded-btn bg-primary-weak px-4 text-caption font-semibold text-primary disabled:opacity-50"
        >
          {t('phrases.audioGet')}
        </button>
      )}
    </div>
  );
}
