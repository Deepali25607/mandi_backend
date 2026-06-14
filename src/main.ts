import { ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import { json, urlencoded } from 'express';
import { AppModule } from './app.module';

async function bootstrap() {
  // Disable the built-in body parser so we can raise the size limit — base64
  // image uploads (login background, org wallpaper) exceed the 100 kB default.
  const app = await NestFactory.create(AppModule, { bodyParser: false });
  app.use(json({ limit: '10mb' }));
  app.use(urlencoded({ extended: true, limit: '10mb' }));

  const config = app.get(ConfigService);

  // All routes are served under /api so the frontend has a clean namespace.
  app.setGlobalPrefix('api');

  app.enableCors({
    origin: config.get<string>('CORS_ORIGIN', 'http://localhost:5173'),
    credentials: true,
  });

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
      forbidNonWhitelisted: true,
    }),
  );

  const port = Number(config.get('PORT', 5000));
  // Bind to 0.0.0.0 so hosting platforms (Render, etc.) can detect the open port.
  await app.listen(port, '0.0.0.0');
  // eslint-disable-next-line no-console
  console.log(`Mandi ERP API listening on port ${port} (/api)`);
}

bootstrap();
