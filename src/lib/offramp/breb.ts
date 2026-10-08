// Bre-B keys come in four kinds: a phone number, a document number, an email
// and an alphanumeric key, which always starts with "@". People often copy the
// alphanumeric one without it, so add it when the input can only be that kind.
export function normalizeBreBKey(value: string): string {
  const key = value.replace(/\s+/g, "");
  if (!key || key.includes("@")) return key;
  if (/^\+?\d+$/.test(key)) return key;
  return /[a-z]/i.test(key) ? `@${key}` : key;
}
