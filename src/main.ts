import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { Logger } from 'nestjs-pino';
import helmet from 'helmet';
import { json, urlencoded } from 'express';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { ConfigService } from '@nestjs/config';
import { ZodValidationExceptionFilter } from './shared/filters/zod-validation-exception.filter';
import { HttpExceptionFilter } from './shared/filters/http-exception.filter';

async function bootstrap() {
  const app = await NestFactory.create(AppModule, { bufferLogs: true });

  // Use nestjs-pino as global logger
  const logger = app.get(Logger);
  app.useLogger(logger);

  // Set global API prefix with versioning, excluding root path for health check
  app.setGlobalPrefix('api/v1', {
    exclude: ['/'],
  });

  // Preserve raw body for signature verification
  app.use(
    json({
      verify: (req: any, res, buf) => {
        req.rawBody = buf.toString();
      },
    }),
  );
  app.use(urlencoded({ extended: true, limit: '10mb' }));

  // Security headers
  app.use(helmet());

  // Global exception filters
  app.useGlobalFilters(
    new ZodValidationExceptionFilter(),
    new HttpExceptionFilter(logger),
  );

  // Config setup
  const configService = app.get(ConfigService);
  const appName = configService.get<string>('APP_NAME') || 'nomba-be';
  const port = configService.get<number>('PORT') || 9999;

  // Swagger setup
  const swaggerConfig = new DocumentBuilder()
    .setTitle(appName)
    .setDescription(`The API documentation for ${appName}`)
    .setVersion('1.0')
    .addBearerAuth()
    .build();
  const document = SwaggerModule.createDocument(app, swaggerConfig);
  SwaggerModule.setup('api', app, document);

  await app.listen(port);
  logger.log(`Application is running on: http://localhost:${port}`);
  logger.log(`API documentation available on: http://localhost:${port}/api`);
}
bootstrap();
