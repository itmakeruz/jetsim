import { createLogger, format, transports, Logger } from 'winston';
import 'winston-daily-rotate-file';
import { Injectable } from '@nestjs/common';

@Injectable()
export class WinstonLoggerService {
  private readonly logger: Logger;

  constructor() {
    this.logger = createLogger({
      level: process.env.LOG_LEVEL || 'info',
      format: format.combine(format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }), format.json()),
      transports: [
        new transports.Console({
          format: format.combine(
            format.colorize(),
            format.printf(
              ({ timestamp, level, message, ...meta }) =>
                `[${timestamp}] ${level}: ${message}\n${JSON.stringify(meta, null, 2)}`,
            ),
          ),
        }),
        new transports.DailyRotateFile({
          filename: 'logs/application-%DATE%.log',
          datePattern: 'YYYY-MM-DD',
          zippedArchive: true,
          maxSize: '20m',
          maxFiles: 10,
          format: format.combine(format.json(), format.prettyPrint()),
        }),
      ],
    });
  }

  info(message: string, meta?: any) {
    this.logger.info(message, meta);
  }

  error(message: string, meta?: any) {
    this.logger.error(message, meta);
  }

  warn(message: string, meta?: any) {
    this.logger.warn(message, meta);
  }

  debug(message: string, meta?: any) {
    this.logger.debug(message, meta);
  }

  verbose(message: string, meta?: any) {
    this.logger.verbose(message, meta);
  }

  log(message: string, meta?: any) {
    this.info(message, meta);
  }

  errorLegacy(message: string, trace?: string) {
    this.error(message, { trace });
  }

  warnLegacy(message: string, trace?: string) {
    this.warn(message, { trace });
  }
}
