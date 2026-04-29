// Usage: node scripts/create-user.mjs <email> <password> <displayName>
// Example: node scripts/create-user.mjs zeev@test.com MyPass123 Zeev

import { execSync } from 'child_process';
import { readFileSync } from 'fs';
import { createRequire } from 'module';

const [,, email, password, displayName] = process.argv;

if (!email || !password) {
  console.error('Usage: node scripts/create-user.mjs <email> <password> [displayName]');
  process.exit(1);
}

// Load DATABASE_URL from .env
const env = Object.fromEntries(
  readFileSync(new URL('../.env', import.meta.url), 'utf8')
    .split('\n')
    .filter(l => l.includes('=') && !l.startsWith('#'))
    .map(l => l.split('=').map(p => p.trim()))
);

process.env.DATABASE_URL = env.DATABASE_URL;
process.env.JWT_SECRET = env.JWT_SECRET ?? 'dev-secret-32-characters-minimum!!';

// Run via tsx so we can use the TypeScript source directly
try {
  const result = execSync(
    `npx tsx -e "
import bcrypt from 'bcryptjs';
import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();
const hash = await bcrypt.hash('${password.replace(/'/g, "\\'")}', 12);
const user = await prisma.user.create({
  data: { email: '${email}', passwordHash: hash, displayName: '${displayName ?? ''}' },
  select: { id: true, email: true, displayName: true }
});
import jwt from 'jsonwebtoken';
const token = jwt.sign({ sub: user.id, email: user.email }, process.env.JWT_SECRET, { expiresIn: '7d' });
console.log(JSON.stringify({ user, token }, null, 2));
await prisma.\\$disconnect();
"`,
    { cwd: new URL('..', import.meta.url).pathname, env: { ...process.env }, encoding: 'utf8' }
  );
  console.log(result);
} catch (e) {
  console.error(e.stderr ?? e.message);
  process.exit(1);
}
