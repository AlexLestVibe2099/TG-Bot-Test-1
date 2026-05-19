/** Категории юридических услуг (захардкожено) */
export const CATEGORIES = [
  { id: 'family', label: 'Семейное право' },
  { id: 'labor', label: 'Трудовой спор' },
  { id: 'realty', label: 'Недвижимость' },
  { id: 'debts', label: 'Долги' },
  { id: 'business', label: 'Бизнес' },
  { id: 'inheritance', label: 'Наследство' },
  { id: 'other', label: 'Другое' },
];

export function findCategoryById(id) {
  return CATEGORIES.find((c) => c.id === id) ?? null;
}
