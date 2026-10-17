import 'dotenv/config';
import { db } from '../src/lib/db';
import { hashPassword } from '../src/lib/password';
async function main() {
  const username = process.env.ADMIN_USERNAME || 'admin';
  const password = process.env.ADMIN_PASSWORD || '';
  if (password.length < 8) throw new Error('请配置 ADMIN_PASSWORD，至少 8 位；不会生成默认密码。');
  const exists = await db.user.findUnique({ where: { username } });
  if (exists) { console.log('管理员账号已存在，密码未修改。'); return; }
  await db.user.create({ data: { username, name: process.env.ADMIN_NAME || '管理员', passwordHash: await hashPassword(password), role: 'ADMIN' } });
  console.log('管理员已创建。');
}
main().catch(e => { console.error(e.message); process.exitCode = 1; }).finally(() => db.$disconnect());
