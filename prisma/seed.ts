import { PrismaClient, Role } from '@prisma/client';
import * as bcrypt from 'bcrypt';
import * as dotenv from 'dotenv';
dotenv.config();

const prisma = new PrismaClient();

async function main() {
  console.log('Starting seeding...');

  const adminPhone = process.env.ADMIN_PHONE || '+62833333333';
  const adminPassword = process.env.ADMIN_PASSWORD || '123456';
  const hackerPhone = process.env.HACKER_PHONE || '+62822222222';
  const hackerPassword = process.env.HACKER_PASSWORD || '123456';

  const hashedAdminPassword = await bcrypt.hash(adminPassword, 10);
  const hashedHackerPassword = await bcrypt.hash(hackerPassword, 10);

  await prisma.user.upsert({
    where: { phone: adminPhone },
    update: { password: hashedAdminPassword, isVerified: true },
    create: {
      username: 'System Administrator',
      phone: adminPhone,
      password: hashedAdminPassword,
      role: Role.ADMIN,
      publicKey: 'SYSTEM_ADMIN_KEY_PLACEHOLDER',
      isVerified: true,
    },
  });

  await prisma.user.upsert({
    where: { phone: hackerPhone },
    update: { password: hashedHackerPassword, isVerified: true },
    create: {
      username: 'Anonymous Hacker',
      phone: hackerPhone,
      password: hashedHackerPassword,
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
