import { Module } from '@nestjs/common';
import { LoggerModule } from 'nestjs-pino';
import { ConfigService } from '@nestjs/config';
import { randomBytes } from 'crypto';

@Module({
  imports: [
    LoggerModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => ({
        pinoHttp: {
          name: configService.get<string>('APP_NAME') || 'Wallet Primitive',
          level:
            configService.get<string>('NODE_ENV') === 'production'
              ? 'info'
              : 'debug',
          genReqId: () => randomBytes(12).toString('hex'),
          transport: {
            targets: [
              {
                target: 'pino-pretty',
                level: 'debug',
                options: {
                  colorize: true,
                  ignore: 'req.headers,res.headers',
                },
              },
              {
                target: 'pino/file',
                level: 'debug',
                options: {
                  destination: './logs/app.log',
                  mkdir: true,
                },
              },
              {
                target: 'pino/file',
                level: 'error',
                options: {
                  destination: './logs/app-error.log',
                  mkdir: true,
                },
              },
            ],
          },
        },
      }),
    }),
  ],
  exports: [LoggerModule],
})
export class AppLoggerModule {}
