import { ExceptionFilter, Catch, ArgumentsHost, HttpException, HttpStatus } from '@nestjs/common';
import { Response } from 'express';

@Catch()
export class HttpExceptionFilter implements ExceptionFilter {
  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();

    let status = HttpStatus.INTERNAL_SERVER_ERROR;
    let message = 'Internal server error';
    let lastSuccess: unknown = undefined;
    let diagnostics: unknown = undefined;

    // NestJS HttpException turlari uchun
    if (exception instanceof HttpException) {
      status = exception.getStatus();
      const res = exception.getResponse();

      if (typeof res === 'string') {
        message = res;
      } else if (typeof res === 'object') {
        message = (res as any).message || (res as any).error || message;
        if (status === 502) {
          lastSuccess = (res as any).last_success;
          diagnostics = (res as any).diagnostics;
        }
      }
    }
    // Oddiy Error uchun (masalan throw new Error('Nimadir noto‘g‘ri');)
    else if (exception instanceof Error) {
      message = exception.message;
    }

    response.status(status).json({
      success: false,
      message,
      statusCode: status,
      ...(lastSuccess !== undefined ? { last_success: lastSuccess } : {}),
      ...(diagnostics !== undefined ? { diagnostics } : {}),
    });
  }
}
