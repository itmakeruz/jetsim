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
    const sensitiveFields = [
      'password',
      'token',
      'accessToken',
      'refreshToken',
      'secret',
      'confirm_code',
      'confirmation_code',
      'new_password',
      'confirm_password',
      'reset_token',
      'current_password',
      'new_password',
    ];
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

  private formatLog(context: ExecutionContext, statusCode: number, elapsed: number, error?: any): string {
    const request = context.switchToHttp().getRequest<Request>();
    const { method, url, params, query, body, ip, headers } = request;

    let logLine =
      `| ${method} ${url}` +
      ` | status=${statusCode}` +
      ` | elapsed=${elapsed}ms` +
      ` | ip=${ip}` +
      ` | ua="${headers['user-agent'] || 'unknown'}"` +
      ` | params=${JSON.stringify(this.sanitizeData(params))}` +
      ` | query=${JSON.stringify(this.sanitizeData(query))}` +
      ` | body=${JSON.stringify(this.sanitizeData(body))}`;

    if (error) {
      logLine +=
        ` | error="${error.message}"` +
        ` | stack=${error.stack || 'no stack trace'}` +
        ` | details=${JSON.stringify(error.response || null)}`;
    }

    return logLine;
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

        this.logger.info(logData); // endi string ketadi
      }),
      catchError((error) => {
        const elapsed = Date.now() - now;
        const responseError = error.response || {};
        const statusCode = responseError.statusCode || error.status || 500;
        const logData = this.formatLog(context, statusCode, elapsed, error);

        if (statusCode >= 500) {
          this.logger.error(logData);
        } else if (statusCode >= 400) {
          this.logger.warn(logData);
        } else {
          this.logger.error(logData);
        }

        throw error;
      }),
    );
  }
}
