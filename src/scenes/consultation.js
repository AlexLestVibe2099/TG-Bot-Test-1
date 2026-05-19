import { Scenes } from 'telegraf';
import { messages } from '../config/messages.js';
import { findCategoryById } from '../config/categories.js';
import {
  CB,
  categoryKeyboard,
  urgencyKeyboard,
  yesNoKeyboard,
  contactMethodKeyboard,
  phoneRequestKeyboard,
  removeKeyboard,
  confirmKeyboard,
  mainMenuKeyboard,
  afterSuccessKeyboard,
} from '../keyboards/index.js';
import { createEmptyDraft, formatDraftSummary } from '../utils/draft.js';
import {
  isValidDescription,
  isValidName,
  normalizePhone,
} from '../utils/validation.js';
import { URGENCY_OPTIONS } from '../config/constants.js';
import { submitLead } from '../services/leads.js';

function ensureDraft(ctx) {
  if (!ctx.session.draft) {
    ctx.session.draft = createEmptyDraft(ctx.from);
  }
  return ctx.session.draft;
}

async function leaveCancelled(ctx) {
  ctx.session.draft = null;
  await ctx.reply(messages.cancelDone, mainMenuKeyboard());
  return ctx.scene.leave();
}

async function showConfirm(ctx) {
  const draft = ensureDraft(ctx);
  await ctx.reply(
    `${messages.confirmIntro}\n\n${formatDraftSummary(draft)}\n\n${messages.confirmQuestion}`,
    { parse_mode: 'Markdown', ...confirmKeyboard() },
  );
  return ctx.wizard.selectStep(8);
}

export const consultationScene = new Scenes.WizardScene(
  'consultation',

  // 0 — категория
  async (ctx) => {
    ensureDraft(ctx);
    await ctx.reply(messages.chooseCategory, categoryKeyboard());
    return ctx.wizard.next();
  },

  // 1 — ждём выбор категории
  async (ctx) => {
    const data = ctx.callbackQuery?.data;
    if (!data?.startsWith(`${CB.CATEGORY}:`)) {
      if (ctx.message?.text) {
        await ctx.reply(messages.useCategoryButton, categoryKeyboard());
      }
      return;
    }
    await ctx.answerCbQuery();
    const categoryId = data.split(':')[1];
    const category = findCategoryById(categoryId);
    if (!category) {
      await ctx.reply(messages.useCategoryButton, categoryKeyboard());
      return;
    }
    const draft = ensureDraft(ctx);
    draft.categoryId = category.id;
    draft.categoryLabel = category.label;
    await ctx.editMessageReplyMarkup();
    await ctx.reply(messages.askDescription);
    return ctx.wizard.next();
  },

  // 2 — описание
  async (ctx) => {
    const text = ctx.message?.text?.trim();
    if (!text) return;
    if (!isValidDescription(text)) {
      const msg = text.length < 20 ? messages.descriptionTooShort : messages.descriptionTooLong;
      await ctx.reply(msg);
      return;
    }
    ensureDraft(ctx).description = text;
    await ctx.reply(messages.askUrgency, urgencyKeyboard());
    return ctx.wizard.next();
  },

  // 3 — срочность
  async (ctx) => {
    const data = ctx.callbackQuery?.data;
    if (!data?.startsWith(`${CB.URGENCY}:`)) {
      if (ctx.message?.text) await ctx.reply(messages.useUrgencyButton, urgencyKeyboard());
      return;
    }
    await ctx.answerCbQuery();
    const key = data.split(':')[1];
    const label = URGENCY_OPTIONS[key];
    if (!label) {
      await ctx.reply(messages.useUrgencyButton, urgencyKeyboard());
      return;
    }
    ensureDraft(ctx).urgency = label;
    await ctx.editMessageReplyMarkup();
    await ctx.reply(messages.askDocuments, yesNoKeyboard(CB.DOCUMENTS));
    return ctx.wizard.next();
  },

  // 4 — документы
  async (ctx) => {
    const data = ctx.callbackQuery?.data;
    if (!data?.startsWith(`${CB.DOCUMENTS}:`)) {
      if (ctx.message?.text) await ctx.reply(messages.useDocumentsButton, yesNoKeyboard(CB.DOCUMENTS));
      return;
    }
    await ctx.answerCbQuery();
    const value = data.split(':')[1];
    if (value !== 'yes' && value !== 'no') {
      await ctx.reply(messages.useDocumentsButton, yesNoKeyboard(CB.DOCUMENTS));
      return;
    }
    ensureDraft(ctx).hasDocuments = value === 'yes' ? 'Да' : 'Нет';
    await ctx.editMessageReplyMarkup();
    await ctx.reply(messages.askContactMethod, contactMethodKeyboard());
    return ctx.wizard.next();
  },

  // 5 — способ связи
  async (ctx) => {
    const data = ctx.callbackQuery?.data;
    if (!data?.startsWith(`${CB.CONTACT}:`)) {
      if (ctx.message?.text) await ctx.reply(messages.useContactButton, contactMethodKeyboard());
      return;
    }
    await ctx.answerCbQuery();
    const method = data.split(':')[1];
    const label = method === 'call' ? 'Звонок' : method === 'telegram' ? 'Telegram' : null;
    if (!label) {
      await ctx.reply(messages.useContactButton, contactMethodKeyboard());
      return;
    }
    ensureDraft(ctx).contactMethod = label;
    await ctx.editMessageReplyMarkup();
    await ctx.reply(messages.askName);
    return ctx.wizard.next();
  },

  // 6 — имя
  async (ctx) => {
    const text = ctx.message?.text?.trim();
    if (!text || !isValidName(text)) {
      await ctx.reply(messages.nameInvalid);
      return;
    }
    ensureDraft(ctx).displayName = text;
    await ctx.reply(messages.askPhone, phoneRequestKeyboard());
    return ctx.wizard.next();
  },

  // 7 — телефон
  async (ctx) => {
    let phone = null;
    if (ctx.message?.contact?.phone_number) {
      phone = normalizePhone(ctx.message.contact.phone_number);
    } else if (ctx.message?.text) {
      phone = normalizePhone(ctx.message.text);
    }
    if (!phone) {
      await ctx.reply(messages.phoneInvalid, phoneRequestKeyboard());
      return;
    }
    ensureDraft(ctx).phone = phone;
    await ctx.reply('Контакт получен.', removeKeyboard());
    return showConfirm(ctx);
  },

  // 8 — подтверждение
  async (ctx) => {
    const data = ctx.callbackQuery?.data;
    if (!data) {
      if (ctx.message?.text) await ctx.reply(messages.useConfirmButton, confirmKeyboard());
      return;
    }
    await ctx.answerCbQuery();

    if (data === CB.EDIT) {
      const from = ctx.from;
      ctx.session.draft = createEmptyDraft(from);
      await ctx.reply(messages.chooseCategory, categoryKeyboard());
      return ctx.wizard.selectStep(1);
    }

    if (data !== `${CB.CONFIRM}:yes`) return;

    await ctx.editMessageReplyMarkup();
    await ctx.reply(messages.submitting);

    const result = await submitLead(ctx, ensureDraft(ctx));
    if (!result.ok) {
      await ctx.reply(messages.submitError, confirmKeyboard());
      return;
    }

    ctx.session.draft = null;
    await ctx.reply(messages.success, afterSuccessKeyboard());
    return ctx.scene.leave();
  },
);

consultationScene.action(CB.CANCEL, async (ctx) => {
  await ctx.answerCbQuery();
  return leaveCancelled(ctx);
});
