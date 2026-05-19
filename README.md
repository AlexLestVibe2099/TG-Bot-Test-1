# TG-Bot-Test-1

Telegram-бот для сбора заявок на первичную юридическую консультацию.

**Стек:** Node.js 18+, [Telegraf](https://telegraf.js.org/), [Supabase](https://supabase.com/) (PostgreSQL)

## Возможности

- Пошаговый сценарий записи на консультацию (FSM / Wizard Scene)
- Сбор: категория, описание, срочность, документы, способ связи, имя, телефон
- Подтверждение заявки перед отправкой
- **Supabase:** категории, менеджеры и заявки в PostgreSQL
- Уведомление менеджеров в Telegram
- Ответ на свободный текст в главном меню (OpenAI `gpt-4o-mini`, системный промпт в `src/config/aiSystemPrompt.js`)
- Команды `/start`, `/help`, `/cancel`

## Быстрый старт

### 1. Требования

- [Node.js](https://nodejs.org/) 18 или новее
- Токен бота от [@BotFather](https://t.me/BotFather)
- Проект [Supabase](https://supabase.com/) (бесплатный тариф подходит)

### 2. База данных Supabase

1. Создайте проект на [supabase.com](https://supabase.com/).
2. **SQL Editor** → вставьте и выполните файл `supabase/schema.sql`.
3. **Project Settings → API** скопируйте:
   - **Project URL** → `SUPABASE_URL`
   - **service_role** key (secret) → `SUPABASE_SERVICE_ROLE_KEY`

> `service_role` не публикуйте и не коммитьте — только в `.env`.

Справочники можно менять в **Table Editor**:
- `categories` — кнопки категорий в боте
- `managers` — команда в карточке заявки; поле `telegram_chat_id` для уведомлений
- `leads` — все заявки

### 3. Установка

```bash
npm install
```

### 4. Настройка окружения

```bash
copy .env.example .env
```

| Переменная | Обязательно | Описание |
|------------|-------------|----------|
| `BOT_TOKEN` | да | Токен от BotFather |
| `SUPABASE_URL` | да | URL проекта Supabase |
| `SUPABASE_SERVICE_ROLE_KEY` | да | Service role key |
| `MANAGER_CHAT_IDS` | нет* | Telegram ID менеджеров через запятую |
| `OPENAI_API_KEY` | нет* | Ключ OpenAI для свободного текста |
| `OPENAI_MODEL` | нет | По умолчанию `gpt-4o-mini` |
| `OPENAI_TEMPERATURE` | нет | По умолчанию `0.3` |
| `OPENAI_MAX_TOKENS` | нет | По умолчанию `300` |
| `CATALOG_CACHE_TTL_MS` | нет | Кэш категорий/менеджеров (мс) |

\* Без `OPENAI_API_KEY` бот отвечает шаблоном, без LLM.

> **Важно:** не задавайте `BOT_TOKEN` в переменных среды Windows — иначе может перекрыться `.env`.

\* Уведомления: `MANAGER_CHAT_IDS` + `managers.telegram_chat_id` из БД.

### 5. Запуск

```bash
npm start
```

Ожидаемый вывод:

```
✓ Supabase: 7 категорий, 3 менеджеров
✓ Токен действителен: @your_bot
✅ Бот запущен (long polling)
```

### 6. Проверка

1. `/start` → «Записаться на консультацию» → пройдите сценарий → «Подтвердить»
2. В Supabase → **Table Editor** → `leads` — новая строка
3. Менеджеру приходит карточка в Telegram

## Структура проекта

```
supabase/schema.sql   — таблицы и начальные данные
src/
  lib/supabase.js     — клиент Supabase
  services/
    catalog.js        — категории и менеджеры (кэш)
    leadsRepository.js — сохранение заявок
    notify.js         — уведомления
  scenes/             — сценарий консультации
```

## Дальнейшее развитие

- Row Level Security и `anon` key вместо `service_role` при публичном API
- Redis для FSM при нескольких инстансах
- Webhook вместо long polling
