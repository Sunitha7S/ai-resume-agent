# AI Resume Data Entry Agent

Fully autonomous AI-powered resume data entry agent for [dashboard.datasort.in/newresume](https://dashboard.datasort.in/newresume). The system reads resume PDFs displayed on the dashboard, extracts all relevant information using OpenAI Vision, and automatically fills the form fields with human-like interaction.

## Architecture

```
ai-resume-agent/
├── src/
│   ├── index.ts                    # Main entry point
│   ├── core/
│   │   ├── agent.ts                # Main orchestrator
│   │   └── browser-session.ts      # Playwright browser management
│   ├── extraction/
│   │   ├── ai-extractor.ts         # OpenAI Vision extraction
│   │   ├── ocr-extractor.ts        # Tesseract.js OCR fallback
│   │   ├── resume-capture.ts       # Resume image capture from page
│   │   └── types.ts                # Resume data types & field definitions
│   ├── form-filler/
│   │   ├── form-filler.ts          # Intelligent form filling engine
│   │   └── field-map.ts            # Form field → resume data mapping
│   ├── chrome-extension/
│   │   ├── manifest.json           # Chrome Extension manifest v3
│   │   ├── popup/                  # Extension popup UI
│   │   ├── background/             # Service worker
│   │   └── content/                # Content script (in-page agent)
│   └── utils/
│       ├── config.ts               # Configuration management
│       ├── logger.ts               # Winston logging
│       └── retry.ts                # Retry logic with backoff
├── scripts/
│   ├── setup.sh                    # Automated setup
│   └── generate-icons.js           # Extension icon generator
├── .env.example                    # Configuration template
├── package.json
└── tsconfig.json
```

## How It Works

### Processing Pipeline

1. **Login** → Authenticates with DataSort dashboard
2. **Navigate** → Opens the New Resume page
3. **Capture** → Extracts resume images from the PDF viewer iframe (canvas capture)
4. **Extract** → Sends images to OpenAI GPT-4o Vision for structured data extraction
5. **OCR Fallback** → If Vision fails, uses Tesseract.js OCR → GPT-4o text extraction
6. **Fill** → Fills all 36 form fields with human-like delays and scroll handling
7. **Submit** → Clicks Submit Resume (or Save Resume as fallback)
8. **Repeat** → In continuous mode, waits for next resume and loops

### Form Fields Covered (36 total)

| Section | Fields |
|---------|--------|
| **Personal** | First Name, Middle Name, Last Name, DOB, Gender, Nationality, Marital Status, Passport, Hobbies, Languages |
| **Communication** | Address, Landmark, City, State, Pincode, Mobile, Email |
| **Qualification** | SSC (Result/Board/Year), HSC (Result/Board/Year), Graduation (Degree/Result/University/Year), Post Graduation (Degree/Result/University/Year), Higher Education |
| **Employment** | Experience Type, Experience Duration, Companies Count, Last Employer |

## Two Deployment Modes

### 1. Playwright Agent (Headless/Headed)

Standalone Node.js application using Playwright for full browser automation. Best for server-side batch processing.

```bash
# Single resume
npm start

# Continuous processing
npm run start:continuous
```

### 2. Chrome Extension (Browser-Based)

Install as a Chrome extension for in-browser operation. Best for manual workflows with AI assistance.

1. Open `chrome://extensions`
2. Enable **Developer mode**
3. Click **Load unpacked** → select `src/chrome-extension/`
4. Navigate to `dashboard.datasort.in/newresume`
5. Click the extension icon → enter your OpenAI API key → **Start Autofill**

## Quick Start

### Prerequisites

- Node.js 18+
- OpenAI API key (with GPT-4o access)
- DataSort dashboard credentials

### Installation

```bash
# Clone the repository
git clone <repo-url>
cd ai-resume-agent

# Run setup (installs deps, builds, generates icons)
bash scripts/setup.sh

# Configure credentials
cp .env.example .env
# Edit .env with your API key and DataSort credentials
```

### Configuration (.env)

```env
OPENAI_API_KEY=sk-your-key-here
DATASORT_USER_ID=your-user-id
DATASORT_PASSWORD=your-password

# Agent behavior
HEADLESS=false                # true for headless browser
CONTINUOUS_MODE=true          # Auto-process next resume
HUMAN_LIKE_DELAY=true         # Random delays between actions
SUBMIT_AFTER_FILL=true        # Auto-submit after filling
USE_OCR_FALLBACK=true         # Tesseract.js fallback

# Timing
MIN_DELAY_MS=200
MAX_DELAY_MS=800

# Retry
MAX_RETRIES=3
RETRY_DELAY_MS=2000

# Logging
LOG_LEVEL=info
LOG_FILE=logs/agent.log
```

### Running

```bash
# Build
npm run build

# Run (single resume)
npm start

# Run (continuous mode)
npm run start:continuous

# Type-check only
npm run lint
```

## AI Extraction Details

### OpenAI Vision (Primary)

- Uses GPT-4o with `detail: "high"` for maximum accuracy
- Sends resume page images captured from the PDF viewer canvas
- Structured JSON output with `response_format: json_object`
- Semantic field mapping (e.g., SSLC → SSC, PUC → HSC)
- Temperature 0.1 for consistent extraction

### OCR Fallback (Tesseract.js)

When OpenAI Vision is unavailable:
1. Image preprocessing with Sharp (greyscale, normalize, sharpen, upscale)
2. Tesseract.js OCR text extraction
3. Extracted text sent to GPT-4o for structured parsing

### Accuracy Targets

- 90-95% autofill accuracy across real-world resumes
- Handles diverse resume formats, layouts, and designs
- Supports scanned/image-based resumes via OCR
- "NA" fallback ensures all fields are always filled

## Error Recovery

- **Session expiry** → Automatic re-login
- **Network errors** → Exponential backoff retry (configurable)
- **AI extraction failure** → OCR fallback pipeline
- **Form fill errors** → Per-field error handling, continues with remaining fields
- **Browser crash** → Full re-initialization
- **Dialog handling** → Auto-accepts confirmation dialogs

## Logging

Structured JSON logging via Winston:

- `logs/agent.log` — All logs (rotated at 10MB, 5 files)
- `logs/error.log` — Errors only
- Console — Colorized real-time output
- Chrome Extension — In-popup log viewer

## Production Deployment

### Server Deployment

```bash
# Install PM2
npm install -g pm2

# Start with PM2
pm2 start dist/index.js --name resume-agent -- --continuous

# Monitor
pm2 logs resume-agent
pm2 monit
```

### Docker

```dockerfile
FROM node:20-slim
RUN npx playwright install --with-deps chromium
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build
CMD ["node", "dist/index.js", "--continuous"]
```

### Environment Variables for Production

Set these in your hosting environment instead of `.env`:

```bash
export OPENAI_API_KEY="sk-..."
export DATASORT_USER_ID="..."
export DATASORT_PASSWORD="..."
export HEADLESS=true
export CONTINUOUS_MODE=true
export LOG_LEVEL=info
```

## Tech Stack

- **TypeScript** — Type-safe codebase
- **Playwright** — Browser automation
- **OpenAI GPT-4o** — Vision-based resume extraction
- **Tesseract.js** — OCR fallback
- **Sharp** — Image preprocessing
- **Winston** — Structured logging
- **Chrome Extension (Manifest V3)** — Browser integration

## License

ISC
