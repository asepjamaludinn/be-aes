import { PrismaClient, Role } from '@prisma/client';
import * as bcrypt from 'bcrypt';

const prisma = new PrismaClient();

async function main() {
  console.log('Starting seeding...');

  const hashedPassword = await bcrypt.hash('123456', 10);

  const adminPhone = '+62833333333';
  await prisma.user.upsert({
    where: { phone: adminPhone },
    update: { isVerified: true },
    create: {
      username: 'System Administrator',
      phone: adminPhone,
      password: hashedPassword,
      role: Role.ADMIN,
      publicKey: 'SYSTEM_ADMIN_KEY_PLACEHOLDER',
      isVerified: true,
    },
  });

  const hackerPhone = '+62822222222';
  await prisma.user.upsert({
    where: { phone: hackerPhone },
    update: { isVerified: true },
    create: {
      username: 'Anonymous Hacker',
      phone: hackerPhone,
      password: hashedPassword,
      role: Role.HACKER,
      publicKey: 'HACKER_KEY_PLACEHOLDER',
      isVerified: true,
    },
  });

  console.log('Seeding done.');
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (e) => {
    console.error(e);
    await prisma.$disconnect();
    process.exit(1);
  });
