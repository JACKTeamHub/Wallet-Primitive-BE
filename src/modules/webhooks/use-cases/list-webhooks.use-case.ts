import { Injectable } from '@nestjs/common';
import { PrismaService } from '@infrastructure/prisma/prisma.service';
import { ProcessedWebhook } from '@generated/prisma/client';
import { WebhookQueryDto } from '../dto/webhook-query.dto';
import {
  PaginatedResult,
  createPaginatedResponse,
} from '@shared/utils/pagination.util';

@Injectable()
export class ListWebhooksUseCase {
  constructor(private readonly prisma: PrismaService) {}

  async execute(
    workspaceId: string,
    query: WebhookQueryDto,
  ): Promise<PaginatedResult<ProcessedWebhook>> {
    const { page, limit } = query;
    const skip = (page - 1) * limit;

    const [total, data] = await Promise.all([
      this.prisma.processedWebhook.count({
        where: { workspaceId },
      }),
      this.prisma.processedWebhook.findMany({
        where: { workspaceId },
        orderBy: { processedAt: 'desc' },
        skip,
        take: limit,
      }),
    ]);

    return createPaginatedResponse(data, total, page, limit);
  }
}
