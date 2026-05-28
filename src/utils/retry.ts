import type winston from "winston";

export interface RetryOptions {
  maxRetries: number;
  delayMs: number;
  backoffMultiplier?: number;
  logger?: winston.Logger;
  operationName?: string;
}

export async function withRetry<T>(
  fn: () => Promise<T>,
  options: RetryOptions
): Promise<T> {
  const {
    maxRetries,
    delayMs,
    backoffMultiplier = 2,
    logger,
    operationName = "operation",
  } = options;

  let lastError: Error | undefined;

  for (let attempt = 1; attempt <= maxRetries + 1; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));

      if (attempt > maxRetries) {
        logger?.error(`${operationName} failed after ${maxRetries + 1} attempts`, {
          error: lastError.message,
        });
        throw lastError;
      }

      const waitTime = delayMs * Math.pow(backoffMultiplier, attempt - 1);
      logger?.warn(
        `${operationName} attempt ${attempt}/${maxRetries + 1} failed, retrying in ${waitTime}ms`,
        { error: lastError.message }
      );
      await sleep(waitTime);
    }
  }

  throw lastError;
}

export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export function randomDelay(minMs: number, maxMs: number): Promise<void> {
  const delay = Math.floor(Math.random() * (maxMs - minMs + 1)) + minMs;
  return sleep(delay);
}
