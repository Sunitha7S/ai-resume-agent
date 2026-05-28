import winston from "winston";
import path from "path";
import fs from "fs";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export function createLogger(
  level: string = "info",
  logFile: string = "logs/agent.log"
): winston.Logger {
  const logDir = path.dirname(path.resolve(__dirname, "../../", logFile));
  if (!fs.existsSync(logDir)) {
    fs.mkdirSync(logDir, { recursive: true });
  }

  const logger = winston.createLogger({
    level,
    format: winston.format.combine(
      winston.format.timestamp({ format: "YYYY-MM-DD HH:mm:ss.SSS" }),
      winston.format.errors({ stack: true }),
      winston.format.json()
    ),
    defaultMeta: { service: "ai-resume-agent" },
    transports: [
      new winston.transports.File({
        filename: path.resolve(__dirname, "../../", logFile),
        maxsize: 10 * 1024 * 1024,
        maxFiles: 5,
      }),
      new winston.transports.File({
        filename: path.resolve(logDir, "error.log"),
        level: "error",
        maxsize: 5 * 1024 * 1024,
        maxFiles: 3,
      }),
      new winston.transports.Console({
        format: winston.format.combine(
          winston.format.colorize(),
          winston.format.printf(({ timestamp, level, message, ...meta }) => {
            const metaStr = Object.keys(meta).length > 1
              ? ` ${JSON.stringify(meta, null, 0)}`
              : "";
            return `[${timestamp as string}] ${level}: ${message as string}${metaStr}`;
          })
        ),
      }),
    ],
  });

  return logger;
}
