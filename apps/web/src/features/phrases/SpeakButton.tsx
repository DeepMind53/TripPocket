import { Volume2 } from 'lucide-react';
import { useTranslation } from '../../i18n';
import { toast } from '../../shared/ui';

/** 언어 코드 → 읽기 목소리 언어. 지역이 붙은 말(zh-HK 광둥어 등)은 같은 지역 목소리만, 나머지는 앞 두 글자가 같은 것 */
const VOICE_LANG: Record<string, string> = { en: 'en-US' };

/** 읽는 중인 문장 — 크롬은 참조가 없으면 읽다가 정리해 버려 소리가 끊긴다 */
let current: SpeechSynthesisUtterance | null = null;

/**
 * 아이폰: 무음 스위치를 켜 두면 웹 읽기 소리가 나지 않는다. Safari 16.4+의 Audio Session API로
 * "소리 내는 앱"이라고 알려 무음 모드에서도 들리게 한다 (사용자 제보 2026-11-23). 없는 브라우저는 그대로
 */
function playThroughSilentSwitch() {
  const session = (navigator as Navigator & { audioSession?: { type: string } }).audioSession;
  if (session) session.type = 'playback';
}

/**
 * 회화 소리로 듣기 (2026-11-13, 실험실에서 정식 — 사용자 요청): 기기 읽기 기능(speechSynthesis)으로 현지어 문장을 읽는다.
 * 앱에 들어 있는 정해진 문장만 읽는다 (사용자 글은 읽지 않음). 목소리가 없는 기기는 안내만
 */
export function SpeakButton({ text, lang }: { text: string; lang: string }) {
  const { t } = useTranslation();
  if (typeof window === 'undefined' || !('speechSynthesis' in window)) return null;
  const speak = () => {
    const synth = window.speechSynthesis;
    const want = VOICE_LANG[lang] ?? lang;
    const voices = synth.getVoices();
    const norm = (v: SpeechSynthesisVoice) => v.lang.replace('_', '-').toLowerCase();
    const exact = voices.filter((v) => norm(v) === want.toLowerCase());
    const near = lang.includes('-')
      ? []
      : voices.filter((v) => norm(v).startsWith(lang.toLowerCase()));
    const pool = exact.length > 0 ? exact : near;
    // 같은 말 목소리가 여럿이면 기기 기본 → 기기 안 목소리 순 (아이폰의 장난 목소리 대신)
    const voice = pool.find((v) => v.default) ?? pool.find((v) => v.localService) ?? pool[0];
    // 목소리 목록을 아직 못 받은 기기(처음 한 번)는 언어만 정해 읽게 둔다
    if (voices.length > 0 && !voice) return toast(t('phrases.noVoice'));
    playThroughSilentSwitch();
    const u = new SpeechSynthesisUtterance(text);
    u.lang = voice?.lang ?? want;
    if (voice) u.voice = voice;
    u.rate = 0.9;
    current = u;
    u.onend = u.onerror = () => {
      if (current === u) current = null;
    };
    const busy = synth.speaking || synth.pending;
    // 읽는 중에 멈추고 바로 다시 읽으면 Safari·크롬이 새 문장을 버린다 → 멈춘 뒤 한 박자 쉬고
    if (busy) synth.cancel();
    const go = () => {
      synth.resume?.(); // 크롬: 다른 화면에 다녀온 뒤 '멈춤'으로 남아 있으면 아무 소리도 안 난다
      synth.speak(u);
    };
    if (busy) window.setTimeout(go, 60);
    else go();
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
