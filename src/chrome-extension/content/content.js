/* global chrome */

/**
 * AI Resume Data Entry Agent - Content Script
 * Runs on dashboard.datasort.in/newresume
 */

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
   - Result should be percentage, CGPA, or grade as stated
   - Board = examining board (CBSE, State Board name, University name)
   - Pass Year = year of passing only
8. For work experience:
   - total_work_experience_in: "Month" or "Year"
   - total_work_experience_months: numeric value in months
   - number_of_companies_worked: count of distinct employers
   - last_employer: most recent employer name
9. For address: extract full street address, landmark separately, city, state, pincode separately
10. For languages_known: comma-separated list
11. For hobbies: comma-separated list
12. higher_education_qualification: any education beyond post graduation

Return ONLY valid JSON matching this structure:
{
  "first_name": "", "middle_name": "", "last_name": "", "date_of_birth": "",
  "gender": "", "nationality": "", "marital_status": "", "passport": "",
  "hobbies": "", "languages_known": "", "address": "", "landmark": "",
  "city": "", "state": "", "pincode": "", "mobile": "", "email": "",
  "ssc_result": "", "ssc_board": "", "ssc_year_of_passing": "",
  "hsc_result": "", "hsc_board": "", "hsc_year_of_passing": "",
  "graduation_degree": "", "graduation_result": "", "graduation_university": "",
  "graduation_year_of_passing": "", "post_graduation_degree": "",
  "post_graduation_result": "", "post_graduation_university": "",
  "post_graduation_year_of_passing": "", "higher_education_qualification": "",
  "total_work_experience_in": "", "total_work_experience_months": "",
  "number_of_companies_worked": "", "last_employer": ""
}`;

const FORM_FIELDS = [
  { name: "first_name", type: "text" },
  { name: "middle_name", type: "text" },
  { name: "last_name", type: "text" },
  { name: "date_of_birth", type: "text" },
  { name: "gender", type: "text" },
  { name: "nationality", type: "text" },
  { name: "marital_status", type: "text" },
  { name: "passport", type: "text" },
  { name: "hobbies", type: "text" },
  { name: "languages_known", type: "text" },
  { name: "address", type: "text" },
  { name: "landmark", type: "text" },
  { name: "city", type: "text" },
  { name: "state", type: "text" },
  { name: "pincode", type: "text" },
  { name: "mobile", type: "text" },
  { name: "email", type: "email" },
  { name: "ssc_result", type: "text" },
  { name: "ssc_board", type: "text" },
  { name: "ssc_year_of_passing", type: "text" },
  { name: "hsc_result", type: "text" },
  { name: "hsc_board", type: "text" },
  { name: "hsc_year_of_passing", type: "text" },
  { name: "graduation_degree", type: "text" },
  { name: "graduation_result", type: "text" },
  { name: "graduation_university", type: "text" },
  { name: "graduation_year_of_passing", type: "text" },
  { name: "post_graduation_degree", type: "text" },
  { name: "post_graduation_result", type: "text" },
  { name: "post_graduation_university", type: "text" },
  { name: "post_graduation_year_of_passing", type: "text" },
  { name: "higher_education_qualification", type: "text" },
  { name: "total_work_experience_In", key: "total_work_experience_in", type: "select" },
  { name: "total_work_experience_months", type: "text" },
  { name: "number_of_companies_worked", type: "text" },
  { name: "last_employer", type: "text" },
];

let isRunning = false;
let resumeCount = 0;
let overlay = null;

// --- Utility Functions ---

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function randomDelay(min = 150, max = 600) {
  return sleep(Math.floor(Math.random() * (max - min + 1)) + min);
}

function log(message, level = "info") {
  const prefix = "[AI Resume Agent]";
  if (level === "error") console.error(prefix, message);
  else if (level === "warn") console.warn(prefix, message);
  else console.log(prefix, message);

  chrome.runtime.sendMessage({ type: "LOG", message, level }).catch(() => {});
  updateOverlay(message);
}

function updateStatus(step, count) {
  chrome.runtime
    .sendMessage({ type: "STATUS_UPDATE", step, resumeCount: count })
    .catch(() => {});
}

// --- Overlay UI ---

function createOverlay() {
  if (overlay) overlay.remove();

  overlay = document.createElement("div");
  overlay.className = "ai-agent-overlay";
  overlay.innerHTML = `
    <div class="title">AI Resume Agent</div>
    <div class="status" id="agentStatus">Initializing...</div>
    <div class="progress-bar"><div class="progress-fill" id="agentProgress" style="width:0%"></div></div>
  `;
  document.body.appendChild(overlay);
}

function updateOverlay(message) {
  const statusEl = document.getElementById("agentStatus");
  if (statusEl) statusEl.textContent = message;
}

function updateProgress(percent) {
  const progressEl = document.getElementById("agentProgress");
  if (progressEl) progressEl.style.width = `${percent}%`;
}

function removeOverlay() {
  if (overlay) {
    overlay.remove();
    overlay = null;
  }
}

// --- Resume Image Capture ---

async function captureResumeImages() {
  log("Capturing resume images...");
  const images = [];

  // Try to find the iframe containing the resume PDF
  const iframes = document.querySelectorAll("iframe");
  for (const iframe of iframes) {
    try {
      const iframeDoc = iframe.contentDocument || iframe.contentWindow?.document;
      if (!iframeDoc) continue;

      // Look for canvas elements (PDF.js renders to canvas)
      const canvases = iframeDoc.querySelectorAll("canvas");
      for (const canvas of canvases) {
        const dataUrl = canvas.toDataURL("image/png");
        images.push(dataUrl);
        log(`Captured canvas from iframe (${canvas.width}x${canvas.height})`);
      }

      // If no canvases, try to capture the whole iframe content as image
      if (canvases.length === 0) {
        const img = iframeDoc.querySelector("img");
        if (img) {
          const canvas = document.createElement("canvas");
          canvas.width = img.naturalWidth || img.width;
          canvas.height = img.naturalHeight || img.height;
          const ctx = canvas.getContext("2d");
          ctx.drawImage(img, 0, 0);
          images.push(canvas.toDataURL("image/png"));
          log("Captured image from iframe");
        }
      }
    } catch (e) {
      log(`Cannot access iframe (cross-origin): ${e.message}`, "warn");
    }
  }

  // Fallback: capture the resume panel area via html2canvas-like approach
  if (images.length === 0) {
    log("No iframe images found, attempting page screenshot capture", "warn");

    // Look for the resume container
    const resumePanel = document.querySelector(
      '[class*="resume"], [class*="pdf"], [class*="preview"]'
    );
    if (resumePanel) {
      // Use a canvas-based capture approach
      try {
        const canvas = document.createElement("canvas");
        const rect = resumePanel.getBoundingClientRect();
        canvas.width = rect.width * 2;
        canvas.height = rect.height * 2;
        // Note: For cross-origin iframes, we'll rely on the OpenAI OCR-from-page approach
        log("Resume panel found but cannot capture directly - will use page text", "warn");
      } catch (e) {
        log(`Canvas capture failed: ${e.message}`, "error");
      }
    }
  }

  return images;
}

// --- Text Extraction from Resume Panel ---

function extractResumeText() {
  log("Extracting text from resume panel...");
  let text = "";

  // Try iframe text
  const iframes = document.querySelectorAll("iframe");
  for (const iframe of iframes) {
    try {
      const iframeDoc = iframe.contentDocument || iframe.contentWindow?.document;
      if (iframeDoc) {
        text += iframeDoc.body.innerText || "";
      }
    } catch (e) {
      log(`Cannot access iframe text: ${e.message}`, "warn");
    }
  }

  // Also look for any visible resume text in the page
  if (!text) {
    const resumeContainer = document.querySelector(
      'div[class*="resume"], div[class*="pdf"], div[class*="preview"]'
    );
    if (resumeContainer) {
      text = resumeContainer.innerText || "";
    }
  }

  return text;
}

// --- OpenAI API Call ---

async function callOpenAI(apiKey, images, text) {
  log("Sending to OpenAI for extraction...");

  const content = [{ type: "text", text: EXTRACTION_PROMPT }];

  // Add images if available
  for (const imgDataUrl of images) {
    content.push({
      type: "image_url",
      image_url: { url: imgDataUrl, detail: "high" },
    });
  }

  // If no images, add text
  if (images.length === 0 && text) {
    content[0].text += `\n\nRESUME TEXT:\n${text}`;
  }

  const payload = {
    model: "gpt-4o",
    messages: [
      {
        role: "system",
        content:
          "You are a precise resume data extraction assistant. Always return valid JSON.",
      },
      { role: "user", content },
    ],
    max_tokens: 4096,
    temperature: 0.1,
    response_format: { type: "json_object" },
  };

  return new Promise((resolve, reject) => {
    chrome.runtime.sendMessage(
      { type: "CALL_OPENAI", apiKey, payload },
      (response) => {
        if (chrome.runtime.lastError) {
          reject(new Error(chrome.runtime.lastError.message));
          return;
        }
        if (response.success) {
          resolve(response.data);
        } else {
          reject(new Error(response.error));
        }
      }
    );
  });
}

// --- Form Filling ---

function setNativeValue(element, value) {
  const valueSetter =
    Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, "value")
      ?.set ||
    Object.getOwnPropertyDescriptor(window.HTMLTextAreaElement.prototype, "value")
      ?.set;

  if (valueSetter) {
    valueSetter.call(element, value);
  } else {
    element.value = value;
  }

  element.dispatchEvent(new Event("input", { bubbles: true }));
  element.dispatchEvent(new Event("change", { bubbles: true }));
}

async function fillField(fieldName, value, type, useDelay) {
  const selector =
    type === "select"
      ? `select[name="${fieldName}"]`
      : `input[name="${fieldName}"]`;

  const element = document.querySelector(selector);
  if (!element) {
    log(`Field not found: ${fieldName}`, "warn");
    return false;
  }

  // Scroll into view
  element.scrollIntoView({ behavior: "smooth", block: "center" });
  await sleep(200);

  // Highlight the field
  element.classList.add("ai-agent-highlight");

  try {
    if (type === "select") {
      if (value && value.toLowerCase() !== "na") {
        const options = element.querySelectorAll("option");
        let matched = false;
        for (const opt of options) {
          if (
            opt.value.toLowerCase() === value.toLowerCase() ||
            opt.textContent.toLowerCase().trim() === value.toLowerCase()
          ) {
            element.value = opt.value;
            element.dispatchEvent(new Event("change", { bubbles: true }));
            matched = true;
            break;
          }
        }
        if (!matched) {
          // Try partial match
          for (const opt of options) {
            if (
              opt.value.toLowerCase().includes(value.toLowerCase()) ||
              value.toLowerCase().includes(opt.value.toLowerCase())
            ) {
              element.value = opt.value;
              element.dispatchEvent(new Event("change", { bubbles: true }));
              break;
            }
          }
        }
      }
    } else {
      // Click to focus
      element.focus();
      element.click();
      await sleep(50);

      // Clear existing value
      element.value = "";
      setNativeValue(element, value);
    }

    element.classList.remove("ai-agent-highlight");
    element.classList.add("ai-agent-filled");
    setTimeout(() => element.classList.remove("ai-agent-filled"), 2000);

    if (useDelay) await randomDelay();

    return true;
  } catch (e) {
    element.classList.remove("ai-agent-highlight");
    element.classList.add("ai-agent-error");
    setTimeout(() => element.classList.remove("ai-agent-error"), 2000);
    log(`Error filling ${fieldName}: ${e.message}`, "error");
    return false;
  }
}

async function fillAllFields(data, useDelay) {
  let filled = 0;
  const total = FORM_FIELDS.length;

  for (let i = 0; i < FORM_FIELDS.length; i++) {
    const field = FORM_FIELDS[i];
    const dataKey = field.key || field.name;
    const value = data[dataKey] || "NA";

    updateProgress(((i + 1) / total) * 100);
    updateStatus(`Filling: ${field.name}`, resumeCount);

    const success = await fillField(field.name, value, field.type, useDelay);
    if (success) filled++;
  }

  return { filled, total };
}

// --- Main Agent Logic ---

async function processResume(config) {
  if (!isRunning) return;

  resumeCount++;
  log(`Processing resume #${resumeCount}`);
  updateStatus("Capturing resume", resumeCount);

  try {
    // Step 1: Capture resume images
    const images = await captureResumeImages();

    // Step 2: Extract text fallback
    const text = extractResumeText();

    if (images.length === 0 && !text) {
      log("No resume content found to extract", "error");
      return;
    }

    // Step 3: Call OpenAI for extraction
    updateStatus("AI extraction", resumeCount);
    const response = await callOpenAI(config.apiKey, images, text);
    const content = response.choices?.[0]?.message?.content;

    if (!content) {
      log("Empty response from OpenAI", "error");
      return;
    }

    const resumeData = JSON.parse(content);
    log(
      `Extracted ${Object.values(resumeData).filter((v) => v && v !== "NA").length} fields`
    );

    // Step 4: Fill the form
    updateStatus("Filling form", resumeCount);
    const { filled, total } = await fillAllFields(resumeData, config.humanDelay);
    log(`Filled ${filled}/${total} fields successfully`);

    // Step 5: Submit if configured
    if (config.autoSubmit) {
      updateStatus("Submitting", resumeCount);
      await sleep(1000);

      const submitBtn = document.querySelector(
        'button:has-text("Submit Resume")'
      ) || Array.from(document.querySelectorAll("button")).find((b) =>
        b.textContent?.includes("Submit Resume")
      );

      if (submitBtn) {
        submitBtn.click();
        log("Resume submitted!", "success");
        await sleep(3000);
      } else {
        // Try save instead
        const saveBtn = Array.from(document.querySelectorAll("button")).find(
          (b) => b.textContent?.includes("Save Resume")
        );
        if (saveBtn) {
          saveBtn.click();
          log("Resume saved (submit button not found)", "info");
          await sleep(2000);
        }
      }
    }

    updateStatus("Complete", resumeCount);
    log(`Resume #${resumeCount} processed successfully`, "success");

    // Step 6: Continue if in continuous mode
    if (config.continuousMode && isRunning) {
      log("Waiting for next resume...");
      await sleep(5000);
      window.location.reload();
    }
  } catch (error) {
    log(`Error processing resume: ${error.message}`, "error");
    updateStatus("Error", resumeCount);
  }
}

// --- Message Handlers ---

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message.action === "START_AUTOFILL") {
    isRunning = true;
    createOverlay();
    processResume(message.config);
    sendResponse({ success: true });
  }

  if (message.action === "STOP_AUTOFILL") {
    isRunning = false;
    removeOverlay();
    chrome.runtime.sendMessage({ type: "AGENT_STOPPED" }).catch(() => {});
    sendResponse({ success: true });
  }

  if (message.action === "SKIP_RESUME") {
    const skipBtn =
      document.querySelector('button:has-text("Skip")') ||
      Array.from(document.querySelectorAll("button")).find((b) =>
        b.textContent?.includes("Skip")
      );
    if (skipBtn) skipBtn.click();
    sendResponse({ success: true });
  }

  if (message.action === "PAGE_READY" && isRunning) {
    chrome.storage.local.get(["apiKey", "autoSubmit", "humanDelay", "continuousMode"], (data) => {
      if (data.apiKey) {
        processResume({
          apiKey: data.apiKey,
          autoSubmit: data.autoSubmit !== false,
          humanDelay: data.humanDelay !== false,
          continuousMode: data.continuousMode || false,
        });
      }
    });
    sendResponse({ success: true });
  }

  return true;
});

log("Content script loaded on DataSort dashboard");
