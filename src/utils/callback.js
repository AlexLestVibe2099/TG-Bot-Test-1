/** Ответ на callback; устаревшие кнопки (бот был выключен) не роняют обработчик. */
export async function safeAnswerCbQuery(ctx, text) {
  try {
    await ctx.answerCbQuery(text);
  } catch (err) {
    const msg = err?.response?.description ?? err?.message ?? '';
    if (msg.includes('query is too old') || msg.includes('query ID is invalid')) {
      return;
    }
    throw err;
  }
}
