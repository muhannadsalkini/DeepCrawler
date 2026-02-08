/* eslint-disable no-console */

interface LogMeta {
  [key: string]: unknown;
}

export const logger = {
  info: (msg: string, meta?: LogMeta): void => {
    console.log(JSON.stringify({ level: 'info', msg, ...meta, timestamp: Date.now() }));
  },

  error: (msg: string, error?: Error, meta?: LogMeta): void => {
    console.error(
      JSON.stringify({
        level: 'error',
        msg,
        error: error?.message,
        stack: error?.stack,
        ...meta,
        timestamp: Date.now(),
      })
    );
  },

  warn: (msg: string, meta?: LogMeta): void => {
    console.warn(JSON.stringify({ level: 'warn', msg, ...meta, timestamp: Date.now() }));
  },

  debug: (msg: string, meta?: LogMeta): void => {
    if (process.env.LOG_LEVEL === 'debug') {
      console.log(JSON.stringify({ level: 'debug', msg, ...meta, timestamp: Date.now() }));
    }
  },
};
