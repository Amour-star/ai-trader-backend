import cors from 'cors';
import express, { NextFunction, Request, Response } from 'express';
import { Server } from 'node:http';
import { AppConfig } from './config';
import { EngineRunner } from './engine/EngineRunner';
import { ExecutionEngine } from './engine/ExecutionEngine';
import { RiskGuards } from './engine/RiskGuards';
import { StrategyCoordinator } from './engine/StrategyCoordinator';
import { forceTradeRoute } from './routes/forceTrade';
import { settingsRoute } from './routes/settings';
import { statusRoute } from './routes/status';
import { decisionsRoute, tradesRoute } from './routes/trades';
import { BinanceMarketData } from './services/BinanceMarketData';
import { connectPrismaWithRetry, createPrismaClient } from './services/Db';
import { PositionStore } from './services/PositionStore';
import { TradeStore } from './services/TradeStore';
import { asyncHandler } from './utils/asyncHandler';
import { Logger } from './utils/logger';

export function createServer(config: AppConfig) {
  const appLogger = new Logger('server');
  const prisma = createPrismaClient(config);

  const marketData = new BinanceMarketData(new Logger('market-data'));
  const tradeStore = new TradeStore(prisma);
  const positionStore = new PositionStore(prisma);
  const execution = new ExecutionEngine(tradeStore, positionStore, new Logger('execution-engine'));
  const strategy = new StrategyCoordinator();
  const risk = new RiskGuards(positionStore);

  let threshold = config.confidenceThreshold;
  let testSignalMode = false;

  const runner = new EngineRunner(
    config.symbol,
    () => threshold,
    marketData,
    strategy,
    tradeStore,
    execution,
    risk,
    { lastHeartbeatTs: null, evaluations: 0, signals: 0, tradesExecuted: 0, isRunning: false },
    () => testSignalMode,
    new Logger('engine-runner'),
  );

  const app = express();
  let server: Server | null = null;
  let hasStarted = false;

  const allowedOrigins = [
    'https://ku-coin-ai-trader-pro.vercel.app',
    'http://localhost:3000',
  ];

  const corsOptions = {
    origin(origin: string | undefined, callback: (error: Error | null, allow?: boolean) => void) {
      if (!origin) return callback(null, true);
      if (allowedOrigins.includes(origin)) {
        return callback(null, true);
      }
      return callback(new Error('Not allowed by CORS'));
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
  };

  app.use(express.json());
  app.use((req, _res, next) => {
    console.log('Origin:', req.headers.origin);
    next();
  });
  app.use(cors(corsOptions));
  app.options('*', cors());

  appLogger.info('CORS configured for:', allowedOrigins);

  app.get('/', (_req, res) => {
    res.json({ status: 'ok', service: 'ai-trader-backend' });
  });
  app.get('/api/status', asyncHandler(statusRoute(runner, tradeStore)));
  app.get('/api/trades', asyncHandler(tradesRoute(tradeStore)));
  app.get('/api/decisions', asyncHandler(decisionsRoute(tradeStore)));
  app.post('/api/force-trade', asyncHandler(forceTradeRoute(marketData, tradeStore, execution)));
  app.post('/api/settings', asyncHandler(settingsRoute(prisma, (value) => {
    threshold = value;
  })));
  app.post('/api/test-signal-mode', (req, res) => {
    testSignalMode = Boolean(req.body?.enabled);
    res.json({ enabled: testSignalMode });
  });

  app.use((err: unknown, _req: Request, res: Response, _next: NextFunction) => {
    appLogger.error('Unhandled route error', { error: err instanceof Error ? err.message : String(err) });
    res.status(500).json({ error: { code: 'INTERNAL_SERVER_ERROR', message: 'Internal server error' } });
  });

  async function start() {
    if (hasStarted) {
      appLogger.warn('Start ignored because server already started');
      return { app, server: server as Server, runner, prisma };
    }

    await connectPrismaWithRetry(prisma, new Logger('prisma'), 3);

    await new Promise<void>((resolve) => {
      const PORT = process.env.PORT || '8080';
      server = app.listen(PORT, '0.0.0.0', () => {
        console.log('Server listening on', PORT);
        appLogger.info('Server started on port', { port: PORT, host: '0.0.0.0' });
        if (config.engineMode === 'paper') {
          runner.start();
        }
        hasStarted = true;
        resolve();
      });
    });

    return { app, server: server as Server, runner, prisma };
  }

  async function shutdown(signal: string) {
    appLogger.warn('Shutdown initiated', { signal });
    runner.stop();

    if (server) {
      await new Promise<void>((resolve, reject) => {
        server?.close((error) => {
          if (error) {
            reject(error);
            return;
          }
          resolve();
        });
      });
    }

    await prisma.$disconnect();
    hasStarted = false;
    appLogger.info('Shutdown complete');
  }

  return { app, start, shutdown };
}
