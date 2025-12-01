import { Controller, Get, Post, Body, Param } from '@nestjs/common';
import { UsersService } from './users.service';
import { RegisterDto } from './dto/register.dto';

@Controller('api/users')
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Post('register')
  async register(@Body() body: RegisterDto) {
    return this.usersService.register(body);
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
