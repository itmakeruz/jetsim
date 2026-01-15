import { APP_PORT } from './config';
import { AppModule } from './app.module';
import { ParseFiltersPipe } from '@pipes';
import { NestFactory } from '@nestjs/core';
import { globalHeaderParametrs } from '@enums';
import { WinstonLoggerService } from '@logger';
import * as basicAuth from 'express-basic-auth';
import { LoggingInterceptor } from '@interceptors';
import { ValidationPipe, VersioningType } from '@nestjs/common';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { AllExceptionFilter, HttpExceptionFilter } from '@exceptions';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  const logger = app.get(WinstonLoggerService);
  app.useGlobalInterceptors(new LoggingInterceptor(logger));

  app.enableCors({
    origin: '*',
    methods: 'GET,HEAD,PUT,PATCH,POST,DELETE',
    credentials: true,
  });

  app.enableVersioning({
    type: VersioningType.URI,
    prefix: 'api/v',
  });

  new ParseFiltersPipe(),
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

  app.use(
    '/docs',
    basicAuth({
      challenge: true,
      users: {
        '1': '1',
        'jetsim_esim': 'jetsim_esim',
      },
    }),
  );

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

  await app.listen(APP_PORT);
}
bootstrap();
