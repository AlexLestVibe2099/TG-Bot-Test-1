/** Проверка токена до запуска polling */
export async function verifyBotToken(token) {
  const url = `https://api.telegram.org/bot${token}/getMe`;
  const response = await fetch(url);
  const data = await response.json();

  if (!data.ok) {
    const err = new Error(data.description || 'Invalid bot token');
    err.code = data.error_code;
    throw err;
  }

  return data.result;
}
