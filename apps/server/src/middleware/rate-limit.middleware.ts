import { Injectable, NestMiddleware, HttpException, HttpStatus } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';

interface RateLimitConfig {
  windowMs: number; // Time window in milliseconds
  maxRequests: number; // Max requests per window
}

@Injectable()
export class RateLimitMiddleware implements NestMiddleware {
  private readonly requests = new Map<string, { count: number; resetTime: number }>();
  private readonly config: RateLimitConfig;

  constructor() {
    this.config = {
      windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS || '900000'), // 15 minutes
      maxRequests: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS || '100'), // 100 requests per window
    };

    // Clean up expired entries every 5 minutes
    setInterval(() => this.cleanup(), 5 * 60 * 1000);
  }

  use(req: Request, res: Response, next: NextFunction) {
    const key = this.generateKey(req);
    const now = Date.now();
    const windowStart = now - this.config.windowMs;

    let requestInfo = this.requests.get(key);

    if (!requestInfo || requestInfo.resetTime <= now) {
      // Reset the counter for a new window
      requestInfo = {
        count: 1,
        resetTime: now + this.config.windowMs,
      };
    } else {
      // Increment the counter
      requestInfo.count += 1;
    }

    this.requests.set(key, requestInfo);

    // Set rate limit headers
    res.setHeader('X-RateLimit-Limit', this.config.maxRequests);
    res.setHeader('X-RateLimit-Remaining', Math.max(0, this.config.maxRequests - requestInfo.count));
    res.setHeader('X-RateLimit-Reset', Math.ceil(requestInfo.resetTime / 1000));

    if (requestInfo.count > this.config.maxRequests) {
      throw new HttpException(
        {
          statusCode: HttpStatus.TOO_MANY_REQUESTS,
          message: 'Too Many Requests',
          error: 'Rate limit exceeded. Try again later.',
        },
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }

    next();
  }

  private generateKey(req: Request): string {
    // Use IP address as the key, but you could also use user ID for authenticated requests
    const ip = req.ip || req.connection.remoteAddress || 'unknown';
    const userAgent = req.get('User-Agent') || 'unknown';
    return `${ip}:${userAgent}`;
  }

  private cleanup(): void {
    const now = Date.now();
    for (const [key, info] of this.requests.entries()) {
      if (info.resetTime <= now) {
        this.requests.delete(key);
      }
    }
  }
}