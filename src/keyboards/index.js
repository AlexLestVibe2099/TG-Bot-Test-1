import { Markup } from 'telegraf';
import { CATEGORIES } from '../config/categories.js';

export const CB = {
  START_CONSULT: 'start_consult',
  CATEGORY: 'cat',
  URGENCY: 'urg',
  DOCUMENTS: 'doc',
  CONTACT: 'contact',
  CONFIRM: 'confirm',
  EDIT: 'edit',
  CANCEL: 'cancel_req',
  NEW_REQUEST: 'new_req',
  TO_MENU: 'to_menu',
};

export function mainMenuKeyboard() {
  return Markup.inlineKeyboard([
    [Markup.button.callback('📋 Записаться на консультацию', CB.START_CONSULT)],
  ]);
}

export function categoryKeyboard() {
  const rows = CATEGORIES.map((c) => [
    Markup.button.callback(c.label, `${CB.CATEGORY}:${c.id}`),
  ]);
  rows.push([Markup.button.callback('❌ Отменить', CB.CANCEL)]);
  return Markup.inlineKeyboard(rows);
}

export function urgencyKeyboard() {
  return Markup.inlineKeyboard([
    [Markup.button.callback('🔴 Сегодня', `${CB.URGENCY}:today`)],
    [Markup.button.callback('🟡 В течение 2–3 дней', `${CB.URGENCY}:few_days`)],
    [Markup.button.callback('🟢 Не срочно', `${CB.URGENCY}:not_urgent`)],
    [Markup.button.callback('❌ Отменить', CB.CANCEL)],
  ]);
}

export function yesNoKeyboard(prefix) {
  return Markup.inlineKeyboard([
    [
      Markup.button.callback('Да', `${prefix}:yes`),
      Markup.button.callback('Нет', `${prefix}:no`),
    ],
    [Markup.button.callback('❌ Отменить', CB.CANCEL)],
  ]);
}

export function contactMethodKeyboard() {
  return Markup.inlineKeyboard([
    [Markup.button.callback('📞 Звонок', `${CB.CONTACT}:call`)],
    [Markup.button.callback('💬 Telegram', `${CB.CONTACT}:telegram`)],
    [Markup.button.callback('❌ Отменить', CB.CANCEL)],
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
  return Markup.inlineKeyboard([
    [Markup.button.callback('✅ Подтвердить', `${CB.CONFIRM}:yes`)],
    [Markup.button.callback('✏️ Изменить', CB.EDIT)],
    [Markup.button.callback('❌ Отменить', CB.CANCEL)],
  ]);
}

export function afterSuccessKeyboard() {
  return Markup.inlineKeyboard([
    [Markup.button.callback('📋 Новая заявка', CB.NEW_REQUEST)],
    [Markup.button.callback('🏠 В меню', CB.TO_MENU)],
  ]);
}
