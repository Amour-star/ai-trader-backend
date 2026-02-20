import { Logger } from '../utils/logger';

const BINANCE_BASE = 'https://api.binance.com';

export class BinanceMarketData {
  constructor(private logger: Logger) {}

  async getTickerPrice(symbol: string): Promise<number> {
    const response = await fetch(`${BINANCE_BASE}/api/v3/ticker/price?symbol=${encodeURIComponent(symbol)}`);
    if (!response.ok) {
      this.logger.error('Ticker request failed', { symbol, status: response.status });
      throw new Error(`Ticker request failed: ${response.status}`);
    }

    const payload = (await response.json()) as { price?: string };
    const parsed = Number(payload.price);
    if (!payload.price || Number.isNaN(parsed)) {
      throw new Error(`Invalid ticker payload for ${symbol}`);
    }
    return parsed;
  }
}
