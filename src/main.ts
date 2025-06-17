import { NestFactory } from '@nestjs/core';
import { AppModule } from './modules/app.module';
import { ValidationPipe } from '@nestjs/common';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import * as basicAuth from 'express-basic-auth';
import { APP_PORT } from './config';
// import { MyLogger } from './common/logger/logger.service';
// import { ParseFiltersPipe } from './common/pipes/filter-pipe';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  // app.useLogger(new MyLogger())

  app.enableCors({
    origin: '*',
    methods: 'GET,HEAD,PUT,PATCH,POST,DELETE',
    credentials: true,
  });
  // new ParseFiltersPipe(),
  app.useGlobalPipes(
    new ValidationPipe({
      transform: true,
      whitelist: true,
      transformOptions: {
        enableImplicitConversion: true,
      },
    }),
  );

  // app.useGlobalFilters(new AllExceptionFilter)

  app.use(
    '/docs',
    basicAuth({
      challenge: true,
      users: {
        'labbaypay': 'password_labbay',
        '1': '1',
      },
    }),
  );

  const config = new DocumentBuilder()
    .setTitle('Labbay Pay API')
    .setDescription('The Labbay Pay API description')
    .setVersion('1.0')
    .addBearerAuth({
      type: 'http',
      scheme: 'bearer',
      bearerFormat: 'JWT',
    })
    // .addGlobalParameters(...globalHeaderParametrs)
    .build();

  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('docs', app, document);

  await app.listen(APP_PORT ?? 3000);
}
bootstrap();
