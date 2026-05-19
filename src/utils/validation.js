const PHONE_RE = /^\+?[78]?\s*\(?\d{3}\)?[\s-]?\d{3}[\s-]?\d{2}[\s-]?\d{2}$/;

export function normalizePhone(input) {
  const digits = input.replace(/\D/g, '');
  if (digits.length === 11 && (digits.startsWith('7') || digits.startsWith('8'))) {
    return `+7${digits.slice(1)}`;
  }
  if (digits.length === 10) {
    return `+7${digits}`;
  }
  return null;
}

export function isValidPhone(text) {
  return normalizePhone(text) !== null || PHONE_RE.test(text.replace(/\s/g, ''));
}

export function isValidName(text) {
  const t = text?.trim() ?? '';
  return t.length >= 2 && t.length <= 100;
}

export function isValidDescription(text) {
  const t = text?.trim() ?? '';
  return t.length >= 20 && t.length <= 2000;
}
