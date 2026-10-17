import { describe, expect, it } from 'vitest';
import { hashPassword, verifyPassword } from './password';
import { canManage, canChangeStructure } from './permissions';

describe('passwords and permissions', () => {
  it('salts hashes and rejects incorrect passwords', async () => {
    const a = await hashPassword('Test!Password123');
    const b = await hashPassword('Test!Password123');
    expect(a).not.toBe(b); expect(a).not.toContain('Test!Password123');
    expect(await verifyPassword('Test!Password123', a)).toBe(true);
    expect(await verifyPassword('wrong', a)).toBe(false);
    expect(await verifyPassword('wrong', 'invalid')).toBe(false);
  });
  it('denies ownership bypass and inactive users', () => {
    expect(canManage({ id: 'a', role: 'USER', active: true }, 'b')).toBe(false);
    expect(canManage({ id: 'a', role: 'USER', active: true }, 'a')).toBe(true);
    expect(canManage({ id: 'a', role: 'ADMIN', active: true }, 'b')).toBe(true);
    expect(canManage({ id: 'a', role: 'ADMIN', active: false }, 'b')).toBe(false);
  });
  it('locks structure permanently after publication', () => {
    expect(canChangeStructure({ publishedAt: null })).toBe(true);
    expect(canChangeStructure({ publishedAt: new Date() })).toBe(false);
  });
});
