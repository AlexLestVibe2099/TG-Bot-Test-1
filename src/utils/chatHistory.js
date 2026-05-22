const MAX_MESSAGES = 10;

/** @typedef {{ role: 'user' | 'assistant', content: string }} ChatTurn */

/**
 * @param {import('telegraf').Context['session']} session
 * @returns {ChatTurn[]}
 */
export function getChatHistory(session) {
  if (!Array.isArray(session.chatHistory)) {
    session.chatHistory = [];
  }
  return session.chatHistory;
}

/** @param {import('telegraf').Context['session']} session */
export function clearChatHistory(session) {
  session.chatHistory = [];
}

/**
 * @param {import('telegraf').Context['session']} session
 * @param {'user' | 'assistant'} role
 * @param {string} content
 */
export function appendChatTurn(session, role, content) {
  const history = getChatHistory(session);
  history.push({ role, content: content.trim() });
  while (history.length > MAX_MESSAGES) {
    history.shift();
  }
}

/**
 * История для API (без текущего сообщения пользователя).
 * @param {import('telegraf').Context['session']} session
 */
export function getChatHistoryForApi(session) {
  return getChatHistory(session).map((m) => ({ role: m.role, content: m.content }));
}
