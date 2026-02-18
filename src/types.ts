export const Decision = {
  BUY: 'BUY',
  SELL: 'SELL',
  HOLD: 'HOLD',
} as const;

export const TradeStatusValue = {
  OPEN: 'OPEN',
  CLOSED: 'CLOSED',
} as const;

export const PositionStatusValue = {
  OPEN: 'OPEN',
  CLOSED: 'CLOSED',
} as const;

export type DecisionType = typeof Decision[keyof typeof Decision];
export type TradeStatus = typeof TradeStatusValue[keyof typeof TradeStatusValue];
export type PositionStatus = typeof PositionStatusValue[keyof typeof PositionStatusValue];
