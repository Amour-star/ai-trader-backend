export type LogLevel = 'info' | 'warn' | 'error' | 'debug';

export class Logger {
  constructor(private context: string) {}

  private write(level: LogLevel, message: string, metadata?: unknown) {
    const payload = {
      level,
      context: this.context,
      message,
      metadata,
      timestamp: new Date().toISOString(),
    };
    process.stdout.write(`${JSON.stringify(payload)}\n`);
  }

  info(message: string, metadata?: unknown) {
    this.write('info', message, metadata);
  }

  warn(message: string, metadata?: unknown) {
    this.write('warn', message, metadata);
  }

  error(message: string, metadata?: unknown) {
    this.write('error', message, metadata);
  }

  debug(message: string, metadata?: unknown) {
    this.write('debug', message, metadata);
  }
}
