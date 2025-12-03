import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Query,
  Delete,
  Patch,
  NotFoundException,
  Headers,
  UseInterceptors,
  UploadedFile,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { UsersService } from './users.service';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { VerifyOtpDto } from './dto/verify-otp.dto';

@Controller('api/users')
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Post('register')
  async register(@Body() body: RegisterDto) {
    return this.usersService.register(body);
  }

  @Post('verify-otp')
  async verifyOtp(@Body() body: VerifyOtpDto) {
    return this.usersService.verifyOtp(body);
  }

  @Post('login')
  async login(@Body() body: LoginDto) {
    return this.usersService.login(body);
  }

  @Get('search')
  async searchUser(@Query('phone') phone: string) {
    const user = await this.usersService.searchUser(phone);
    if (!user) throw new NotFoundException('User not found');
    return user;
  }

  @Patch(':id')
  @UseInterceptors(FileInterceptor('file'))
  async updateUser(
    @Param('id') id: string,
    @Body() body: UpdateUserDto,
    @UploadedFile() file: Express.Multer.File,
  ) {
    return this.usersService.updateUser(id, body, file);
  }

  @Delete(':id')
  async deleteUser(
    @Param('id') targetId: string,
    @Headers('x-user-id') requesterId: string,
  ) {
    return this.usersService.deleteUser(targetId, requesterId);
  }

  @Get(':id/key')
  async getPublicKey(@Param('id') id: string) {
    return this.usersService.getPublicKey(id);
  }

  @Get()
  async getAllUsers() {
    return this.usersService.getAllUsers();
  }
}
