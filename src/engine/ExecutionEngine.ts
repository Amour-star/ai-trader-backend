import { Decision, DecisionType } from '../types';
import { TradeStore } from '../services/TradeStore';
import { PositionStore } from '../services/PositionStore';
import { Logger } from '../utils/logger';

export class ExecutionEngine {
  constructor(
    private tradeStore: TradeStore,
    private positionStore: PositionStore,
    private logger: Logger,
  ) {}

  async openPaperTrade(input: {
    symbol: string;
    side: Exclude<DecisionType, "HOLD">;
    qty: number;
    entryPrice: number;
    tpPrice?: number;
    slPrice?: number;
    fee?: number;
    slippage?: number;
    decisionId?: string;
  }) {
    const existingPosition = await this.positionStore.getOpenPosition(input.symbol);
    if (existingPosition) {
      this.logger.warn('[ORDER ATTEMPT] Skipped; open position already exists', {
        symbol: input.symbol,
        side: input.side,
      });
      throw new Error(`Position for ${input.symbol} already open`);
    }

    const fee = input.fee ?? input.entryPrice * input.qty * 0.001;
    const slippage = input.slippage ?? input.entryPrice * input.qty * 0.0005;

    this.logger.info('[ORDER ATTEMPT] Opening paper trade', {
      symbol: input.symbol,
      side: input.side,
      qty: input.qty,
      entryPrice: input.entryPrice,
    });

    const trade = await this.tradeStore.openTrade({ ...input, fee, slippage });
    await this.positionStore.upsertPosition(input.symbol, input.side, input.qty, input.entryPrice);

    this.logger.info('[ORDER FILLED] Paper trade opened', {
      tradeId: trade.id,
      symbol: input.symbol,
      side: input.side,
    });

    return trade;
  }

  async monitorAndClose(symbol: string, currentPrice: number) {
    const relevant = await this.tradeStore.getOpenTrades(symbol);
    for (const trade of relevant) {
      if (trade.tpPrice != null) {
        const hitTp = trade.side === Decision.BUY ? currentPrice >= trade.tpPrice : currentPrice <= trade.tpPrice;
        if (hitTp) {
          this.logger.info('[TP HIT] Closing trade', { tradeId: trade.id, currentPrice, tpPrice: trade.tpPrice });
          await this.tradeStore.closeTrade(trade.id, currentPrice, 'TP');
          await this.positionStore.closePosition(symbol);
          this.logger.info('[ORDER CLOSED] Closed by TP', { tradeId: trade.id });
          continue;
        }
      }
      if (trade.slPrice != null) {
        const hitSl = trade.side === Decision.BUY ? currentPrice <= trade.slPrice : currentPrice >= trade.slPrice;
        if (hitSl) {
          this.logger.info('[SL HIT] Closing trade', { tradeId: trade.id, currentPrice, slPrice: trade.slPrice });
          await this.tradeStore.closeTrade(trade.id, currentPrice, 'SL');
          await this.positionStore.closePosition(symbol);
          this.logger.info('[ORDER CLOSED] Closed by SL', { tradeId: trade.id });
        }
      }
    }
  }
}
