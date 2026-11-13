"use strict";

function iconState(url, enabled) {
  try {
    const parsed = new URL(url);
    if (parsed.protocol === "https:" && parsed.hostname === "app.rvrb.one") {
      return enabled ? "green" : "red";
    }
  } catch {
    // URLs on unrelated hosts may be unavailable without broad tab permissions.
  }
  return "grey";
}

async function updateTab(tabId) {
  try {
    const [tab, settings] = await Promise.all([
      chrome.tabs.get(tabId),
      chrome.storage.local.get({ enabled: false }),
    ]);
    const state = iconState(tab.url, settings.enabled === true);
    await Promise.all([
      chrome.action.setIcon({
        tabId,
        path: { 16: `icons/${state}-16.png`, 32: `icons/${state}-32.png` },
      }),
      chrome.action.setTitle({
        tabId,
        title: {
          grey: "rvrb Auto-Like — not on app.rvrb.one",
          red: "rvrb Auto-Like — off",
          green: "rvrb Auto-Like — on",
        }[state],
      }),
    ]);
  } catch {
    // Tabs can close while an update is pending.
  }
}

async function updateAllTabs() {
  const tabs = await chrome.tabs.query({});
  await Promise.all(tabs.map((tab) => updateTab(tab.id)));
}

chrome.tabs.onUpdated.addListener((tabId) => { void updateTab(tabId); });
chrome.tabs.onActivated.addListener(({ tabId }) => { void updateTab(tabId); });
chrome.storage.onChanged.addListener((changes, area) => {
  if (area === "local" && changes.enabled) void updateAllTabs();
});
chrome.runtime.onInstalled.addListener(() => { void updateAllTabs(); });
chrome.runtime.onStartup.addListener(() => { void updateAllTabs(); });
