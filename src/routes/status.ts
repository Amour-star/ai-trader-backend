import { PrismaClient } from '@prisma/client';
import { Request, Response } from 'express';
import { AppConfig } from '../config';

export const statusRoute = (config: AppConfig, getThreshold: () => number) => async (_req: Request, res: Response) => {
  res.json({
    status: 'running',
    engineMode: config.engineMode,
    symbol: config.symbol,
    confidenceThreshold: getThreshold(),
    timestamp: new Date().toISOString(),
  });
};
