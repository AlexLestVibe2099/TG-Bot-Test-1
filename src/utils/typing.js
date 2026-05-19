/** Показывает «печатает…» на время долгого запроса (обновление каждые 4 с) */
export async function withTypingIndicator(ctx, task) {
  const sendTyping = () => ctx.sendChatAction('typing').catch(() => {});
  await sendTyping();
  const interval = setInterval(sendTyping, 4000);
  try {
    return await task();
  } finally {
    clearInterval(interval);
  }
}
