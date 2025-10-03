import { createLogger, format, transports, Logger } from 'winston';
import 'winston-daily-rotate-file';
import { Injectable } from '@nestjs/common';

@Injectable()
export class WinstonLoggerService {
  private readonly logger: Logger;

  constructor() {
    this.logger = createLogger({
      level: process.env.LOG_LEVEL || 'info',
      format: format.combine(
        format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
        format.printf(({ timestamp, level, message }) => {
          return `[${timestamp}] ${level.toUpperCase()}: ${message}`;
        }),
      ),
      transports: [
        new transports.Console({
          format: format.combine(
            format.colorize(),
            format.printf(({ timestamp, level, message }) => {
              return `[${timestamp}] ${level}: ${message}`;
            }),
          ),
        }),
        new transports.DailyRotateFile({
          filename: 'logs/application-%DATE%.log',
          datePattern: 'YYYY-MM-DD',
          zippedArchive: true,
          maxSize: '20m',
          maxFiles: 10,
          format: format.combine(
            format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
            format.printf(({ timestamp, level, message }) => {
              return `[${timestamp}] ${level.toUpperCase()}: ${message}`;
            }),
          ),
        }),
      ],
    });
  }

  info(message: string, error?: any) {
    this.logger.info(message, error);
  }

  error(message: string) {
    this.logger.error(message);
  }

  warn(message: string) {
    this.logger.warn(message);
  }

  debug(message: string) {
    this.logger.debug(message);
  }

  verbose(message: string) {
    this.logger.verbose(message);
  }

  log(message: string, meta?: any) {
    if (meta) {
      this.logger.info(`${message} ${JSON.stringify(meta)}`);
    } else {
      this.logger.info(message);
    }
  }

  errorLegacy(message: string, trace?: string) {
    this.error(`${message} | trace=${trace || ''}`);
  }

  warnLegacy(message: string, trace?: string) {
    this.warn(`${message} | trace=${trace || ''}`);
  }
}
