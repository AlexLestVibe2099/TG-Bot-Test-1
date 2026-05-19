/**
 * Менеджеры для справки (уведомления идут в MANAGER_CHAT_IDS из .env).
 * Захардкожено для отображения в карточке заявки.
 */
export const MANAGERS = [
  { id: 'mgr_1', name: 'Анна Смирнова', role: 'Семейное право, наследство' },
  { id: 'mgr_2', name: 'Дмитрий Козлов', role: 'Трудовые споры, бизнес' },
  { id: 'mgr_3', name: 'Елена Волкова', role: 'Недвижимость, долги' },
];

export function getManagerLine() {
  return MANAGERS.map((m) => `• ${m.name} — ${m.role}`).join('\n');
}
