import { Injectable, NotFoundException, Logger } from '@nestjs/common';
import { PrismaService } from '../database/database.service';
import { RegisterDto } from './dto/register.dto';

@Injectable()
export class UsersService {
  private readonly logger = new Logger(UsersService.name);
  constructor(private prisma: PrismaService) {}

  async register(data: RegisterDto) {
    const existingUser = await this.prisma.user.findUnique({
      where: { phone: data.phone },
    });

    if (existingUser) {
      this.logger.log(`Login existing user: ${existingUser.username}`);
      return this.prisma.user.update({
        where: { phone: data.phone },
        data: {
          publicKey: data.publicKey,
          username: data.username,
        },
      });
    }

    this.logger.log(`Registering new user: ${data.username}`);
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
