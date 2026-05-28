import type winston from "winston";
import type { AgentConfig } from "../utils/config.js";
import { BrowserSession } from "./browser-session.js";
import { AIResumeExtractor } from "../extraction/ai-extractor.js";
import { OCRExtractor } from "../extraction/ocr-extractor.js";
import { ResumeCapture } from "../extraction/resume-capture.js";
import { FormFiller, type FillResult } from "../form-filler/form-filler.js";
import type { ResumeData } from "../extraction/types.js";
import { sleep } from "../utils/retry.js";

export interface ProcessingResult {
  resumeIndex: number;
  success: boolean;
  fillResults: FillResult[];
  extractedData: ResumeData | null;
  error?: string;
  duration: number;
}

export class ResumeAgent {
  private logger: winston.Logger;
  private config: AgentConfig;
  private session: BrowserSession;
  private aiExtractor: AIResumeExtractor;
  private ocrExtractor: OCRExtractor;
  private resumeCapture: ResumeCapture;
  private resumeCount: number = 0;
  private isRunning: boolean = false;

  constructor(logger: winston.Logger, config: AgentConfig) {
    this.logger = logger;
    this.config = config;
    this.session = new BrowserSession(logger, config);
    this.aiExtractor = new AIResumeExtractor(
      config.openaiApiKey,
      logger,
      config.maxRetries,
      config.retryDelayMs
    );
    this.ocrExtractor = new OCRExtractor(logger);
    this.resumeCapture = new ResumeCapture(logger);
  }

  async start(): Promise<void> {
    this.isRunning = true;
    this.logger.info("Starting Resume Agent", {
      continuousMode: this.config.continuousMode,
      headless: this.config.headless,
    });

    try {
      await this.session.initialize();
      await this.session.login();
      await this.session.navigateToNewResume();

      if (this.config.continuousMode) {
        await this.runContinuous();
      } else {
        await this.processSingleResume();
      }
    } catch (error) {
      this.logger.error("Agent startup failed", {
        error: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }
  }

  async stop(): Promise<void> {
    this.isRunning = false;
    this.logger.info("Stopping Resume Agent", {
      resumesProcessed: this.resumeCount,
    });
    await this.session.close();
  }

  private async runContinuous(): Promise<void> {
    this.logger.info("Running in continuous mode");

    while (this.isRunning) {
      try {
        if (!(await this.session.isSessionValid())) {
          this.logger.info("Re-authenticating...");
          await this.session.login();
          await this.session.navigateToNewResume();
        }

        const result = await this.processSingleResume();
        this.logResult(result);

        this.logger.info("Waiting for next resume...");
        await sleep(3000);

        await this.session.navigateToNewResume();
        await sleep(2000);

        const hasResume = await this.session.waitForNewResume();
        if (!hasResume) {
          this.logger.info("No new resume available, waiting...");
          await sleep(10000);
        }
      } catch (error) {
        this.logger.error("Error in continuous loop", {
          error: error instanceof Error ? error.message : String(error),
        });
        await sleep(5000);

        try {
          await this.session.navigateToNewResume();
        } catch {
          this.logger.error("Recovery failed, re-initializing...");
          await this.session.close();
          await this.session.initialize();
          await this.session.login();
          await this.session.navigateToNewResume();
        }
      }
    }
  }

  private async processSingleResume(): Promise<ProcessingResult> {
    const startTime = Date.now();
    this.resumeCount++;

    this.logger.info(`Processing resume #${this.resumeCount}`);

    try {
      const page = this.session.getPage();

      this.logger.info("Step 1: Capturing resume images");
      const images = await this.resumeCapture.captureResumeImages(page);

      if (images.length === 0) {
        this.logger.warn("No resume images captured, skipping");
        return {
          resumeIndex: this.resumeCount,
          success: false,
          fillResults: [],
          extractedData: null,
          error: "No resume images captured",
          duration: Date.now() - startTime,
        };
      }

      this.logger.info("Step 2: Extracting resume data");
      let resumeData: ResumeData;
      try {
        resumeData = await this.aiExtractor.extractFromImages(images);
      } catch (aiError) {
        this.logger.warn("AI extraction failed, falling back to OCR", {
          error: aiError instanceof Error ? aiError.message : String(aiError),
        });

        if (this.config.useOcrFallback) {
          const ocrText = await this.ocrExtractor.extractTextFromMultipleImages(images);
          resumeData = await this.aiExtractor.extractFromText(ocrText);
        } else {
          throw aiError;
        }
      }

      this.logger.info("Step 3: Filling form");
      const filler = new FormFiller(page, this.logger, this.config);
      const fillResults = await filler.fillForm(resumeData);

      this.logger.info("Step 4: Submitting resume");
      if (this.config.submitAfterFill) {
        const submitted = await filler.clickSubmitResume();
        if (submitted) {
          await filler.handlePostSubmitDialog();
          this.logger.info(`Resume #${this.resumeCount} submitted successfully`);
        } else {
          const saved = await filler.clickSaveResume();
          if (saved) {
            this.logger.info(`Resume #${this.resumeCount} saved (submit unavailable)`);
          }
        }
      }

      return {
        resumeIndex: this.resumeCount,
        success: true,
        fillResults,
        extractedData: resumeData,
        duration: Date.now() - startTime,
      };
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      this.logger.error(`Failed to process resume #${this.resumeCount}`, {
        error: errorMsg,
      });

      try {
        await this.session.screenshot(
          `screenshots/error-resume-${this.resumeCount}.png`
        );
      } catch {
        // Ignore screenshot errors
      }

      return {
        resumeIndex: this.resumeCount,
        success: false,
        fillResults: [],
        extractedData: null,
        error: errorMsg,
        duration: Date.now() - startTime,
      };
    }
  }

  private logResult(result: ProcessingResult): void {
    const filled = result.fillResults.filter((r) => r.success).length;
    const total = result.fillResults.length;
    const accuracy = total > 0 ? ((filled / total) * 100).toFixed(1) : "0";

    this.logger.info(`Resume #${result.resumeIndex} result`, {
      success: result.success,
      accuracy: `${accuracy}%`,
      filled,
      total,
      duration: `${(result.duration / 1000).toFixed(1)}s`,
      error: result.error,
    });
  }
}
