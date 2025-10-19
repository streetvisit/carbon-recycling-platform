import { Injectable, NestMiddleware, Logger } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';

@Injectable()
export class LoggerMiddleware implements NestMiddleware {
  private readonly logger = new Logger(LoggerMiddleware.name);

  use(req: Request, res: Response, next: NextFunction) {
    const { method, originalUrl, ip } = req;
    const userAgent = req.get('User-Agent') || '';
    const requestId = (req as any).requestId;
    const startTime = Date.now();

    // Log incoming request
    this.logger.log(
      `${method} ${originalUrl} - ${ip} - ${userAgent} - RequestID: ${requestId}`
    );

    // Override res.end to log response
    const originalEnd = res.end;
    res.end = function(chunk?: any, encoding?: any) {
      const duration = Date.now() - startTime;
      const { statusCode } = res;
      const contentLength = res.get('content-length') || 0;

      this.logger.log(
        `${method} ${originalUrl} - ${statusCode} - ${duration}ms - ${contentLength}bytes - RequestID: ${requestId}`
      );

      originalEnd.call(this, chunk, encoding);
    }.bind(this);

    next();
  }
}