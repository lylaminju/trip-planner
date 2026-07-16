export function stringValue(form: FormData, key: string): string {
  return String(form.get(key) ?? "").trim();
}
