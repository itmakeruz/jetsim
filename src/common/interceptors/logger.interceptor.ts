import { Response, Request } from 'express';
import { Observable } from 'rxjs';
import { catchError, tap } from 'rxjs/operators';
import { Injectable, NestInterceptor, ExecutionContext, CallHandler } from '@nestjs/common';
import { WinstonLoggerService } from '@logger';

@Injectable()
export class LoggingInterceptor implements NestInterceptor {
  constructor(private readonly logger: WinstonLoggerService) {}

  private sanitizeData(data: any): any {
    if (!data || typeof data !== 'object') return data;

    const sensitiveFields = ['password', 'token', 'accessToken', 'refreshToken', 'secret'];
    const sanitized = { ...data };

    for (const key of Object.keys(sanitized)) {
      if (sensitiveFields.some((field) => key.toLowerCase().includes(field))) {
        sanitized[key] = '[REDACTED]';
      } else if (typeof sanitized[key] === 'object') {
        sanitized[key] = this.sanitizeData(sanitized[key]);
      }
    }

    return sanitized;
  }

  private formatLog(context: ExecutionContext, statusCode: number, elapsed: number, error?: any) {
    const request = context.switchToHttp().getRequest<Request>();
    const { method, url, params, query, body, ip, headers } = request;

    const logData = {
      timestamp: new Date().toISOString(),
      method,
      url,
      statusCode,
      elapsedMs: elapsed,
      ip,
      userAgent: headers['user-agent'] || 'unknown',
      params: this.sanitizeData(params),
      query: this.sanitizeData(query),
      body: this.sanitizeData(body),
    };

    if (error) {
      logData['error'] = {
        message: error.message,
        stack: error.stack || 'no stack trace',
        details: error.response || null,
      };
    }

    return logData;
  }

  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const request = context.switchToHttp().getRequest<Request>();
    if (!request || !request.url) {
      return next.handle();
    }

    const now = Date.now();

    return next.handle().pipe(
      tap(() => {
        const response = context.switchToHttp().getResponse<Response>();
        const { statusCode } = response;
        const elapsed = Date.now() - now;
        const logData = this.formatLog(context, statusCode, elapsed);

        this.logger.info('HTTP Request', logData);
      }),
      catchError((error) => {
        const elapsed = Date.now() - now;
        const responseError = error.response || {};
        const statusCode = responseError.statusCode || error.status || 500;
        const logData = this.formatLog(context, statusCode, elapsed, error);

        if (statusCode >= 500) {
          this.logger.error('HTTP Server Error', logData);
        } else if (statusCode >= 400) {
          this.logger.warn('HTTP Client Error', logData);
        } else {
          this.logger.error('HTTP Unknown Error', logData);
        }

        throw error;
      }),
    );
  }
}
