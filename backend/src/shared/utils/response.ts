import { Response } from 'express';
import { ApiResponse } from '../types';

export function sendSuccess<T>(res: Response, data: T, statusCode = 200): void {
  const response: ApiResponse<T> = {
    success: true,
    data,
    timestamp: new Date().toISOString(),
  };
  res.status(statusCode).json(response);
}

export function sendError(res: Response, error: string, statusCode = 500): void {
  const response: ApiResponse<null> = {
    success: false,
    data: null,
    timestamp: new Date().toISOString(),
    error,
  };
  res.status(statusCode).json(response);
}
