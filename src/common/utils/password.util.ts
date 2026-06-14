import * as bcrypt from 'bcryptjs';

const SALT_ROUNDS = 10;

export function hashSecret(value: string): Promise<string> {
  return bcrypt.hash(value, SALT_ROUNDS);
}

export function verifySecret(value: string, hash?: string | null): Promise<boolean> {
  if (!hash) return Promise.resolve(false);
  return bcrypt.compare(value, hash);
}

/** Usernames are case-insensitive; normalise to lower-case, trimmed. */
export function normalizeUsername(username: string): string {
  return username.trim().toLowerCase();
}

/** Security answers compared case-insensitively, whitespace-trimmed. */
export function normalizeAnswer(answer: string): string {
  return answer.trim().toLowerCase();
}
