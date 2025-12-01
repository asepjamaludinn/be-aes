import { PrismaClient, Role } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Starting seeding...');

  const adminPhone = '+62833333333';
  const admin = await prisma.user.upsert({
    where: { phone: adminPhone },
    update: {},
    create: {
      username: 'System Administrator',
      phone: adminPhone,
      role: Role.ADMIN,
      publicKey: 'SYSTEM_ADMIN_KEY_PLACEHOLDER',
    },
  });
  console.log(`Admin created: ${admin.username} (${admin.role})`);

  const hackerPhone = '+62822222222';
  const hacker = await prisma.user.upsert({
    where: { phone: hackerPhone },
    update: {},
    create: {
      username: 'Anonymous Hacker',
      phone: hackerPhone,
      role: Role.HACKER,
      publicKey: 'HACKER_KEY_PLACEHOLDER',
    },
  });
  console.log(`Hacker created: ${hacker.username} (${hacker.role})`);

  const userPhone = '+62811111111';
  const normalUser = await prisma.user.upsert({
    where: { phone: userPhone },
    update: {},
    create: {
      username: 'Normal User A',
      phone: userPhone,
      role: Role.USER,
      publicKey: null,
    },
  });
  console.log(`✅ User created: ${normalUser.username} (${normalUser.role})`);
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
