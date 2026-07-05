import { Module } from '@nestjs/common';
import { WorkspacesService } from './workspaces.service';
import { WorkspacesController } from './workspaces.controller';
import { EmailModule } from '@infrastructure/email/email.module';
import { WebhooksModule } from '../webhooks/webhooks.module';

@Module({
  imports: [EmailModule, WebhooksModule],
  controllers: [WorkspacesController],
  providers: [WorkspacesService],
  exports: [WorkspacesService],
})
export class WorkspacesModule {}
