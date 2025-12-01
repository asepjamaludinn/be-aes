import { Module } from '@nestjs/common';
import { PrismaModule } from './database/database.module';
import { UsersModule } from './users/users.module';
import { ChatModule } from './chat/chat.module';

@Module({
  imports: [PrismaModule, UsersModule, ChatModule],
  controllers: [],
  providers: [],
})
export class AppModule {}
