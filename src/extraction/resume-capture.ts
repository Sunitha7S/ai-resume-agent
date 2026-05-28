import type { Page, Frame } from "playwright";
import type winston from "winston";
import { sleep } from "../utils/retry.js";

export class ResumeCapture {
  private logger: winston.Logger;

  constructor(logger: winston.Logger) {
    this.logger = logger;
  }

  async captureResumeImages(page: Page): Promise<Buffer[]> {
    this.logger.info("Capturing resume images from page");

    const iframe = await this.findResumeIframe(page);
    if (iframe) {
      return this.captureFromIframe(page, iframe);
    }

    return this.captureFromResumePanel(page);
  }

  private async findResumeIframe(page: Page): Promise<Frame | null> {
    const frames = page.frames();
    for (const frame of frames) {
      const url = frame.url();
      if (
        url.includes(".pdf") ||
        url.includes("resume") ||
        url.includes("viewer")
      ) {
        this.logger.info("Found resume iframe", { url });
        return frame;
      }
    }

    const iframeHandle = await page.$("iframe").catch(() => null);
    if (iframeHandle) {
      const frame = await iframeHandle.contentFrame();
      if (frame) {
        this.logger.info("Found generic iframe, using as resume source");
        return frame;
      }
    }

    return null;
  }

  private async captureFromIframe(
    page: Page,
    iframe: Frame
  ): Promise<Buffer[]> {
    const images: Buffer[] = [];

    const pdfCanvases = await iframe.$$("canvas").catch(() => []);
    if (pdfCanvases.length > 0) {
      this.logger.info(`Found ${pdfCanvases.length} PDF canvas elements`);

      for (let i = 0; i < pdfCanvases.length; i++) {
        const canvas = pdfCanvases[i];
        const dataUrl = await iframe.evaluate((el) => {
          const c = el as HTMLCanvasElement;
          return c.toDataURL("image/png");
        }, canvas);

        const base64 = dataUrl.replace(/^data:image\/png;base64,/, "");
        images.push(Buffer.from(base64, "base64"));
        this.logger.debug(`Captured canvas ${i + 1}/${pdfCanvases.length}`);
      }

      return images;
    }

    const iframeElement = await page.$("iframe");
    if (iframeElement) {
      const screenshot = await iframeElement.screenshot({ type: "png" });
      images.push(screenshot);
      this.logger.info("Captured iframe screenshot");
    }

    return images;
  }

  private async captureFromResumePanel(page: Page): Promise<Buffer[]> {
    this.logger.info("Capturing resume from panel area");
    const images: Buffer[] = [];

    const resumeContainer = await page
      .$(
        [
          '[class*="resume"]',
          '[class*="pdf"]',
          '[class*="preview"]',
          '[id*="resume"]',
          '[id*="pdf"]',
        ].join(",")
      )
      .catch(() => null);

    if (resumeContainer) {
      const screenshot = await resumeContainer.screenshot({ type: "png" });
      images.push(screenshot);
      this.logger.info("Captured resume container screenshot");

      const scrollable = await this.isScrollable(page, resumeContainer);
      if (scrollable) {
        images.push(...(await this.captureWithScrolling(page, resumeContainer)));
      }

      return images;
    }

    const fullPage = await page.screenshot({ type: "png", fullPage: false });
    images.push(fullPage);
    this.logger.info("Captured full viewport as fallback");

    return images;
  }

  private async isScrollable(
    page: Page,
    element: ReturnType<Page["$"]> extends Promise<infer T> ? NonNullable<T> : never
  ): Promise<boolean> {
    return page.evaluate((el) => {
      return el.scrollHeight > el.clientHeight;
    }, element);
  }

  private async captureWithScrolling(
    page: Page,
    container: ReturnType<Page["$"]> extends Promise<infer T> ? NonNullable<T> : never
  ): Promise<Buffer[]> {
    const images: Buffer[] = [];

    const { scrollHeight, clientHeight } = await page.evaluate((el) => {
      return {
        scrollHeight: el.scrollHeight,
        clientHeight: el.clientHeight,
      };
    }, container);

    const scrollSteps = Math.ceil(scrollHeight / clientHeight);

    for (let i = 1; i < scrollSteps && i < 10; i++) {
      await page.evaluate(
        (args) => {
          const [el, scrollTop] = args;
          el.scrollTop = scrollTop;
        },
        [container, i * clientHeight] as const
      );

      await sleep(500);

      const screenshot = await container.screenshot({ type: "png" });
      images.push(screenshot);
      this.logger.debug(`Captured scroll position ${i + 1}/${scrollSteps}`);
    }

    await page.evaluate((el) => {
      el.scrollTop = 0;
    }, container);

    return images;
  }
}
