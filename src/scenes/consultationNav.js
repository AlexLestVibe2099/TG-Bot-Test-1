import { messages } from '../config/messages.js';
import { getCategories } from '../services/catalog.js';
import {
  categoryKeyboard,
  urgencyKeyboard,
  yesNoKeyboard,
  contactMethodKeyboard,
  phoneRequestKeyboard,
  textStepNavKeyboard,
  confirmKeyboard,
  mainMenuKeyboard,
  CB,
} from '../keyboards/index.js';
import { formatDraftSummary } from '../utils/draft.js';

/** @param {Record<string, string>} draft */
export function clearDraftFromStep(draft, targetStep) {
  if (targetStep <= 1) {
    draft.categoryId = '';
    draft.categoryLabel = '';
  }
  if (targetStep <= 2) draft.description = '';
  if (targetStep <= 3) draft.urgency = '';
  if (targetStep <= 4) draft.hasDocuments = '';
  if (targetStep <= 5) draft.contactMethod = '';
  if (targetStep <= 6) draft.displayName = '';
  if (targetStep <= 7) draft.phone = '';
}

/** @param {import('telegraf').Context} ctx */
export async function goBack(ctx, draft) {
  const step = ctx.wizard.cursor;

  switch (step) {
    case 0:
    case 1: {
      ctx.session.draft = null;
      await ctx.reply(messages.backToMenu, mainMenuKeyboard());
      return ctx.scene.leave();
    }
    case 2: {
      clearDraftFromStep(draft, 1);
      const categories = await getCategories();
      await ctx.reply(messages.chooseCategory, categoryKeyboard(categories));
      return ctx.wizard.selectStep(1);
    }
    case 3: {
      clearDraftFromStep(draft, 2);
      await ctx.reply(messages.askDescription, textStepNavKeyboard());
      return ctx.wizard.selectStep(2);
    }
    case 4: {
      clearDraftFromStep(draft, 3);
      await ctx.reply(messages.askUrgency, urgencyKeyboard());
      return ctx.wizard.selectStep(3);
    }
    case 5: {
      clearDraftFromStep(draft, 4);
      await ctx.reply(messages.askDocuments, yesNoKeyboard(CB.DOCUMENTS));
      return ctx.wizard.selectStep(4);
    }
    case 6: {
      clearDraftFromStep(draft, 5);
      await ctx.reply(messages.askContactMethod, contactMethodKeyboard());
      return ctx.wizard.selectStep(5);
    }
    case 7: {
      clearDraftFromStep(draft, 6);
      await ctx.reply(messages.askName, textStepNavKeyboard());
      return ctx.wizard.selectStep(6);
    }
    case 8: {
      clearDraftFromStep(draft, 7);
      await ctx.reply(messages.askPhone, phoneRequestKeyboard());
      await ctx.reply(messages.phoneStepHint, textStepNavKeyboard());
      return ctx.wizard.selectStep(7);
    }
    default:
      return;
  }
}

/** @param {import('telegraf').Context} ctx */
export async function showConfirmStep(ctx, draft) {
  await ctx.reply(
    `${messages.confirmIntro}\n\n${formatDraftSummary(draft)}\n\n${messages.confirmQuestion}`,
    { parse_mode: 'Markdown', ...confirmKeyboard() },
  );
  return ctx.wizard.selectStep(8);
}
