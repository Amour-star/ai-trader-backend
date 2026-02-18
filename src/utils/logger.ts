export type LogLevel = 'INFO' | 'WARN' | 'ERROR' | 'DEBUG';

export class Logger {
  constructor(private module: string) {}

  private write(level: LogLevel, message: string, meta?: unknown) {
    const line = `[${level}] [${this.module}] ${message}`;
    if (meta !== undefined) {
      process.stdout.write(`${line} ${JSON.stringify(meta)}\n`);
      return;
    }
    process.stdout.write(`${line}\n`);
  }

  info(message: string, meta?: unknown) {
    this.write('INFO', message, meta);
  }

  warn(message: string, meta?: unknown) {
    this.write('WARN', message, meta);
  }

  error(message: string, meta?: unknown) {
    this.write('ERROR', message, meta);
  }

  debug(message: string, meta?: unknown) {
    this.write('DEBUG', message, meta);
  }
}
