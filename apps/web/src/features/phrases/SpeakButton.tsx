import { Volume2 } from 'lucide-react';
import { useLab } from '../../data/labsStore';
import { useTranslation } from '../../i18n';
import { toast } from '../../shared/ui';

/** 언어 코드 → 읽기 목소리 언어. 지역이 붙은 말(zh-HK 광둥어 등)은 같은 지역 목소리만, 나머지는 앞 두 글자가 같은 것 */
const VOICE_LANG: Record<string, string> = { en: 'en-US' };

/**
 * 회화 소리로 듣기 (실험실 speakPhrase, 2026-11-13): 기기 읽기 기능(speechSynthesis)으로 현지어 문장을 읽는다.
 * 앱에 들어 있는 정해진 문장만 읽는다 (사용자 글은 읽지 않음). 목소리가 없는 기기는 안내만
 */
export function SpeakButton({ text, lang }: { text: string; lang: string }) {
  const { t } = useTranslation();
  const on = useLab('speakPhrase');
  if (!on || typeof window === 'undefined' || !('speechSynthesis' in window)) return null;
  const speak = () => {
    const want = VOICE_LANG[lang] ?? lang;
    const voices = window.speechSynthesis.getVoices();
    const voice =
      voices.find((v) => v.lang.replace('_', '-').toLowerCase() === want.toLowerCase()) ??
      (lang.includes('-')
        ? undefined
        : voices.find((v) => v.lang.toLowerCase().startsWith(lang.toLowerCase())));
    // 목소리 목록을 아직 못 받은 기기(처음 한 번)는 언어만 정해 읽게 둔다
    if (voices.length > 0 && !voice) return toast(t('phrases.noVoice'));
    const u = new SpeechSynthesisUtterance(text);
    u.lang = voice?.lang ?? want;
    if (voice) u.voice = voice;
    u.rate = 0.9;
    window.speechSynthesis.cancel();
    window.speechSynthesis.speak(u);
  };
  return (
    <button
      type="button"
      onClick={speak}
      className="flex h-12 items-center gap-2 rounded-full bg-primary-weak px-5 text-body-2 font-semibold text-primary"
    >
      <Volume2 aria-hidden="true" className="size-5" />
      {t('phrases.speak')}
    </button>
  );
}
