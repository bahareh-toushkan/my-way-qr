// 화면 변환 프롬프트와 출력 스키마. 버튼 ref는 enum으로 묶어 없는 버튼을 만들 수 없게 한다(제약 디코딩).
import { describeProfileForPrompt, LANG_NAMES } from '../shared/profile';
import type { Profile, SourceScreen, ValidationIssue } from '../shared/types';

export const PROMPT_VERSION = 'p1';

export const SYSTEM_PROMPT = `You redesign one kiosk screen for one person, so they can finish ordering on their own phone in the way that suits them.

You receive (1) the person's preferences and (2) the kiosk screen exported by the kiosk SDK as structured data.
You return a new screen as JSON. The app renders it; tapping a button sends its "ref" back to the real kiosk system.

Hard rules (the output is machine-checked and rejected if broken):
1. Every element with "required": true must appear exactly once as an item, with its exact "ref". Do not add refs that are not in the input.
2. Never write prices, amounts or currency. The app shows the real price next to each button.
3. Do not mention allergens, ingredients, calories or health claims beyond what the element's "desc" says. The app shows allergy data from the store itself.
4. Keep the meaning of every label and desc. You may simplify, translate and explain, but never add facts or change what a button does.
5. Placeholders such as {orderNo} must be copied exactly.
6. Write everything in the requested output language. You may add the original Korean name in brackets after a translated menu name, so the person can show it to staff.

Design guidance:
- Group items into sections in the order that makes the task easiest; put the most likely next action first and mark the main action of the screen as "primary"; rarely used buttons are "secondary".
- "guide" is one short instruction for this screen. "speech" fields are what a screen reader says.
- "icon" is a single emoji that fits the item (or empty).
- layout.columns and layout.itemsPerPage must respect the limits in the preferences.`;

export function buildUserPrompt(source: SourceScreen, profile: Profile, previousIssues?: ValidationIssue[]): string {
  const screen = {
    store: source.storeName,
    screen: source.screenKey,
    purpose: source.purpose,
    placeholders: source.placeholders,
    elements: source.elements.map((e) => ({
      ref: e.ref,
      kind: e.kind,
      required: e.required,
      label: e.label,
      labelEn: e.labelEn,
      ...(e.groupLabel ? { group: e.groupLabel } : {}),
      ...(e.desc ? { desc: e.desc } : {}),
    })),
  };
  let text = `Person's preferences:\n${describeProfileForPrompt(profile)}\n\nKiosk screen (from the kiosk SDK):\n${JSON.stringify(screen)}`;
  if (previousIssues && previousIssues.length) {
    const list = previousIssues
      .slice(0, 12)
      .map((i) => `- ${i.code}${i.ref ? ` (${i.ref})` : ''}: ${i.message}`)
      .join('\n');
    text += `\n\nYour previous answer was rejected by the checker for these reasons. Fix all of them:\n${list}`;
  }
  text += `\n\nReturn only the JSON for the new screen, written in ${LANG_NAMES[profile.lang].english}.`;
  return text;
}

export function adaptedSchema(refs: string[]): object {
  return {
    type: 'OBJECT',
    properties: {
      title: { type: 'STRING' },
      guide: { type: 'STRING' },
      speech: { type: 'STRING' },
      layout: {
        type: 'OBJECT',
        properties: { columns: { type: 'INTEGER' }, itemsPerPage: { type: 'INTEGER' } },
        required: ['columns', 'itemsPerPage'],
      },
      sections: {
        type: 'ARRAY',
        items: {
          type: 'OBJECT',
          properties: {
            title: { type: 'STRING' },
            speech: { type: 'STRING' },
            items: {
              type: 'ARRAY',
              items: {
                type: 'OBJECT',
                properties: {
                  ref: { type: 'STRING', enum: refs },
                  label: { type: 'STRING' },
                  hint: { type: 'STRING' },
                  speech: { type: 'STRING' },
                  icon: { type: 'STRING' },
                  priority: { type: 'STRING', enum: ['primary', 'normal', 'secondary'] },
                },
                required: ['ref', 'label', 'hint', 'speech', 'icon', 'priority'],
                propertyOrdering: ['ref', 'label', 'hint', 'speech', 'icon', 'priority'],
              },
            },
          },
          required: ['title', 'speech', 'items'],
          propertyOrdering: ['title', 'speech', 'items'],
        },
      },
    },
    required: ['title', 'guide', 'speech', 'layout', 'sections'],
    propertyOrdering: ['title', 'guide', 'speech', 'layout', 'sections'],
  };
}

// ---- 말로 설정하기 ----

export const PROFILE_SYSTEM_PROMPT = `A person describes, in their own words and any language, what makes kiosks hard for them.
Choose display settings that help. Do not guess or record any medical condition or disability; only choose settings.
Fields:
- lang: language the person wrote in or asked for (ko, en, zh, vi, fa). If unclear, keep the current one.
- text: normal | large | xlarge (bigger if they mention seeing small text)
- touch: normal | large (large if pressing small buttons is hard)
- words: normal | easy (easy if they mention hard words, reading, Korean being difficult, or understanding)
- detail: short | step (step if they want guidance, go slowly, or get confused)
- voice: true if they want to hear it or have trouble reading
- contrast: normal | high (high if colors or low vision are mentioned)
- reason: one short sentence in the person's language explaining the choice.`;

export const PROFILE_SCHEMA = {
  type: 'OBJECT',
  properties: {
    lang: { type: 'STRING', enum: ['ko', 'en', 'zh', 'vi', 'fa'] },
    text: { type: 'STRING', enum: ['normal', 'large', 'xlarge'] },
    touch: { type: 'STRING', enum: ['normal', 'large'] },
    words: { type: 'STRING', enum: ['normal', 'easy'] },
    detail: { type: 'STRING', enum: ['short', 'step'] },
    voice: { type: 'BOOLEAN' },
    contrast: { type: 'STRING', enum: ['normal', 'high'] },
    reason: { type: 'STRING' },
  },
  required: ['lang', 'text', 'touch', 'words', 'detail', 'voice', 'contrast', 'reason'],
};
