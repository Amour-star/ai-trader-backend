import { Request, Response } from 'express';
import { EngineRunner } from '../engine/EngineRunner';
import { TradeStore } from '../services/TradeStore';

export const healthRoute = (runner: EngineRunner, tradeStore: TradeStore, startedAt: number) => async (_req: Request, res: Response) => {
  await tradeStore.testConnection();
  const metrics = runner.getMetrics();

  res.json({
    status: 'ok',
    db: 'connected',
    engine: metrics.isRunning ? 'running' : 'stopped',
    uptimeSeconds: Math.floor((Date.now() - startedAt) / 1000),
  });
};
