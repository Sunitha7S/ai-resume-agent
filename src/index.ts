import { loadConfig } from "./utils/config.js";
import { createLogger } from "./utils/logger.js";
import { ResumeAgent } from "./core/agent.js";

async function main(): Promise<void> {
  const config = loadConfig();
  const logger = createLogger(config.logLevel, config.logFile);

  logger.info("=== AI Resume Data Entry Agent ===");
  logger.info("Configuration loaded", {
    headless: config.headless,
    continuousMode: config.continuousMode,
    humanLikeDelay: config.humanLikeDelay,
    submitAfterFill: config.submitAfterFill,
    useOcrFallback: config.useOcrFallback,
  });

  if (!config.openaiApiKey) {
    logger.error("OPENAI_API_KEY is required. Set it in .env file.");
    process.exit(1);
  }

  if (!config.datasortUserId || !config.datasortPassword) {
    logger.error(
      "DATASORT_USER_ID and DATASORT_PASSWORD are required. Set them in .env file."
    );
    process.exit(1);
  }

  const isContinuous = process.argv.includes("--continuous") || config.continuousMode;
  config.continuousMode = isContinuous;

  const agent = new ResumeAgent(logger, config);

  const shutdown = async (signal: string): Promise<void> => {
    logger.info(`Received ${signal}, shutting down gracefully...`);
    await agent.stop();
    process.exit(0);
  };

  process.on("SIGINT", () => void shutdown("SIGINT"));
  process.on("SIGTERM", () => void shutdown("SIGTERM"));

  try {
    await agent.start();
  } catch (error) {
    logger.error("Agent crashed", {
      error: error instanceof Error ? error.message : String(error),
    });
    await agent.stop();
    process.exit(1);
  }
}

main().catch((error) => {
  console.error("Fatal error:", error);
  process.exit(1);
});
