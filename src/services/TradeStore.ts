import { DecisionType, PrismaClient, TradeStatus } from '@prisma/client';

export class TradeStore {
  constructor(private prisma: PrismaClient) {}

  async recordDecision(input: {
    symbol: string;
    timeframe: string;
    decision: DecisionType;
    confidence: number;
    reasons: unknown;
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
    if (trade.status !== TradeStatus.OPEN) return trade;

    const fees = trade.fee;
    const slippageCost = trade.slippage;

    const pnlAbs = trade.side === DecisionType.BUY
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
        status: TradeStatus.CLOSED,
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
        status: TradeStatus.OPEN,
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
