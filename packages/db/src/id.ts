const CHARS = 'abcdefghijklmnopqrstuvwxyz0123456789';

/** Generate a 15-character alphanumeric ID. */
export function generateId(length = 15): string {
  const bytes = crypto.getRandomValues(new Uint8Array(length));
  let id = '';
  for (let i = 0; i < length; i++) {
    id += CHARS[bytes[i] % CHARS.length];
  }
  return id;
}
