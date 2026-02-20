import { PrismaClient } from '@prisma/client';
import { Request, Response } from 'express';

export const settingsRoute = (prisma: PrismaClient, onThresholdUpdated: (threshold: number) => void) => async (req: Request, res: Response) => {
  const { autoPaper, confidenceThreshold } = req.body as { autoPaper?: boolean; confidenceThreshold?: number };

  const state = await prisma.engineState.upsert({
    where: { id: 'singleton' },
    update: {
      autoPaper: autoPaper ?? undefined,
      confidenceThreshold: confidenceThreshold ?? undefined,
    },
    create: {
      id: 'singleton',
      autoPaper: autoPaper ?? true,
      confidenceThreshold: confidenceThreshold ?? 0.6,
    },
  });

  if (typeof confidenceThreshold === 'number') onThresholdUpdated(confidenceThreshold);
  res.json(state);
};
