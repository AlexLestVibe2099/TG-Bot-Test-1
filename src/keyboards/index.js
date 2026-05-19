import { Markup } from 'telegraf';

export const CB = {
  START_CONSULT: 'start_consult',
  CATEGORY: 'cat',
  URGENCY: 'urg',
  DOCUMENTS: 'doc',
  CONTACT: 'contact',
  CONFIRM: 'confirm',
  EDIT: 'edit',
  BACK: 'back',
  CANCEL: 'cancel_req',
  NEW_REQUEST: 'new_req',
  TO_MENU: 'to_menu',
};

/** @param {boolean} showBack */
export function navRow(showBack = true) {
  const buttons = [];
  if (showBack) buttons.push(Markup.button.callback('◀️ Назад', CB.BACK));
  buttons.push(Markup.button.callback('❌ Отменить', CB.CANCEL));
  return buttons;
}

/** @param {import('telegraf/types').InlineKeyboardButton[][]} rows */
function withNav(rows, showBack = true) {
  return Markup.inlineKeyboard([...rows, navRow(showBack)]);
}

export function mainMenuKeyboard() {
  return Markup.inlineKeyboard([
    [Markup.button.callback('📋 Записаться на консультацию', CB.START_CONSULT)],
  ]);
}

/** Кнопки «Назад» и «Отменить» для шагов с текстовым вводом */
export function textStepNavKeyboard(showBack = true) {
  return Markup.inlineKeyboard([navRow(showBack)]);
}

/** @param {{ id: string, label: string }[]} categories */
export function categoryKeyboard(categories) {
  const rows = categories.map((c) => [
    Markup.button.callback(c.label, `${CB.CATEGORY}:${c.id}`),
  ]);
  return withNav(rows, true);
}

export function urgencyKeyboard() {
  return withNav([
    [Markup.button.callback('🔴 Сегодня', `${CB.URGENCY}:today`)],
    [Markup.button.callback('🟡 В течение 2–3 дней', `${CB.URGENCY}:few_days`)],
    [Markup.button.callback('🟢 Не срочно', `${CB.URGENCY}:not_urgent`)],
  ]);
}

export function yesNoKeyboard(prefix) {
  return withNav([
    [
      Markup.button.callback('Да', `${prefix}:yes`),
      Markup.button.callback('Нет', `${prefix}:no`),
    ],
  ]);
}

export function contactMethodKeyboard() {
  return withNav([
    [Markup.button.callback('📞 Звонок', `${CB.CONTACT}:call`)],
    [Markup.button.callback('💬 Telegram', `${CB.CONTACT}:telegram`)],
  ]);
}

export function phoneRequestKeyboard() {
  return Markup.keyboard([
    [Markup.button.contactRequest('📱 Отправить контакт')],
  ])
    .oneTime()
    .resize();
}

export function removeKeyboard() {
  return Markup.removeKeyboard();
}

export function confirmKeyboard() {
  return withNav([
    [Markup.button.callback('✅ Подтвердить', `${CB.CONFIRM}:yes`)],
    [Markup.button.callback('✏️ Изменить всё', CB.EDIT)],
  ]);
}

export function afterSuccessKeyboard() {
  return Markup.inlineKeyboard([
    [Markup.button.callback('📋 Новая заявка', CB.NEW_REQUEST)],
    [Markup.button.callback('🏠 В меню', CB.TO_MENU)],
  ]);
}
