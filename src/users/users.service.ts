import {
  Injectable,
  NotFoundException,
  UnauthorizedException,
  Logger,
  BadRequestException,
  ForbiddenException,
} from '@nestjs/common';
import { PrismaService } from '../database/database.service';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { VerifyOtpDto } from './dto/verify-otp.dto';
import * as bcrypt from 'bcrypt';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class UsersService {
  private readonly logger = new Logger(UsersService.name);
  private supabase: SupabaseClient;

  constructor(
    private prisma: PrismaService,
    private jwtService: JwtService,
    private configService: ConfigService,
  ) {
    this.supabase = createClient(
      this.configService.get<string>('SUPABASE_URL') || '',
      this.configService.get<string>('SUPABASE_KEY') || '',
    );
  }

  async register(data: RegisterDto) {
    const existing = await this.prisma.user.findUnique({
      where: { phone: data.phone },
    });

    if (existing && existing.isVerified) {
      throw new BadRequestException(
        'Phone number already registered and verified.',
      );
    }

    const hashedPassword = await bcrypt.hash(data.password, 10);

    const otpCode = Math.floor(1000 + Math.random() * 9000).toString();

    const otpExpiresAt = new Date(Date.now() + 5 * 60 * 1000);

    this.logger.warn(
      `[MOCK SMS] OTP untuk ${data.phone}: ${otpCode} (Expires in 5 mins)`,
    );

    if (existing && !existing.isVerified) {
      await this.prisma.user.update({
        where: { id: existing.id },
        data: {
          username: data.username,
          password: hashedPassword,
          publicKey: data.publicKey,
          otpCode: otpCode,
          otpExpiresAt: otpExpiresAt,
        },
      });
    } else {
      await this.prisma.user.create({
        data: {
          phone: data.phone,
          username: data.username,
          password: hashedPassword,
          publicKey: data.publicKey,
          role: 'USER',
          otpCode: otpCode,
          otpExpiresAt: otpExpiresAt,
          isVerified: false,
        },
      });
    }
    return { message: 'OTP sent. Valid for 5 minutes.' };
  }

  async verifyOtp(data: VerifyOtpDto) {
    const user = await this.prisma.user.findUnique({
      where: { phone: data.phone },
    });

    if (!user) throw new NotFoundException('User not found');
    if (user.isVerified) return { message: 'Account already verified.' };

    if (user.otpCode !== data.otp) {
      throw new BadRequestException('Invalid OTP Code.');
    }

    if (!user.otpExpiresAt || user.otpExpiresAt < new Date()) {
      throw new BadRequestException(
        'OTP has expired. Please register again to get a new code.',
      );
    }

    await this.prisma.user.update({
      where: { id: user.id },
      data: {
        isVerified: true,
        otpCode: null,
        otpExpiresAt: null,
      },
    });

    this.logger.log(`User Verified: ${user.username}`);
    return { message: 'Account verified successfully' };
  }

  async login(data: LoginDto) {
    const user = await this.prisma.user.findUnique({
      where: { phone: data.phone },
    });
    if (!user) throw new NotFoundException('User not found');
    if (!user.isVerified)
      throw new UnauthorizedException('Account not verified.');

    const isMatch = await bcrypt.compare(data.password, user.password);
    if (!isMatch) throw new UnauthorizedException('Wrong password');

    const updatedUser = await this.prisma.user.update({
      where: { id: user.id },
      data: { publicKey: data.publicKey },
    });

    const payload = { sub: user.id, username: user.username, role: user.role };
    const accessToken = this.jwtService.sign(payload);

    this.logger.log(`User logged in: ${user.username}`);

    const { password, otpCode, otpExpiresAt, ...safeUser } = updatedUser;

    return {
      ...safeUser,
      access_token: accessToken,
    };
  }

  async searchUser(phone: string) {
    return this.prisma.user.findUnique({
      where: { phone },
      select: {
        id: true,
        username: true,
        phone: true,
        avatarUrl: true,
        publicKey: true,
      },
    });
  }

  async updateUser(
    id: string,
    data: UpdateUserDto,
    file?: Express.Multer.File,
  ) {
    const targetUser = await this.prisma.user.findUnique({ where: { id } });
    if (!targetUser) throw new NotFoundException('User not found');

    let avatarUrl = targetUser.avatarUrl;

    if (file) {
      const fileExt = file.originalname.split('.').pop();
      const fileName = `${id}-${Date.now()}.${fileExt}`;
      const filePath = `public/${fileName}`;

      const { error } = await this.supabase.storage
        .from('avatars')
        .upload(filePath, file.buffer, {
          contentType: file.mimetype,
          upsert: true,
        });

      if (error) {
        this.logger.error(`Supabase Upload Error: ${error.message}`);
        throw new BadRequestException('Failed to upload image');
      }

      const { data: publicData } = this.supabase.storage
        .from('avatars')
        .getPublicUrl(filePath);

      avatarUrl = publicData.publicUrl;
    } else if (data.removeAvatar === 'true') {
      avatarUrl = null;
    }

    const updateData: any = {
      username: data.username,
      avatarUrl: avatarUrl,
    };

    if (data.password) {
      const hashedPassword = await bcrypt.hash(data.password, 10);
      updateData.password = hashedPassword;
    }

    const result = await this.prisma.user.update({
      where: { id },
      data: updateData,
    });

    const { password, otpCode, otpExpiresAt, ...safeResult } = result;
    return safeResult;
  }

  async getAllUsers() {
    return this.prisma.user.findMany({
      select: {
        id: true,
        username: true,
        phone: true,
        role: true,
        createdAt: true,
        isVerified: true,
        avatarUrl: true,
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async deleteUser(targetId: string, requesterId: string) {
    if (!requesterId) throw new UnauthorizedException('Requester ID required.');

    const requester = await this.prisma.user.findUnique({
      where: { id: requesterId },
    });
    if (!requester || requester.role !== 'ADMIN') {
      throw new ForbiddenException('Only ADMIN can delete users!');
    }
    if (targetId === requesterId)
      throw new BadRequestException('Cannot delete yourself.');

    await this.prisma.message.deleteMany({
      where: { OR: [{ senderId: targetId }, { recipientId: targetId }] },
    });

    return this.prisma.user.delete({ where: { id: targetId } });
  }

  async getPublicKey(id: string) {
    const user = await this.prisma.user.findUnique({
      where: { id },
      select: { id: true, publicKey: true, username: true },
    });
    if (!user) throw new NotFoundException('User not found');
    return user;
  }
}
