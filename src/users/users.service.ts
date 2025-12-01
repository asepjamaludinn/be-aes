import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../database/database.service';
import { RegisterDto } from './dto/register.dto';

@Injectable()
export class UsersService {
  constructor(private prisma: PrismaService) {}

  async register(data: RegisterDto) {
    const existingUser = await this.prisma.user.findUnique({
      where: { phone: data.phone },
    });

    if (existingUser) {
      console.log(`Login existing user: ${existingUser.username}`);
      return this.prisma.user.update({
        where: { phone: data.phone },
        data: {
          publicKey: data.publicKey,
          username: data.username,
        },
      });
    }

    console.log(`Registering new user: ${data.username}`);
    return this.prisma.user.create({
      data: {
        phone: data.phone,
        username: data.username,
        publicKey: data.publicKey,
        role: 'USER',
      },
    });
  }

  async getPublicKey(id: string) {
    const user = await this.prisma.user.findUnique({
      where: { id },
      select: { id: true, username: true, publicKey: true },
    });

    if (!user) throw new NotFoundException('User not found');
    return user;
  }

  async getAllUsers() {
    return this.prisma.user.findMany({
      select: {
        id: true,
        username: true,
        phone: true,
        publicKey: true,
        role: true,
      },
    });
  }
}
