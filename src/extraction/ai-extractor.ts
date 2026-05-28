import OpenAI from "openai";
import type winston from "winston";
import { type ResumeData, EMPTY_RESUME } from "./types.js";
import { withRetry } from "../utils/retry.js";

const EXTRACTION_PROMPT = `You are an expert resume data extraction system. Analyze the resume image(s) provided and extract ALL information into the exact JSON structure below.

IMPORTANT RULES:
1. Extract data EXACTLY as written in the resume - do not infer or guess
2. For any field where information is NOT found in the resume, use "NA"
3. For names: split the full name into first_name, middle_name, last_name. If only two parts, middle_name = "NA"
4. For date_of_birth: use DD/MM/YYYY format if found
5. For gender: use "Male", "Female", or "Other"
6. For mobile: include country code if present (e.g., "+91 9876543210")
7. For education:
   - SSC = 10th standard / Secondary School Certificate / SSLC / Matriculation
   - HSC = 12th standard / Higher Secondary / PUC / Intermediate / Pre-University
   - Map diploma/ITI/polytechnic to the closest matching level
   - Result should be percentage, CGPA, or grade as stated
   - Board = examining board (CBSE, State Board name, University name)
   - Pass Year = year of passing only (e.g., "2018")
8. For work experience:
   - total_work_experience_in: "Month" or "Year"
   - total_work_experience_months: numeric value in months (convert years to months if needed)
   - number_of_companies_worked: count of distinct employers
   - last_employer: most recent employer name
9. For address: extract full street address, landmark separately, city, state, pincode separately
10. For languages_known: comma-separated list
11. For hobbies: comma-separated list
12. higher_education_qualification: any education beyond post graduation (PhD, M.Phil, etc.)

Return ONLY valid JSON matching this exact structure:
{
  "first_name": "",
  "middle_name": "",
  "last_name": "",
  "date_of_birth": "",
  "gender": "",
  "nationality": "",
  "marital_status": "",
  "passport": "",
  "hobbies": "",
  "languages_known": "",
  "address": "",
  "landmark": "",
  "city": "",
  "state": "",
  "pincode": "",
  "mobile": "",
  "email": "",
  "ssc_result": "",
  "ssc_board": "",
  "ssc_year_of_passing": "",
  "hsc_result": "",
  "hsc_board": "",
  "hsc_year_of_passing": "",
  "graduation_degree": "",
  "graduation_result": "",
  "graduation_university": "",
  "graduation_year_of_passing": "",
  "post_graduation_degree": "",
  "post_graduation_result": "",
  "post_graduation_university": "",
  "post_graduation_year_of_passing": "",
  "higher_education_qualification": "",
  "total_work_experience_in": "",
  "total_work_experience_months": "",
  "number_of_companies_worked": "",
  "last_employer": ""
}`;

export class AIResumeExtractor {
  private client: OpenAI;
  private logger: winston.Logger;
  private maxRetries: number;
  private retryDelayMs: number;

  constructor(
    apiKey: string,
    logger: winston.Logger,
    maxRetries: number = 3,
    retryDelayMs: number = 2000
  ) {
    this.client = new OpenAI({ apiKey });
    this.logger = logger;
    this.maxRetries = maxRetries;
    this.retryDelayMs = retryDelayMs;
  }

  async extractFromImages(imageBuffers: Buffer[]): Promise<ResumeData> {
    this.logger.info(`Extracting resume data from ${imageBuffers.length} image(s)`);

    const imageMessages: OpenAI.Chat.Completions.ChatCompletionContentPart[] =
      imageBuffers.map((buffer) => ({
        type: "image_url" as const,
        image_url: {
          url: `data:image/png;base64,${buffer.toString("base64")}`,
          detail: "high" as const,
        },
      }));

    return withRetry(
      async () => {
        const response = await this.client.chat.completions.create({
          model: "gpt-4o",
          messages: [
            {
              role: "system",
              content:
                "You are a precise resume data extraction assistant. Always return valid JSON.",
            },
            {
              role: "user",
              content: [
                { type: "text", text: EXTRACTION_PROMPT },
                ...imageMessages,
              ],
            },
          ],
          max_tokens: 4096,
          temperature: 0.1,
          response_format: { type: "json_object" },
        });

        const content = response.choices[0]?.message?.content;
        if (!content) {
          throw new Error("Empty response from OpenAI");
        }

        this.logger.debug("Raw AI response", { content });
        return this.parseResponse(content);
      },
      {
        maxRetries: this.maxRetries,
        delayMs: this.retryDelayMs,
        logger: this.logger,
        operationName: "AI extraction",
      }
    );
  }

  async extractFromText(resumeText: string): Promise<ResumeData> {
    this.logger.info("Extracting resume data from text");

    return withRetry(
      async () => {
        const response = await this.client.chat.completions.create({
          model: "gpt-4o",
          messages: [
            {
              role: "system",
              content:
                "You are a precise resume data extraction assistant. Always return valid JSON.",
            },
            {
              role: "user",
              content: `${EXTRACTION_PROMPT}\n\nRESUME TEXT:\n${resumeText}`,
            },
          ],
          max_tokens: 4096,
          temperature: 0.1,
          response_format: { type: "json_object" },
        });

        const content = response.choices[0]?.message?.content;
        if (!content) {
          throw new Error("Empty response from OpenAI");
        }

        return this.parseResponse(content);
      },
      {
        maxRetries: this.maxRetries,
        delayMs: this.retryDelayMs,
        logger: this.logger,
        operationName: "AI text extraction",
      }
    );
  }

  private parseResponse(content: string): ResumeData {
    const parsed = JSON.parse(content) as Record<string, unknown>;
    const result = { ...EMPTY_RESUME };

    for (const key of Object.keys(result) as (keyof ResumeData)[]) {
      const value = parsed[key];
      if (typeof value === "string" && value.trim().length > 0) {
        result[key] = value.trim();
      }
    }

    this.logger.info("Successfully extracted resume data", {
      fieldsFound: Object.entries(result).filter(([, v]) => v !== "NA").length,
      totalFields: Object.keys(result).length,
    });

    return result;
  }
}
