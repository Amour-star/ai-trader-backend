import 'dotenv/config';

export type EngineMode = 'paper' | 'disabled';

export type AppConfig = {
  databaseUrl: string;
  port: number;
  engineMode: EngineMode;
  confidenceThreshold: number;
  symbol: string;
  corsOrigin: string;
};

function required(name: string): string {
  const value = process.env[name];
  if (!value || value.trim().length === 0) {
    throw new Error(`Missing required env var: ${name}`);
  }
  return value;
}

function parseNumber(name: string, raw: string): number {
  const value = Number(raw);
  if (Number.isNaN(value)) {
    throw new Error(`Invalid numeric env var ${name}: ${raw}`);
  }
  return value;
}

function withNeonSsl(databaseUrl: string): string {
  const hasSslMode = /[?&]sslmode=/i.test(databaseUrl);
  if (hasSslMode) return databaseUrl;
  return `${databaseUrl}${databaseUrl.includes('?') ? '&' : '?'}sslmode=require`;
}

export function loadConfig(): AppConfig {
  const modeRaw = required('ENGINE_MODE').toLowerCase();
  if (modeRaw !== 'paper' && modeRaw !== 'disabled') {
    throw new Error('ENGINE_MODE must be one of: paper, disabled');
  }

  const config: AppConfig = {
    databaseUrl: withNeonSsl(required('DATABASE_URL')),
    port: parseNumber('PORT', required('PORT')),
    engineMode: modeRaw,
    confidenceThreshold: parseNumber('CONFIDENCE_THRESHOLD', required('CONFIDENCE_THRESHOLD')),
    symbol: required('SYMBOL').toUpperCase(),
    corsOrigin: process.env.CORS_ORIGIN ?? '*',
  };

  return config;
}

export function sanitizedConfig(config: AppConfig) {
  return {
    port: config.port,
    engineMode: config.engineMode,
    confidenceThreshold: config.confidenceThreshold,
    symbol: config.symbol,
    corsOrigin: config.corsOrigin,
    databaseUrl: '[REDACTED]',
  };
}
