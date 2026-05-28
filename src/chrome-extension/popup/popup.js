/* global chrome */

const apiKeyInput = document.getElementById("apiKey");
const autoSubmitToggle = document.getElementById("autoSubmit");
const continuousModeToggle = document.getElementById("continuousMode");
const humanDelayToggle = document.getElementById("humanDelay");
const startBtn = document.getElementById("startBtn");
const stopBtn = document.getElementById("stopBtn");
const skipBtn = document.getElementById("skipBtn");
const statusValue = document.getElementById("statusValue");
const resumeCount = document.getElementById("resumeCount");
const currentStep = document.getElementById("currentStep");
const logArea = document.getElementById("logArea");

// Load saved settings
chrome.storage.local.get(
  ["apiKey", "autoSubmit", "continuousMode", "humanDelay", "resumeCount"],
  (data) => {
    if (data.apiKey) apiKeyInput.value = data.apiKey;
    if (data.autoSubmit !== undefined) autoSubmitToggle.checked = data.autoSubmit;
    if (data.continuousMode !== undefined)
      continuousModeToggle.checked = data.continuousMode;
    if (data.humanDelay !== undefined) humanDelayToggle.checked = data.humanDelay;
    if (data.resumeCount) resumeCount.textContent = data.resumeCount;
  }
);

// Save settings on change
[apiKeyInput, autoSubmitToggle, continuousModeToggle, humanDelayToggle].forEach(
  (el) => {
    el.addEventListener("change", () => {
      chrome.storage.local.set({
        apiKey: apiKeyInput.value,
        autoSubmit: autoSubmitToggle.checked,
        continuousMode: continuousModeToggle.checked,
        humanDelay: humanDelayToggle.checked,
      });
    });
  }
);

function addLog(message, type = "info") {
  const entry = document.createElement("div");
  entry.className = `log-entry ${type}`;
  const time = new Date().toLocaleTimeString();
  entry.textContent = `[${time}] ${message}`;
  logArea.prepend(entry);

  while (logArea.children.length > 50) {
    logArea.removeChild(logArea.lastChild);
  }
}

startBtn.addEventListener("click", async () => {
  const apiKey = apiKeyInput.value.trim();
  if (!apiKey) {
    addLog("API key is required", "error");
    return;
  }

  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });

  if (!tab.url || !tab.url.includes("dashboard.datasort.in")) {
    addLog("Navigate to dashboard.datasort.in/newresume first", "error");
    return;
  }

  startBtn.style.display = "none";
  stopBtn.style.display = "block";
  statusValue.textContent = "Running";
  statusValue.className = "status-value active";

  chrome.tabs.sendMessage(tab.id, {
    action: "START_AUTOFILL",
    config: {
      apiKey,
      autoSubmit: autoSubmitToggle.checked,
      continuousMode: continuousModeToggle.checked,
      humanDelay: humanDelayToggle.checked,
    },
  });

  addLog("Agent started", "success");
});

stopBtn.addEventListener("click", async () => {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  chrome.tabs.sendMessage(tab.id, { action: "STOP_AUTOFILL" });

  stopBtn.style.display = "none";
  startBtn.style.display = "block";
  statusValue.textContent = "Stopped";
  statusValue.className = "status-value inactive";

  addLog("Agent stopped", "info");
});

skipBtn.addEventListener("click", async () => {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  chrome.tabs.sendMessage(tab.id, { action: "SKIP_RESUME" });
  addLog("Skipping current resume", "info");
});

// Listen for status updates from content script
chrome.runtime.onMessage.addListener((message) => {
  if (message.type === "STATUS_UPDATE") {
    currentStep.textContent = message.step || "-";
    if (message.resumeCount !== undefined) {
      resumeCount.textContent = message.resumeCount;
      chrome.storage.local.set({ resumeCount: message.resumeCount });
    }
  }

  if (message.type === "LOG") {
    addLog(message.message, message.level || "info");
  }

  if (message.type === "AGENT_STOPPED") {
    stopBtn.style.display = "none";
    startBtn.style.display = "block";
    statusValue.textContent = "Idle";
    statusValue.className = "status-value";
  }
});
