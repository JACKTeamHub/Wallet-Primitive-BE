import { Controller, Get } from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';

@ApiTags('health')
@Controller()
export class AppController {
  @Get()
  @ApiOperation({ summary: 'API Health Check' })
  @ApiResponse({ status: 200, description: 'Health check OK' })
  getHealth() {
    return {
      status: 'OK',
      message: "I don't know how you got here, but yeah, congrats",
      timestamp: new Date().toISOString(),
    };
  }
}
