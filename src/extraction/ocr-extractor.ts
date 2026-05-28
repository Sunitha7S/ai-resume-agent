import Tesseract from "tesseract.js";
import sharp from "sharp";
import type winston from "winston";

export class OCRExtractor {
  private logger: winston.Logger;

  constructor(logger: winston.Logger) {
    this.logger = logger;
  }

  async extractText(imageBuffer: Buffer): Promise<string> {
    this.logger.info("Starting OCR text extraction");

    const preprocessed = await this.preprocessImage(imageBuffer);

    const {
      data: { text, confidence },
    } = await Tesseract.recognize(preprocessed, "eng", {
      logger: (m) => {
        if (typeof m === "object" && m !== null && "status" in m) {
          const msg = m as { status: string; progress?: number };
          if (msg.status === "recognizing text" && msg.progress !== undefined) {
            this.logger.debug(`OCR progress: ${(msg.progress * 100).toFixed(1)}%`);
          }
        }
      },
    });

    this.logger.info("OCR extraction complete", {
      confidence: confidence.toFixed(1),
      textLength: text.length,
    });

    return text;
  }

  async extractTextFromMultipleImages(
    imageBuffers: Buffer[]
  ): Promise<string> {
    const results: string[] = [];

    for (let i = 0; i < imageBuffers.length; i++) {
      this.logger.info(`Processing image ${i + 1}/${imageBuffers.length}`);
      const text = await this.extractText(imageBuffers[i]);
      results.push(text);
    }

    return results.join("\n\n--- Page Break ---\n\n");
  }

  private async preprocessImage(imageBuffer: Buffer): Promise<Buffer> {
    try {
      return await sharp(imageBuffer)
        .greyscale()
        .normalize()
        .sharpen()
        .resize({ width: 2400, withoutEnlargement: true })
        .png()
        .toBuffer();
    } catch (error) {
      this.logger.warn("Image preprocessing failed, using original", {
        error: error instanceof Error ? error.message : String(error),
      });
      return imageBuffer;
    }
  }
}
