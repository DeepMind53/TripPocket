import { useEffect, useState } from 'react';
import {
  clearPhraseAudio,
  downloadPhraseAudio,
  onPhraseAudioChange,
  phraseAudioStatus,
  type AudioProgress,
  type AudioStatus,
} from '../../data/phraseAudioCache';
import { audioSize } from '../../domain/phraseAudio';
import { useTranslation } from '../../i18n';
import { toast } from '../../shared/ui';

/**
 * 설정 → 회화 소리 데이터 (2026-11-26 사용자 요청, 중국어 학습 앱 "오프라인 음성 데이터"와 같게):
 * 20개 말 400문장 소리를 한 번에 받기(진행률) · 받은 양 · 지우기(두 번 눌러야). 즉시 적용, 저장 버튼 없음 (docs/12 §3.1)
 */
export function PhraseAudioGroup() {
  const { t } = useTranslation();
  const [status, setStatus] = useState<AudioStatus | null>(null);
  const [progress, setProgress] = useState<AudioProgress | null>(null);
  const [armed, setArmed] = useState(false);
  useEffect(() => {
    const read = () =>
      void phraseAudioStatus()
        .then(setStatus)
        .catch(() => setStatus(null));
    read();
    // 회화 화면·[소리로 듣기]가 받으면 다시 센다
    return onPhraseAudioChange(read);
  }, []);
  // 두 번 눌러야 지움 (3초 안에, 기기 데이터 정리와 같게)
  useEffect(() => {
    if (!armed) return;
    const id = window.setTimeout(() => setArmed(false), 3000);
    return () => window.clearTimeout(id);
  }, [armed]);
  if (!status) return null;
  const done = status.total > 0 && status.have >= status.total;
  const get = () => {
    setProgress({ done: 0, total: status.total - status.have });
    void downloadPhraseAudio(undefined, setProgress)
      .then(setStatus)
      .catch(() => undefined)
      .finally(() => setProgress(null));
  };
  const clear = () => {
    if (!armed) return setArmed(true);
    setArmed(false);
    void clearPhraseAudio()
      .then(() => phraseAudioStatus())
      .then((s) => {
        setStatus(s);
        toast(t('deviceData.cleared'));
      });
  };
  return (
    <section aria-label={t('phrases.audioDataTitle')} className="flex flex-col gap-2">
      <h2 className="px-1 text-caption font-medium text-fg-muted">{t('phrases.audioDataTitle')}</h2>
      <div className="flex min-h-12 items-center justify-between gap-3 rounded-card border border-line bg-surface px-4 py-2">
        <span className="tabular min-w-0 text-body-2 text-fg-sub">
          {progress
            ? t('phrases.audioLoading', progress)
            : done
              ? t('phrases.audioDataDone', { have: status.have, size: audioSize(status.haveBytes) })
              : t('phrases.audioDataValue', {
                  total: status.total,
                  have: status.have,
                  size: audioSize(status.bytes),
                })}
        </span>
        <span className="flex shrink-0 gap-2">
          {!done && (
            <button
              type="button"
              disabled={!!progress}
              onClick={get}
              className="h-10 rounded-btn bg-primary-weak px-4 text-caption font-semibold text-primary disabled:opacity-50"
            >
              {t('phrases.audioGet')}
            </button>
          )}
          {status.have > 0 && !progress && (
            <button
              type="button"
              onClick={clear}
              className={`h-10 rounded-btn px-3 text-caption font-semibold ${
                armed ? 'bg-danger text-white' : 'bg-bg-subtle text-danger'
              }`}
            >
              {armed ? t('deviceData.confirm') : t('deviceData.clear')}
            </button>
          )}
        </span>
      </div>
    </section>
  );
}
