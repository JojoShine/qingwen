import { randomBytes, scrypt, timingSafeEqual } from 'node:crypto';
import { promisify } from 'node:util';
const derive = promisify(scrypt);
export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(16).toString('hex');
  return `${salt}:${(await derive(password, salt, 64) as Buffer).toString('hex')}`;
}
export async function verifyPassword(password: string, hash: string): Promise<boolean> {
  const [salt, encoded] = hash.split(':');
  if (!salt || !encoded || !/^[a-f0-9]{128}$/.test(encoded)) return false;
  const actual = await derive(password, salt, 64) as Buffer;
  return timingSafeEqual(actual, Buffer.from(encoded, 'hex'));
}
