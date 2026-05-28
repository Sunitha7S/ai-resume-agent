import { chromium, type Browser, type BrowserContext, type Page } from "playwright";
import type winston from "winston";
import type { AgentConfig } from "../utils/config.js";
import { withRetry, sleep } from "../utils/retry.js";

export class BrowserSession {
  private browser: Browser | null = null;
  private context: BrowserContext | null = null;
  private page: Page | null = null;
  private logger: winston.Logger;
  private config: AgentConfig;

  constructor(logger: winston.Logger, config: AgentConfig) {
    this.logger = logger;
    this.config = config;
  }

  async initialize(): Promise<Page> {
    this.logger.info("Initializing browser session");

    this.browser = await chromium.launch({
      headless: this.config.headless,
      args: [
        "--no-sandbox",
        "--disable-setuid-sandbox",
        "--disable-dev-shm-usage",
        "--disable-accelerated-2d-canvas",
        "--disable-gpu",
        "--window-size=1920,1080",
      ],
    });

    this.context = await this.browser.newContext({
      viewport: { width: 1920, height: 1080 },
      userAgent:
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
    });

    this.page = await this.context.newPage();

    this.page.on("dialog", async (dialog) => {
      this.logger.info(`Dialog appeared: ${dialog.type()} - ${dialog.message()}`);
      await dialog.accept();
    });

    this.page.on("console", (msg) => {
      if (msg.type() === "error") {
        this.logger.debug(`Browser console error: ${msg.text()}`);
      }
    });

    this.logger.info("Browser session initialized");
    return this.page;
  }

  async login(): Promise<void> {
    if (!this.page) throw new Error("Browser not initialized");

    this.logger.info("Logging in to DataSort dashboard");

    await withRetry(
      async () => {
        await this.page!.goto(`${this.config.baseUrl}/auth/signin`, {
          waitUntil: "networkidle",
          timeout: 30000,
        });

        await this.page!.fill('input[name="userId"]', this.config.datasortUserId);
        await sleep(300);
        await this.page!.fill('input[name="password"]', this.config.datasortPassword);
        await sleep(300);
        await this.page!.click('button[type="submit"]');

        await this.page!.waitForURL("**/", { timeout: 15000 });
        this.logger.info("Login successful");
      },
      {
        maxRetries: this.config.maxRetries,
        delayMs: this.config.retryDelayMs,
        logger: this.logger,
        operationName: "Login",
      }
    );
  }

  async navigateToNewResume(): Promise<void> {
    if (!this.page) throw new Error("Browser not initialized");

    this.logger.info("Navigating to New Resume page");

    await this.page.goto(`${this.config.baseUrl}/newresume`, {
      waitUntil: "networkidle",
      timeout: 30000,
    });

    await this.page.waitForSelector('input[name="first_name"]', {
      timeout: 15000,
    });

    await sleep(2000);
    this.logger.info("New Resume page loaded");
  }

  async waitForNewResume(): Promise<boolean> {
    if (!this.page) throw new Error("Browser not initialized");

    this.logger.info("Waiting for new resume to appear");

    try {
      await this.page.waitForSelector("iframe", { timeout: 30000 });
      await sleep(2000);

      const hasIframe = await this.page.$("iframe");
      if (hasIframe) {
        this.logger.info("New resume detected");
        return true;
      }

      return false;
    } catch {
      this.logger.warn("Timeout waiting for new resume");
      return false;
    }
  }

  async isSessionValid(): Promise<boolean> {
    if (!this.page) return false;

    try {
      const url = this.page.url();
      if (url.includes("/auth/signin")) {
        this.logger.warn("Session expired, need to re-login");
        return false;
      }
      return true;
    } catch {
      return false;
    }
  }

  async clickSkip(): Promise<boolean> {
    if (!this.page) return false;

    try {
      const skipBtn = await this.page.$('button:has-text("Skip")');
      if (skipBtn) {
        await skipBtn.click();
        this.logger.info("Clicked Skip button");
        await sleep(2000);
        return true;
      }
      return false;
    } catch {
      return false;
    }
  }

  getPage(): Page {
    if (!this.page) throw new Error("Browser not initialized");
    return this.page;
  }

  async screenshot(path: string): Promise<void> {
    if (this.page) {
      await this.page.screenshot({ path, fullPage: true });
    }
  }

  async close(): Promise<void> {
    if (this.context) await this.context.close();
    if (this.browser) await this.browser.close();
    this.logger.info("Browser session closed");
  }
}
