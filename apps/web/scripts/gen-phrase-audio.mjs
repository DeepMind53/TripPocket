/**
 * 회화 음성 파일 만들기 (2026-11-26): 앱에 들어 있는 정해진 회화 문장만 Edge 신경망 음성(무료)으로 mp3로 만들어
 * public/phrases/ 에 넣는다. 사용자 글은 보내지 않는다. 이미 있는 파일은 건너뛰고, 쓰지 않는 파일은 지운다.
 *
 * Edge 음성 모듈은 같은 PC의 중국어 학습 앱 것을 그대로 쓴다 (이 저장소에 ws 의존성을 넣지 않으려고).
 * 다른 위치면 EDGE_TTS_JS 환경변수로 그 모듈 경로를 준다.
 *
 *   node scripts/gen-phrase-audio.mjs          (apps/web 에서)
 */
import { existsSync, mkdirSync, readdirSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { PHRASE_IDS, PHRASE_LANGS } from '../../../packages/shared/src/data/phrases.ts';
import { phraseAudioFile, spokenPhrase } from '../src/domain/phraseAudio.ts';

const MODULE = process.env.EDGE_TTS_JS ?? 'D:/Study_Taiwan_Chinese/scripts/edge-tts.js';
const { edgeSynth } = createRequire(import.meta.url)(MODULE);

/** 언어 → 자연스러운 여성 신경망 음성 */
const VOICES = {
  ja: 'ja-JP-NanamiNeural',
  'zh-CN': 'zh-CN-XiaoxiaoNeural',
  'zh-TW': 'zh-TW-HsiaoChenNeural',
  'zh-HK': 'zh-HK-HiuMaanNeural',
  th: 'th-TH-PremwadeeNeural',
  vi: 'vi-VN-HoaiMyNeural',
  id: 'id-ID-GadisNeural',
  en: 'en-US-JennyNeural',
  fr: 'fr-FR-DeniseNeural',
  it: 'it-IT-ElsaNeural',
  es: 'es-ES-ElviraNeural',
  mn: 'mn-MN-YesuiNeural',
  ms: 'ms-MY-YasminNeural',
  fil: 'fil-PH-BlessicaNeural',
  pt: 'pt-PT-RaquelNeural',
  de: 'de-DE-KatjaNeural',
  cs: 'cs-CZ-VlastaNeural',
  tr: 'tr-TR-EmelNeural',
  ru: 'ru-RU-SvetlanaNeural',
  lo: 'lo-LA-KeomanyNeural',
};

const OUT = 'public/phrases';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
/** 빨리 연달아 부르면 소리가 비어 온다 — 잠깐씩 쉬고, 실패하면 조금 더 쉬었다가 다시 (최대 3번). 못 만들면 null */
async function synth(text, voice) {
  for (let i = 0; i < 3; i++) {
    await sleep(1200 + i * 3000);
    try {
      return await edgeSynth(text, voice);
    } catch {
      // 다음 번에
    }
  }
  return null;
}
mkdirSync(OUT, { recursive: true });
const want = new Set();
/** 받기 목록 (manifest.json): 언어 → [파일, 바이트] — 앱이 받은 뒤 크기를 맞춰 본다 (중국어 학습 앱과 같게) */
const langOf = new Map();
let made = 0;
let todo = [];
for (const lang of PHRASE_LANGS) {
  const voice = VOICES[lang.code];
  if (!voice) throw new Error(`목소리 없음: ${lang.code}`);
  for (const id of PHRASE_IDS) {
    const text = lang.phrases[id];
    const file = phraseAudioFile(lang.code, text);
    want.add(file);
    langOf.set(file, lang.code);
    if (existsSync(`${OUT}/${file}`)) continue;
    todo.push({ file, text: spokenPhrase(lang.code, text), voice, label: `${lang.code} ${id}` });
  }
}
// 실패한 것은 건너뛰고 나머지를 먼저, 끝나면 실패한 것만 몇 바퀴 더 (목소리 서버가 잠깐씩 막힘)
for (let round = 0; round < 4 && todo.length > 0; round++) {
  const left = [];
  for (const t of todo) {
    const mp3 = await synth(t.text, t.voice);
    if (!mp3) {
      left.push(t);
      continue;
    }
    writeFileSync(`${OUT}/${t.file}`, mp3);
    made++;
    console.log(`만듦 ${t.label}: ${t.text}`);
  }
  todo = left;
  if (todo.length > 0) await sleep(30000);
}
for (const t of todo) console.log(`못 만듦 ${t.label}: ${t.text}`);
let removed = 0;
for (const f of readdirSync(OUT))
  if (f.endsWith('.mp3') && !want.has(f)) {
    rmSync(`${OUT}/${f}`);
    removed++;
  }
console.log(`새로 ${made}개, 못 만듦 ${todo.length}개, 지움 ${removed}개, 전체 ${want.size}개`);
if (todo.length > 0) process.exitCode = 1;
const langs = {};
for (const [file, code] of langOf)
  if (existsSync(`${OUT}/${file}`))
    (langs[code] ??= []).push([file, statSync(`${OUT}/${file}`).size]);
writeFileSync(`${OUT}/manifest.json`, JSON.stringify({ langs }) + '\n');
console.log('받기 목록 manifest.json 씀');
