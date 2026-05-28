/* global chrome */

chrome.runtime.onInstalled.addListener(() => {
  console.log("AI Resume Agent extension installed");
  chrome.storage.local.set({ resumeCount: 0 });
});

chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  if (
    changeInfo.status === "complete" &&
    tab.url &&
    tab.url.includes("dashboard.datasort.in/newresume")
  ) {
    chrome.storage.local.get(["continuousMode"], (data) => {
      if (data.continuousMode) {
        chrome.tabs.sendMessage(tabId, { action: "PAGE_READY" }).catch(() => {
          // Content script not yet loaded
        });
      }
    });
  }
});

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === "CALL_OPENAI") {
    callOpenAI(message.apiKey, message.payload)
      .then((result) => sendResponse({ success: true, data: result }))
      .catch((error) =>
        sendResponse({ success: false, error: error.message })
      );
    return true;
  }
});

async function callOpenAI(apiKey, payload) {
  const response = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(
      `OpenAI API error: ${response.status} - ${errorData.error?.message || response.statusText}`
    );
  }

  return response.json();
}
