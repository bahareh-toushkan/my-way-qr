// '내 방식' 설정 화면 (처음 한 번). 설정은 이 휴대폰에만 저장된다.
import { useState } from 'react';
import { formatPrice } from '../../shared/catalog';
import { isRtl, t } from '../../shared/i18n';
import { constraintsFor, LANG_NAMES, QUICK_PRESETS } from '../../shared/profile';
import { LANGS, type Profile } from '../../shared/types';
import { api } from '../lib/api';
import { speak } from '../lib/speech';

interface Props {
  initial: Profile;
  testMode: boolean;
  onDone: (p: Profile) => void;
}

function Seg<T extends string | boolean>({ label, value, options, onChange }: { label: string; value: T; options: { v: T; text: string }[]; onChange: (v: T) => void }) {
  return (
    <fieldset className="seg">
      <legend>{label}</legend>
      <div className="seg-row">
        {options.map((o) => (
          <button key={String(o.v)} type="button" className={o.v === value ? 'on' : ''} aria-pressed={o.v === value} onClick={() => onChange(o.v)}>
            {o.text}
          </button>
        ))}
      </div>
    </fieldset>
  );
}

export default function Setup({ initial, testMode, onDone }: Props) {
  const [p, setP] = useState<Profile>(initial);
  const [said, setSaid] = useState('');
  const [working, setWorking] = useState(false);
  const [reason, setReason] = useState('');
  const ui = t(p.lang);
  const c = constraintsFor(p);
  const set = (patch: Partial<Profile>) => setP((old) => ({ ...old, ...patch }));

  const fromText = async () => {
    if (!said.trim()) return;
    setWorking(true);
    setReason('');
    try {
      const r = await api.profileFromText(said, p);
      setP(r.profile);
      setReason(r.reason);
    } catch (e) {
      setReason((e as Error).message);
    } finally {
      setWorking(false);
    }
  };

  const start = () => {
    if (p.voice) speak(ui.start, p.lang); // iOS: 사용자 동작 안에서 한 번 말해야 이후 읽어 주기가 됨
    onDone(p);
  };

  return (
    <div
      className={`me setup ${p.contrast === 'high' ? 'hc' : ''}`}
      dir={isRtl(p.lang) ? 'rtl' : 'ltr'}
      lang={p.lang}
      style={{ ['--fs' as string]: c.fontScale, ['--target' as string]: `${c.minTargetPx}px` }}
    >
      <h1>{ui.setupTitle}</h1>
      <p className="privacy">🔒 {ui.setupPrivacy}</p>
      {testMode && <p className="testnote">🧪 테스트 기록 중 (걸린 시간·누른 횟수만, 익명)</p>}

      <fieldset className="seg">
        <legend>{ui.langQ}</legend>
        <div className="seg-row wrap">
          {LANGS.map((l) => (
            <button key={l} type="button" className={l === p.lang ? 'on' : ''} aria-pressed={l === p.lang} onClick={() => set({ lang: l })} lang={l}>
              {LANG_NAMES[l].native}
            </button>
          ))}
        </div>
      </fieldset>

      <fieldset className="seg">
        <legend>{ui.quickQ}</legend>
        <div className="seg-row wrap">
          {QUICK_PRESETS.map((q) => (
            <button key={q.id} type="button" onClick={() => set(q.patch)}>
              {ui.presets[q.id as keyof typeof ui.presets]}
            </button>
          ))}
        </div>
      </fieldset>

      <Seg label={ui.textQ} value={p.text} onChange={(v) => set({ text: v })} options={[{ v: 'normal', text: ui.textOpts[0] }, { v: 'large', text: ui.textOpts[1] }, { v: 'xlarge', text: ui.textOpts[2] }]} />
      <Seg label={ui.touchQ} value={p.touch} onChange={(v) => set({ touch: v })} options={[{ v: 'normal', text: ui.touchOpts[0] }, { v: 'large', text: ui.touchOpts[1] }]} />
      <Seg label={ui.wordsQ} value={p.words} onChange={(v) => set({ words: v })} options={[{ v: 'normal', text: ui.wordsOpts[0] }, { v: 'easy', text: ui.wordsOpts[1] }]} />
      <Seg label={ui.detailQ} value={p.detail} onChange={(v) => set({ detail: v })} options={[{ v: 'short', text: ui.detailOpts[0] }, { v: 'step', text: ui.detailOpts[1] }]} />
      <Seg label={ui.voiceQ} value={p.voice} onChange={(v) => set({ voice: v })} options={[{ v: false, text: ui.voiceOpts[0] }, { v: true, text: ui.voiceOpts[1] }]} />
      <Seg label={ui.contrastQ} value={p.contrast} onChange={(v) => set({ contrast: v })} options={[{ v: 'normal', text: ui.contrastOpts[0] }, { v: 'high', text: ui.contrastOpts[1] }]} />

      <div className="preview" aria-hidden="true">
        <div className="btn item">
          <span className="ic">☕</span>
          <span className="lb">{p.lang === 'ko' ? '아메리카노' : 'Americano'}</span>
          <span className="pr">{formatPrice(3000, p.lang)}</span>
        </div>
      </div>

      <label className="sayit">
        <span>{ui.sayItLabel}</span>
        <textarea value={said} maxLength={300} placeholder={ui.sayItPlaceholder} onChange={(e) => setSaid(e.target.value)} rows={2} />
      </label>
      <button type="button" className="btn secondary" disabled={working || !said.trim()} onClick={fromText}>
        {working ? ui.sayItWorking : `✨ ${ui.sayItButton}`}
      </button>
      {reason && <p className="reason">{reason}</p>}

      <button type="button" className="btn primary start" onClick={start}>
        {ui.start} →
      </button>
    </div>
  );
}
