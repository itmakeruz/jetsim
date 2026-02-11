import { Injectable, LoggerService, LogLevel, OnModuleInit } from '@nestjs/common';
import { functionname } from './throw-stack';
import { AsyncLocalStorage } from 'async_hooks';
import { appendFileSync, existsSync, mkdirSync } from 'fs';
import { join } from 'path';

@Injectable()
export class MyLogger implements LoggerService {
  constructor(private als: AsyncLocalStorage<Map<string, string>>) {}

  log(message: any) {
    let store = this.als.getStore();
    let logString = '';
    let path = store?.get('path');
    let route = store?.get('route');
    let method = store?.get('method');
    let user_uuid = store?.get('user_uuid');
    let class_controller = store?.get('class_controller');

    if (typeof message == 'object') {
      logString = JSON.stringify(
        {
          timestamp: new Date().toLocaleString('ru'),
          path,
          route,
          method,
          user_uuid,
          class_controller,
          log: message,
          functions: functionname(),
          traceId: store?.get('traceId'),
        },
        (key, value) => (typeof value == 'bigint' ? Number(value) : value),
      );
    } else {
      logString = JSON.stringify({
        timestamp: new Date().toLocaleString('ru'),
        path,
        route,
        method,
        user_uuid,
        class_controller,
        log: message,
        functions: functionname(),
        traceId: store?.get('traceId'),
      });
    }

    if (path == '/log/backend') return;

    console.log(
      JSON.stringify(
        {
          log: message,
          traceId: store?.get('traceId'),
        },
        null,
        2,
      ),
    );

    let d = new Date();
    let year = d.getFullYear();
    let month = d.getMonth() + 1;
    let day = d.getDate().toString().padStart(2, '0');
    let hour = d.getHours();

    if (!existsSync(`logs/logs/${year}/${month}/${day}`)) {
      mkdirSync(`logs/logs/${year}/${month}/${day}`, { recursive: true });
    }

    appendFileSync(
      join(process.cwd(), `logs/logs/${year}/${month}/${day}/${hour}_${day}-${month}-${year}.log`),
      logString + '\n',
    );
  }

  error(message: any) {
    let store = this.als.getStore();

    let logString = '';
    let path = store?.get('path');
    let route = store?.get('route');
    let method = store?.get('method');
    let user_uuid = store?.get('user_uuid');
    let class_controller = store?.get('class_controller');

    if (typeof message == 'object') {
      logString = JSON.stringify(
        {
          timestamp: new Date().toLocaleString('ru'),
          path,
          route,
          method,
          user_uuid,
          class_controller,
          errorlog: message,
          functions: functionname(),
          traceId: store?.get('traceId'),
        },
        (key, value) => (typeof value == 'bigint' ? Number(value) : value),
      );
    } else {
      logString = JSON.stringify({
        timestamp: new Date().toLocaleString('ru'),
        path,
        route,
        method,
        user_uuid,
        class_controller,
        errorlog: message,
        functions: functionname(),
        traceId: store?.get('traceId'),
      });
    }

    if (path == '/log/backend') return;
    console.error(
      JSON.stringify(
        {
          log: message,
          traceId: store?.get('traceId'),
        },
        null,
        2,
      ),
    );

    let d = new Date();
    let year = d.getFullYear();
    let month = d.getMonth() + 1;
    let day = d.getDate().toString().padStart(2, '0');
    let hour = d.getHours();

    if (!existsSync(`logs/logs/${year}/${month}/${day}`)) {
      mkdirSync(`logs/logs/${year}/${month}/${day}`, { recursive: true });
    }
    appendFileSync(
      join(process.cwd(), `logs/logs/${year}/${month}/${day}/${hour}_${day}-${month}-${year}.log`),
      logString + '\n',
    );
  }

  warn(message: any, ...optionalParams: any[]) {
    console.log('Method not implemented.');
  }

  debug?(message: any, ...optionalParams: any[]) {
    console.log('Method not implemented.');
  }

  verbose?(message: any, ...optionalParams: any[]) {
    console.log('Method not implemented.');
  }

  fatal?(message: any, ...optionalParams: any[]) {
    console.log('Method not implemented.');
  }

  setLogLevels?(levels: LogLevel[]) {
    console.log('Method not implemented.');
  }
}
