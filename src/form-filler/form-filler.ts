import type { Page } from "playwright";
import type winston from "winston";
import type { ResumeData } from "../extraction/types.js";
import { FORM_FIELD_MAPPINGS, type FormFieldMapping } from "./field-map.js";
import { randomDelay, sleep } from "../utils/retry.js";
import type { AgentConfig } from "../utils/config.js";

export interface FillResult {
  field: string;
  value: string;
  success: boolean;
  error?: string;
}

export class FormFiller {
  private page: Page;
  private logger: winston.Logger;
  private config: AgentConfig;

  constructor(page: Page, logger: winston.Logger, config: AgentConfig) {
    this.page = page;
    this.logger = logger;
    this.config = config;
  }

  async fillForm(resumeData: ResumeData): Promise<FillResult[]> {
    this.logger.info("Starting form fill");
    const results: FillResult[] = [];

    const formContainer = await this.page
      .$('div[class*="overflow-y-auto"], div[style*="overflow"]')
      .catch(() => null);

    for (const mapping of FORM_FIELD_MAPPINGS) {
      const value = resumeData[mapping.resumeField];
      const result = await this.fillField(mapping, value, formContainer);
      results.push(result);

      if (this.config.humanLikeDelay) {
        await randomDelay(this.config.minDelayMs, this.config.maxDelayMs);
      }
    }

    const filled = results.filter((r) => r.success).length;
    const failed = results.filter((r) => !r.success).length;
    this.logger.info(`Form fill complete: ${filled} filled, ${failed} failed`);

    return results;
  }

  private async fillField(
    mapping: FormFieldMapping,
    value: string,
    scrollContainer: Awaited<ReturnType<Page["$"]>>
  ): Promise<FillResult> {
    const { inputName, inputType, label } = mapping;

    try {
      const selector = inputType === "select"
        ? `select[name="${inputName}"]`
        : `input[name="${inputName}"]`;

      await this.scrollToElement(selector, scrollContainer);
      await sleep(100);

      const element = await this.page.$(selector);
      if (!element) {
        this.logger.warn(`Field not found: ${inputName}`);
        return { field: inputName, value, success: false, error: "Element not found" };
      }

      if (inputType === "select") {
        await this.fillSelect(selector, value);
      } else {
        await this.fillInput(selector, value);
      }

      this.logger.debug(`Filled ${label}: "${value}"`);
      return { field: inputName, value, success: true };
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      this.logger.error(`Failed to fill ${label}`, { error: errorMsg });
      return { field: inputName, value, success: false, error: errorMsg };
    }
  }

  private async fillInput(selector: string, value: string): Promise<void> {
    await this.page.click(selector);
    await sleep(50);

    await this.page.evaluate((sel: string) => {
      const input = document.querySelector(sel) as HTMLInputElement | null;
      if (input) {
        input.value = "";
        input.dispatchEvent(new Event("input", { bubbles: true }));
      }
    }, selector);

    await this.page.fill(selector, value);

    await this.page.evaluate((sel: string) => {
      const input = document.querySelector(sel) as HTMLInputElement | null;
      if (input) {
        input.dispatchEvent(new Event("input", { bubbles: true }));
        input.dispatchEvent(new Event("change", { bubbles: true }));
        input.dispatchEvent(new Event("blur", { bubbles: true }));
      }
    }, selector);
  }

  private async fillSelect(selector: string, value: string): Promise<void> {
    const normalizedValue = value.toLowerCase();

    if (normalizedValue === "na" || normalizedValue === "") {
      return;
    }

    const options = await this.page.$$eval(
      `${selector} option`,
      (opts) => opts.map((o) => ({ value: (o as HTMLOptionElement).value, text: o.textContent ?? "" }))
    );

    let matchValue = "";
    for (const opt of options) {
      if (
        opt.value.toLowerCase() === normalizedValue ||
        opt.text.toLowerCase().trim() === normalizedValue
      ) {
        matchValue = opt.value;
        break;
      }
    }

    if (!matchValue) {
      for (const opt of options) {
        if (
          opt.value.toLowerCase().includes(normalizedValue) ||
          opt.text.toLowerCase().includes(normalizedValue) ||
          normalizedValue.includes(opt.value.toLowerCase())
        ) {
          matchValue = opt.value;
          break;
        }
      }
    }

    if (matchValue) {
      await this.page.selectOption(selector, matchValue);
      this.logger.debug(`Selected option: ${matchValue}`);
    } else {
      this.logger.warn(`No matching option for "${value}" in ${selector}`);
    }
  }

  private async scrollToElement(
    selector: string,
    scrollContainer: Awaited<ReturnType<Page["$"]>>
  ): Promise<void> {
    const element = await this.page.$(selector);
    if (!element) return;

    if (scrollContainer) {
      await this.page.evaluate(
        (args) => {
          const [sel, containerEl] = args;
          const el = document.querySelector(sel as string);
          if (el && containerEl) {
            const elRect = el.getBoundingClientRect();
            const containerRect = (containerEl as Element).getBoundingClientRect();
            if (
              elRect.top < containerRect.top ||
              elRect.bottom > containerRect.bottom
            ) {
              el.scrollIntoView({ behavior: "smooth", block: "center" });
            }
          }
        },
        [selector, scrollContainer] as const
      );
    } else {
      await element.scrollIntoViewIfNeeded();
    }

    await sleep(200);
  }

  async clickSaveResume(): Promise<boolean> {
    try {
      const saveBtn = await this.page.$('button:has-text("Save Resume")');
      if (saveBtn) {
        await saveBtn.click();
        this.logger.info("Clicked Save Resume");
        await sleep(2000);
        return true;
      }
      this.logger.warn("Save Resume button not found");
      return false;
    } catch (error) {
      this.logger.error("Failed to click Save Resume", {
        error: error instanceof Error ? error.message : String(error),
      });
      return false;
    }
  }

  async clickSubmitResume(): Promise<boolean> {
    try {
      const submitBtn = await this.page.$('button:has-text("Submit Resume")');
      if (submitBtn) {
        await submitBtn.click();
        this.logger.info("Clicked Submit Resume");
        await sleep(3000);
        return true;
      }
      this.logger.warn("Submit Resume button not found");
      return false;
    } catch (error) {
      this.logger.error("Failed to click Submit Resume", {
        error: error instanceof Error ? error.message : String(error),
      });
      return false;
    }
  }

  async handlePostSubmitDialog(): Promise<void> {
    try {
      const dialog = await this.page
        .$('[role="dialog"], [class*="modal"], [class*="alert"]')
        .catch(() => null);

      if (dialog) {
        const okButton = await dialog
          .$('button:has-text("OK"), button:has-text("Yes"), button:has-text("Confirm")')
          .catch(() => null);

        if (okButton) {
          await okButton.click();
          this.logger.info("Dismissed post-submit dialog");
          await sleep(1000);
        }
      }
    } catch (error) {
      this.logger.debug("No post-submit dialog found", {
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }
}
