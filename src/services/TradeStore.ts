import { Prisma, PrismaClient } from '@prisma/client';
import { Decision, DecisionType, TradeStatusValue } from '../types';

export class TradeStore {
  constructor(private prisma: PrismaClient) {}

  async recordDecision(input: {
    symbol: string;
    timeframe: string;
    decision: DecisionType;
    confidence: number;
    reasons: Prisma.InputJsonValue;
    featuresHash: string;
    modelVersion: string;
  }) {
    return this.prisma.decision.create({ data: input });
  }

  async openTrade(input: {
    symbol: string;
    side: DecisionType;
    qty: number;
    entryPrice: number;
    tpPrice?: number;
    slPrice?: number;
    fee?: number;
    slippage?: number;
    decisionId?: string;
  }) {
    return this.prisma.trade.create({
      data: {
        ...input,
        fee: input.fee ?? 0,
        slippage: input.slippage ?? 0,
      },
    });
  }

  async closeTrade(tradeId: string, exitPrice: number, reason: 'TP' | 'SL' | 'MANUAL' | 'SIGNAL') {
    const trade = await this.prisma.trade.findUnique({ where: { id: tradeId } });
    if (!trade) throw new Error(`Trade ${tradeId} not found`);
    if (trade.status !== (TradeStatusValue.OPEN as any)) return trade;

    const fees = trade.fee;
    const slippageCost = trade.slippage;

    const pnlAbs = trade.side === Decision.BUY
      ? (exitPrice - trade.entryPrice) * trade.qty - fees - slippageCost
      : (trade.entryPrice - exitPrice) * trade.qty - fees - slippageCost;

    const pnlPct = trade.entryPrice > 0 ? (pnlAbs / (trade.entryPrice * trade.qty)) * 100 : 0;

    return this.prisma.trade.update({
      where: { id: tradeId },
      data: {
        tsClose: new Date(),
        exitPrice,
        pnlAbs,
        pnlPct,
        closeReason: reason,
        status: TradeStatusValue.CLOSED as any,
      },
    });
  }

  async getTrades(limit: number) {
    const safeLimit = Math.max(1, Math.min(limit, 500));
    return this.prisma.trade.findMany({ orderBy: { tsOpen: 'desc' }, take: safeLimit });
  }

  async getDecisions(limit: number) {
    const safeLimit = Math.max(1, Math.min(limit, 1000));
    return this.prisma.decision.findMany({ orderBy: { ts: 'desc' }, take: safeLimit });
  }

  async getOpenTrades(symbol?: string) {
    return this.prisma.trade.findMany({
      where: {
        status: TradeStatusValue.OPEN as any,
        ...(symbol ? { symbol } : {}),
      },
      orderBy: { tsOpen: 'asc' },
      take: 100,
    });
  }

  async testConnection() {
    await this.prisma.$queryRaw`SELECT 1`;
  }
}
