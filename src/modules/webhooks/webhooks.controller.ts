import { Controller, Post, Body, Headers, HttpCode, HttpStatus, Req } from '@nestjs/common';
import { WebhooksService } from './webhooks.service';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';

@ApiTags('webhooks')
@Controller('webhooks')
export class WebhooksController {
  constructor(private readonly webhooksService: WebhooksService) { }

  @Post('nomba')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Receive incoming webhook events from Nomba' })
  @ApiResponse({ status: 200, description: 'Webhook processed successfully' })
  async handleWebhook(
    @Body() payload: any,
    @Req() req: any,
    @Headers('x-nomba-signature') signature?: string,
  ) {
    const rawBody = req.rawBody || '';
    return this.webhooksService.handleNombaWebhook(payload, rawBody, signature);
  }
}
