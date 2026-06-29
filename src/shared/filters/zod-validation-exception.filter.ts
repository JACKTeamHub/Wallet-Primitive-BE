import { ArgumentsHost, Catch, ExceptionFilter, HttpStatus } from '@nestjs/common';
import { ZodValidationException } from 'nestjs-zod';
import { Response } from 'express';

@Catch(ZodValidationException)
export class ZodValidationExceptionFilter implements ExceptionFilter {
  catch(exception: ZodValidationException, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();
    const status = HttpStatus.BAD_REQUEST;

    const errorResponse = {
      statusCode: status,
      message: 'Validation failed',
      errors: (exception.getZodError() as any).errors.map((err: any) => ({
        path: Array.isArray(err.path) ? err.path.join('.') : String(err.path),
        message: err.message,
      })),
      path: request.url,
      timestamp: new Date().toISOString(),
    };

    response.status(status).json(errorResponse);
  }
}
