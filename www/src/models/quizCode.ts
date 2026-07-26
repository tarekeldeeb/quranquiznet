/**
 * Computes a deterministic, 8-character uppercase alphanumeric Quiz Code
 * for a given user UID using a simple non-cryptographic FNV-1a string hash.
 */
export function quizCodeOf(uid: string): string {
  if (!uid) return '00000000';
  const CHARS = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ';

  let h1 = 0x811c9dc5;
  let h2 = 0x050c5d1f;

  for (let i = 0; i < uid.length; i++) {
    const ch = uid.charCodeAt(i);
    h1 = Math.imul(h1 ^ ch, 0x01000193) >>> 0;
    h2 = Math.imul(h2 ^ ch, 0x01000193) >>> 0;
  }

  let code = '';
  let temp1 = h1;
  for (let i = 0; i < 4; i++) {
    code += CHARS[temp1 % 36];
    temp1 = Math.floor(temp1 / 36);
  }
  let temp2 = h2;
  for (let i = 0; i < 4; i++) {
    code += CHARS[temp2 % 36];
    temp2 = Math.floor(temp2 / 36);
  }

  return code;
}
