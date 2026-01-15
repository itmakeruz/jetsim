import { ArgumentsHost, Catch, ExceptionFilter, HttpException, Logger } from '@nestjs/common';
import { Response } from 'express';

@Catch(HttpException)
export class AllExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(AllExceptionFilter.name);

  catch(exception: any, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    // const request = ctx.getRequest<IRequest>();
    this.logger.error(exception);
    const response = ctx.getResponse<Response>();
    let status = exception?.getStatus() ?? 500;
    let responseJson = exception.getResponse() ?? { message: 'Internal server error', status: status };
    response.status(status).json(responseJson);
  }
}
