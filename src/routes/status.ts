import { PrismaClient } from '@prisma/client';
import { Request, Response } from 'express';
import { EngineRunner } from '../engine/EngineRunner';

export const statusRoute = (prisma: PrismaClient, runner: EngineRunner, symbol: string) => async (_req: Request, res: Response) => {
  const state = await prisma.engineState.upsert({
    where: { id: 'singleton' },
    update: {},
    create: { id: 'singleton' },
  });

  const metrics = runner.getMetrics();

  res.json({
    running: metrics.isRunning,
    lastHeartbeatTs: metrics.lastHeartbeatTs,
    selectedSymbol: symbol,
    evaluationsCount: metrics.evaluations,
    signalsCount: metrics.signals,
    tradesExecutedCount: metrics.tradesExecuted,
    autoPaper: state.autoPaper,
    confidenceThreshold: state.confidenceThreshold,
  });
};
