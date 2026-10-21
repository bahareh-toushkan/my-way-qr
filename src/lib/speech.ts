// 읽어 주기: 브라우저 내장 음성 합성 (서버·외부 서비스로 보내지 않음)
import { SPEECH_LANG } from '../../shared/i18n';
import type { Lang } from '../../shared/types';

export function speechSupported(): boolean {
  return typeof window !== 'undefined' && 'speechSynthesis' in window;
}

export function speak(text: string, lang: Lang) {
  if (!speechSupported() || !text.trim()) return;
  const synth = window.speechSynthesis;
  synth.cancel();
  const u = new SpeechSynthesisUtterance(text);
  u.lang = SPEECH_LANG[lang];
  const voice = synth.getVoices().find((v) => v.lang.toLowerCase().startsWith(SPEECH_LANG[lang].slice(0, 2)));
  if (voice) u.voice = voice;
  u.rate = 0.95;
  synth.speak(u);
}

export function stopSpeaking() {
  if (speechSupported()) window.speechSynthesis.cancel();
}
