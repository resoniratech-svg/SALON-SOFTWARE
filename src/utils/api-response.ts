import { Response } from 'express';

export interface ApiResponse<T = any> {
  success: boolean;
  message: string;
  data?: T;
  error?: string | string[];
}

export const sendResponse = <T>(
  res: Response,
  statusCode: number,
  success: boolean,
  message: string,
  data?: T
): Response => {
  const responsePayload: ApiResponse<T> = {
    success,
    message,
    ...(data !== undefined ? { data } : {}),
  };
  return res.status(statusCode).json(responsePayload);
};
