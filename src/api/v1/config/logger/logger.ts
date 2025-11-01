import { createLogger, format, log, transports } from 'winston';
import env from '../env';
import moment from 'moment-timezone';

const { combine, printf, colorize } = format;

const GLOBAL_TIMEZONE = 'Asia/Kolkata';

const logFormat = printf((obj) => {
    const splatRaw = obj[Symbol.for('splat')];
    const splat: any[] = Array.isArray(splatRaw) ? splatRaw : [];
    const splatString = splat.length ? ` | Extra: ${splat.map(s => (typeof s === 'object' ? JSON.stringify(s) : s)).join(', ')}` : '';
    const { level, message, context } = obj;
    const timestamp = moment().tz(GLOBAL_TIMEZONE).format('YYYY-MM-DD HH:mm:ss');
    return `${timestamp} [${level}]${context ? ` [${context}]` : ''}: ${message}${splatString}`;
});

export const logger = createLogger({
    level: env.NODE_ENV == 'production' ? 'info' : 'debug',
    format: combine(
        colorize({ all: env.NODE_ENV != 'production' }),
        logFormat,
    ),
    transports: [new transports.Console()],
});

export const logObject = (obj: any, context?: string, level: 'debug' | 'info' | 'warn' | 'error' = 'debug') => {
    if (typeof obj === 'object') {
        logger.log({ level, message: 'Object log', context, extra: obj });
    } else {
        logger.log({ level, message: obj, context });
    }
};
