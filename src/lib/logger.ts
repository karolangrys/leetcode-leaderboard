import winston from "winston";

const { combine, timestamp, printf, errors, json, colorize } = winston.format;

const consoleFormat = printf(({ level, message, timestamp: ts, ...meta }) => {
  const metaKeys = Object.keys(meta);
  const metaStr =
    metaKeys.length > 0 ? ` ${JSON.stringify(meta)}` : "";
  return `${ts} [${level}]: ${message}${metaStr}`;
});

export const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || "info",
  format: combine(
    errors({ stack: true }),
    timestamp({ format: "YYYY-MM-DD HH:mm:ss" }),
    json()
  ),
  defaultMeta: { service: "leetsquad-tracker" },
  transports: [
    new winston.transports.Console({
      format: combine(
        colorize({ all: false }),
        timestamp({ format: "YYYY-MM-DD HH:mm:ss" }),
        consoleFormat
      ),
    }),
  ],
});
