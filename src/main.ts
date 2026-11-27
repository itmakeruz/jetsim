import { APP_PORT, DOCS_PASS, DOCS_USER, LOGS_PASS, LOGS_USER } from './config';
import { AppModule } from './app.module';
import { NestFactory } from '@nestjs/core';
import { globalHeaderParametrs } from '@enums';
import { WinstonLoggerService } from '@logger';
import * as basicAuth from 'express-basic-auth';
import { LoggingInterceptor } from '@interceptors';
import { ValidationPipe, VersioningType } from '@nestjs/common';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { AllExceptionFilter, HttpExceptionFilter } from '@exceptions';
import { MyLogger } from './logging/logger.service';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  app.getHttpAdapter().getInstance().set('trust proxy', 'loopback');
  app.use((req, res, next) => {
    let decodedPath: string;
    try { decodedPath = decodeURIComponent(req.path); } catch { return res.sendStatus(400); }
    if (/^\/uploads\/qr(?:\/|$)/i.test(require('path').posix.normalize(decodedPath))) return res.sendStatus(404);
    if (decodedPath.startsWith('/uploads/')) { res.setHeader('Content-Security-Policy', "default-src 'none'; sandbox"); }
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
    next();
  });
  const logger = app.get(WinstonLoggerService);
  app.useGlobalInterceptors(new LoggingInterceptor(logger));
  app.useLogger(logger);

  app.enableCors({
    origin: (process.env.CORS_ORIGINS || 'https://jetsim.ru,https://admin.jetsim.ru').split(',').map(s => s.trim()).filter(Boolean),
    methods: 'GET,HEAD,PUT,PATCH,POST,DELETE',
    credentials: true,
  });

  app.enableVersioning({
    type: VersioningType.URI,
    prefix: 'api/v',
  });

  app.useGlobalPipes(
    new ValidationPipe({
      transform: true,
      whitelist: true,
      transformOptions: {
        enableImplicitConversion: true,
      },
    }),
  );

  app.useGlobalFilters(new AllExceptionFilter());
  app.useGlobalFilters(new HttpExceptionFilter());

  if (DOCS_USER && DOCS_PASS) {
    app.use('/docs', basicAuth({ challenge: true, users: { [DOCS_USER]: DOCS_PASS } }));

    const config = new DocumentBuilder()
      .setTitle('Jetsim API')
      .setDescription('The Jetsim API description')
      .setVersion('1.0')
      .addBearerAuth({
        type: 'http',
        scheme: 'bearer',
        bearerFormat: 'JWT',
      })
      .addGlobalParameters(...globalHeaderParametrs)
      .build();

    const document = SwaggerModule.createDocument(app, config);
    SwaggerModule.setup('docs', app, document);
  } else {
    logger.warn('Swagger /docs не смонтирован: не заданы DOCS_USER и DOCS_PASS');
  }

  if (LOGS_USER && LOGS_PASS) {
    app.use('/logs', basicAuth({ challenge: true, users: { [LOGS_USER]: LOGS_PASS } }));
  } else {
    // Без учётных данных дашборд логов закрываем полностью, а не оставляем открытым
    app.use('/logs', (_req, res) => res.sendStatus(404));
    logger.warn('Дашборд /logs отключён: не заданы LOGS_USER и LOGS_PASS');
  }

  await app.listen(APP_PORT);
}
bootstrap();
