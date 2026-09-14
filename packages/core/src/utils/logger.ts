import winston from "winston";

const { combine, timestamp, printf, colorize, errors, json } = winston.format;

const consoleFormat = combine(
  colorize(),
  timestamp({ format: "HH:mm:ss" }),
  errors({ stack: true }),
  printf(({ level, message, timestamp: ts, stack, ...meta }) => {
    const rest = Object.keys(meta).length ? ` ${JSON.stringify(meta)}` : "";
    return `${ts} ${level}: ${stack ?? message}${rest}`;
  })
);

// Console-only: both Vercel (read-only filesystem outside /tmp) and Render
// (ephemeral disk, expects stdout/stderr for its log viewer) want stdout logs,
// not local log files.
export const logger = winston.createLogger({
  level: process.env.LOG_LEVEL ?? "info",
  format: combine(timestamp(), errors({ stack: true }), json()),
  transports: [new winston.transports.Console({ format: consoleFormat })],
});
