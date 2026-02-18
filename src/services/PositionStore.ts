import { DecisionType, PositionStatus, PrismaClient } from '@prisma/client';

export class PositionStore {
  constructor(private prisma: PrismaClient) {}

  async getOpenPosition(symbol: string) {
    return this.prisma.position.findFirst({ where: { symbol, status: PositionStatus.OPEN } });
  }

  async upsertPosition(symbol: string, side: DecisionType, qty: number, avgEntry: number) {
    const existing = await this.getOpenPosition(symbol);
    if (existing) {
      return this.prisma.position.update({ where: { id: existing.id }, data: { side, qty, avgEntry } });
    }
    return this.prisma.position.create({ data: { symbol, side, qty, avgEntry } });
  }

  async closePosition(symbol: string) {
    const existing = await this.getOpenPosition(symbol);
    if (!existing) return null;
    return this.prisma.position.update({
      where: { id: existing.id },
      data: { status: PositionStatus.CLOSED, closedAt: new Date() },
    });
  }
}
