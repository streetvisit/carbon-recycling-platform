import { Injectable, NestMiddleware } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';
import { v4 as uuidv4 } from 'uuid';

@Injectable()
export class RequestIdMiddleware implements NestMiddleware {
  use(req: Request, res: Response, next: NextFunction) {
    const requestId = req.headers['x-request-id'] as string || uuidv4();
    
    // Set request ID in request headers
    req.headers['x-request-id'] = requestId;
    
    // Set request ID in response headers
    res.setHeader('X-Request-ID', requestId);
    
    // Store in request for later use
    (req as any).requestId = requestId;
    
    next();
  }
}