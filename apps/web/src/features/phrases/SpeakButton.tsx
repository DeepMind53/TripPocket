import { LoaderCircle, Volume2 } from 'lucide-react';
import { useEffect, useState } from 'react';
import { loadPhraseAudio, readyPhraseAudio, warmPhraseAudio } from '../../data/phraseAudioCache';
import { useTranslation } from '../../i18n';
import { toast } from '../../shared/ui';
import { phraseAudioUrl, spokenPhrase } from '../../domain/phraseAudio';

/** 언어 코드 → 읽기 목소리 언어. 지역이 붙은 말(zh-HK 광둥어 등)은 같은 지역 목소리만, 나머지는 앞 두 글자가 같은 것 */
const VOICE_LANG: Record<string, string> = { en: 'en-US', fil: 'fil-PH' };

/**
 * 같은 말의 다른 이름 — 안드로이드 구글 음성은 중국어를 cmn(표준어)·yue(광둥어)로 알려 준다 (2026-11-24)
 */
const ALIASES: Record<string, readonly string[]> = {
  'zh-cn': ['cmn-cn', 'cmn-hans-cn', 'zh-hans-cn'],
  'zh-tw': ['cmn-tw', 'cmn-hant-tw', 'zh-hant-tw'],
  'zh-hk': ['yue-hk', 'yue-hant-hk', 'zh-hant-hk'],
};

/** 미리 만든 음성 파일을 트는 플레이어 하나 (매번 새로 만들면 잦은 탭에 소리가 꼬인다) */
let player: HTMLAudioElement | null = null;
/** 마지막으로 누른 재생 차례 — 지난 누름의 실패는 무시 */
let playSeq = 0;

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

const norm = (lang: string) => lang.replace(/_/g, '-').toLowerCase();

/** 이 말을 읽을 목소리 — 같은 말이 여럿이면 기기 기본 → 기기 안 목소리 순 (아이폰의 장난 목소리 대신) */
function pickVoice(
  voices: readonly SpeechSynthesisVoice[],
  lang: string,
): SpeechSynthesisVoice | undefined {
  const want = norm(VOICE_LANG[lang] ?? lang);
  const names = [want, ...(ALIASES[want] ?? [])];
  const exact = voices.filter((v) => names.includes(norm(v.lang)));
  const near = lang.includes('-')
    ? []
    : voices.filter((v) => norm(v.lang).startsWith(lang.toLowerCase()));
  const pool = exact.length > 0 ? exact : near;
  return pool.find((v) => v.default) ?? pool.find((v) => v.localService) ?? pool[0];
}

/**
 * 읽기 (2026-11-24 안드로이드 크롬에서 소리가 안 난다는 제보로 보강):
 * - 누른 그 순간에 바로 읽는다 (크롬은 누른 동작 안에서 부른 읽기만 허락)
 * - 멈춤 상태일 때만 다시 시작 (멈춤이 아닐 때 resume을 부르면 안드로이드가 다음 문장을 버리는 일이 있다)
 * - 멈춘 직후 넣은 문장을 버리면 조금 뒤 한 번 더
 * - 고른 목소리로 실패하면 목소리를 정하지 않고 언어만으로 한 번 더, 그래도 안 되면 안내
 */
function say(
  text: string,
  lang: string,
  voice: SpeechSynthesisVoice | undefined,
  onFail: () => void,
) {
  const synth = window.speechSynthesis;
  const u = new SpeechSynthesisUtterance(text);
  u.lang = norm(voice?.lang ?? VOICE_LANG[lang] ?? lang).replace(/-([a-z]{2})$/, (m) =>
    m.toUpperCase(),
  );
  if (voice) u.voice = voice;
  u.rate = 0.9;
  current = u;
  let started = false;
  u.onstart = () => {
    started = true;
  };
  u.onend = () => {
    if (current === u) current = null;
  };
  u.onerror = (e) => {
    if (current === u) current = null;
    if (e.error === 'interrupted' || e.error === 'canceled') return;
    if (voice) say(text, lang, undefined, onFail);
    else onFail();
  };
  if (synth.speaking || synth.pending) synth.cancel();
  if (synth.paused) synth.resume();
  synth.speak(u);
  window.setTimeout(() => {
    if (current === u && !started && !synth.speaking && !synth.pending) synth.speak(u);
  }, 300);
}

/** 기기 읽기 기능으로 읽기 — 음성 파일을 못 틀었을 때만 (예전 방식) */
function speakWithDevice(text: string, lang: string, noVoice: () => void) {
  if (typeof window === 'undefined' || !('speechSynthesis' in window)) return noVoice();
  const voices = window.speechSynthesis.getVoices();
  const voice = pickVoice(voices, lang);
  // 목소리 목록을 아직 못 받은 기기(처음 한 번)는 언어만 정해 읽게 둔다
  if (voices.length > 0 && !voice) return noVoice();
  say(spokenPhrase(lang, text), lang, voice, noVoice);
}

/** 기기 안 소리를 튼다. 다시 눌러 끊긴 것(AbortError)·지난 누름·막힌 자동 재생(NotAllowedError, 다음 누름에 됨)은 실패가 아니다 */
function playLocal(src: string, seq: number, fail: () => void) {
  if (!player || seq !== playSeq) return;
  player.pause();
  player.src = src;
  const played = player.play() as Promise<void> | undefined;
  if (!played) return;
  played.then(
    // 기기 읽기로 읽던 소리가 있으면 멈춘다 (겹치지 않게)
    () => {
      if (window.speechSynthesis?.speaking) window.speechSynthesis.cancel();
    },
    (e: unknown) => {
      if (seq !== playSeq) return;
      if (e instanceof DOMException && (e.name === 'AbortError' || e.name === 'NotAllowedError'))
        return;
      fail();
    },
  );
}

/**
 * 회화 소리로 듣기 (2026-11-13 정식): 앱에 들어 있는 정해진 문장만 읽는다 (사용자 글은 읽지 않음).
 * 2026-11-26 사용자 요청: 미리 만든 음성 파일(public/phrases)을 쓴다 — 기기에 없으면 누를 때 한 번 받아 기기 저장소에
 * 넣고(받는 동안 아이콘이 돈다) 튼다. 그다음부터는 기기에서 바로 (비행기 모드에서도). 못 틀면 기기 읽기 기능, 그것도 없으면 안내
 */
export function SpeakButton({ text, lang }: { text: string; lang: string }) {
  const { t } = useTranslation();
  const url = phraseAudioUrl(lang, text);
  const [busy, setBusy] = useState(false);
  // 보이면 미리 꺼내 둔다 — 누른 그 순간 바로 틀 수 있게 (아이폰은 누른 동작 안에서 시작한 소리만 허락)
  useEffect(() => warmPhraseAudio([url]), [url]);
  const speak = () => {
    const noVoice = () => toast(t('phrases.noVoice'));
    const fail = () => speakWithDevice(text, lang, noVoice);
    playThroughSilentSwitch();
    if (typeof Audio === 'undefined') return fail();
    player ??= new Audio();
    const seq = ++playSeq;
    const local = readyPhraseAudio(url);
    if (local) return playLocal(local, seq, fail);
    // 기기에 아직 없음: 한 번 받아 저장한 뒤 튼다
    setBusy(true);
    loadPhraseAudio(url)
      .then((src) => playLocal(src, seq, fail))
      .catch(() => {
        if (seq === playSeq) fail();
      })
      .finally(() => setBusy(false));
  };
  return (
    <button
      type="button"
      onClick={speak}
      aria-busy={busy || undefined}
      className="flex h-12 items-center gap-2 rounded-full bg-primary-weak px-5 text-body-2 font-semibold text-primary"
    >
      {busy ? (
        <LoaderCircle aria-hidden="true" className="size-5 animate-spin" />
      ) : (
        <Volume2 aria-hidden="true" className="size-5" />
      )}
      {t('phrases.speak')}
    </button>
  );
}
