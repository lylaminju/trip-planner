export function stringValue(form: FormData, key: string): string {
  return String(form.get(key) ?? "").trim();
}

export function nullableValue(form: FormData, key: string): string | null {
  const value = stringValue(form, key);
  return value || null;
}
