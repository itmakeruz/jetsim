import { plainToInstance } from 'class-transformer';
import { IsPort, IsString, IsNotEmpty, validateSync } from 'class-validator';
import 'dotenv/config';

import { ConfigService } from '@nestjs/config';

export let config = new ConfigService();

class EnvironmentVariables {
  @IsNotEmpty()
  @IsString()
  DATABASE_URL: string;

  @IsNotEmpty()
  @IsPort()
  APP_PORT: string;

  @IsNotEmpty()
  @IsString()
  JWT_ACCESS_SECRET: string;

  @IsNotEmpty()
  @IsString()
  JWT_REFRESH_SECRET: string;
}

export function validate(config: Record<string, unknown>) {
  const validatedConfig = plainToInstance(EnvironmentVariables, config, {
    enableImplicitConversion: true,
  });
  const errors = validateSync(validatedConfig, {
    skipMissingProperties: false,
  });

  if (errors.length > 0) {
    let show_errors: any[] = [];
    for (const error of errors) {
      if (error.constraints) {
        show_errors.push(error.constraints);
      }
    }
    throw new Error(JSON.stringify(show_errors, null, 4));
  }

  return validatedConfig;
}
