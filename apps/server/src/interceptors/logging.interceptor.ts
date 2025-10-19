import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
  Logger,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { tap } from 'rxjs/operators';
import { Request, Response } from 'express';

@Injectable()
export class LoggingInterceptor implements NestInterceptor {
  private readonly logger = new Logger(LoggingInterceptor.name);

  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const request = context.switchToHttp().getRequest<Request>();
    const response = context.switchToHttp().getResponse<Response>();
    const { method, url, body, headers } = request;
    const userAgent = headers['user-agent'];
    const startTime = Date.now();

    // Log request
    this.logger.log({
      type: 'REQUEST',
      method,
      url,
      userAgent,
      body: this.sanitizeBody(body),
      timestamp: new Date().toISOString(),
    });

    return next.handle().pipe(
      tap(() => {
        const duration = Date.now() - startTime;
        const { statusCode } = response;

        // Log response
        this.logger.log({
          type: 'RESPONSE',
          method,
          url,
          statusCode,
          duration: `${duration}ms`,
          timestamp: new Date().toISOString(),
        });
      }),
    );
  }

  private sanitizeBody(body: any): any {
    if (!body) return body;

    const sensitiveFields = ['password', 'token', 'secret', 'key', 'authorization'];
    const sanitized = { ...body };

    for (const field of sensitiveFields) {
      if (sanitized[field]) {
        sanitized[field] = '[REDACTED]';
      }
    }

    return sanitized;
  }
}