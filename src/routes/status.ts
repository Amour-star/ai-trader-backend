import { PrismaClient } from '@prisma/client';
import { Request, Response } from 'express';
import { EngineRunner } from '../engine/EngineRunner';
import { TradeStore } from '../services/TradeStore';

export const statusRoute = (runner: EngineRunner, tradeStore: TradeStore) => async (_req: Request, res: Response) => {
  await tradeStore.testConnection();
  const metrics = runner.getMetrics();

export const statusRoute = (config: AppConfig, getThreshold: () => number) => async (_req: Request, res: Response) => {
  res.json({
    status: 'ok',
    engine: metrics.isRunning ? 'running' : 'stopped',
    db: 'connected',
    timestamp: new Date(),
  });
};
