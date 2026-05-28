import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.resolve(__dirname, "../../.env") });

export interface AgentConfig {
  openaiApiKey: string;
  datasortUserId: string;
  datasortPassword: string;
  headless: boolean;
  continuousMode: boolean;
  humanLikeDelay: boolean;
  minDelayMs: number;
  maxDelayMs: number;
  submitAfterFill: boolean;
  logLevel: string;
  logFile: string;
  useOcrFallback: boolean;
  maxRetries: number;
  retryDelayMs: number;
  baseUrl: string;
}

export function loadConfig(): AgentConfig {
  return {
    openaiApiKey: process.env.OPENAI_API_KEY ?? "",
    datasortUserId: process.env.DATASORT_USER_ID ?? "",
    datasortPassword: process.env.DATASORT_PASSWORD ?? "",
    headless: process.env.HEADLESS === "true",
    continuousMode: process.env.CONTINUOUS_MODE !== "false",
    humanLikeDelay: process.env.HUMAN_LIKE_DELAY !== "false",
    minDelayMs: parseInt(process.env.MIN_DELAY_MS ?? "200", 10),
    maxDelayMs: parseInt(process.env.MAX_DELAY_MS ?? "800", 10),
    submitAfterFill: process.env.SUBMIT_AFTER_FILL !== "false",
    logLevel: process.env.LOG_LEVEL ?? "info",
    logFile: process.env.LOG_FILE ?? "logs/agent.log",
    useOcrFallback: process.env.USE_OCR_FALLBACK !== "false",
    maxRetries: parseInt(process.env.MAX_RETRIES ?? "3", 10),
    retryDelayMs: parseInt(process.env.RETRY_DELAY_MS ?? "2000", 10),
    baseUrl: "https://dashboard.datasort.in",
  };
}
