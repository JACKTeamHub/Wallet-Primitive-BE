import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '@infrastructure/prisma/prisma.service';

@Injectable()
export class GetWebhookDetailUseCase {
  constructor(private readonly prisma: PrismaService) {}

  async execute(workspaceId: string, webhookId: string) {
    const webhook = await this.prisma.processedWebhook.findFirst({
      where: { id: webhookId, workspaceId },
    });

    if (!webhook) {
      throw new NotFoundException('Processed webhook not found');
    }

    return webhook;
  }
}
