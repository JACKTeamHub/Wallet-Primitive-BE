import {
  Controller,
  Post,
  Body,
  Headers,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { WebhooksService } from './webhooks.service';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';

@ApiTags('webhooks')
@Controller('webhook')
export class WebhooksController {
  constructor(private readonly webhooksService: WebhooksService) {}

  @Post('nomba')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Receive incoming webhook events from Nomba' })
  @ApiResponse({ status: 200, description: 'Webhook processed successfully' })
  async handleWebhook(
    @Body() payload: Record<string, any>,
    @Headers() headers: Record<string, string>,
  ) {
    return this.webhooksService.handleNombaWebhook(payload, headers);
  }
}
