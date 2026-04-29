// Create a user directly via Prisma. Run with:
//   npm run create:user -- <email> <password> [displayName] [phoneE164]
// Example:
//   npm run create:user -- zeev@test.com Moshe472472 Zeev

import bcrypt from 'bcryptjs';
import { prisma } from '../src/lib/prisma';
import { env } from '../src/lib/env';
import { signToken } from '../src/lib/jwt';

async function main() {
  const [, , email, password, displayName, phoneE164] = process.argv;

  if (!email || !password) {
    console.error('Usage: npm run create:user -- <email> <password> [displayName] [phoneE164]');
    process.exit(1);
  }

  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) {
    console.error(`User ${email} already exists (id=${existing.id})`);
    process.exit(1);
  }

  const passwordHash = await bcrypt.hash(password, env.BCRYPT_ROUNDS);
  const user = await prisma.user.create({
    data: { email, passwordHash, displayName: displayName ?? null, phoneE164: phoneE164 ?? null },
    select: { id: true, email: true, displayName: true, phoneE164: true },
  });

  const token = signToken({ sub: user.id, email: user.email });

  console.log('\n✅ User created:\n');
  console.log(JSON.stringify({ user, token }, null, 2));
  console.log(
    '\nLogin in the mobile app with this email + password, or use the token above for direct API calls.\n',
  );
}

main()
  .catch((err) => {
    console.error('Failed to create user:', err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
