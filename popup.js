"use strict";

const toggle = document.querySelector("#enabled");
const status = document.querySelector("#status");

function showStatus() {
  status.textContent = toggle.checked ? "Automatic voting is on." : "Automatic voting is off.";
}

chrome.storage.local.get({ enabled: false }).then((settings) => {
  toggle.checked = settings.enabled === true;
  toggle.disabled = false;
  showStatus();
}).catch(() => {
  status.textContent = "Unable to load setting. Reopen this popup to retry.";
});

toggle.addEventListener("change", async () => {
  toggle.disabled = true;
  try {
    await chrome.storage.local.set({ enabled: toggle.checked });
    showStatus();
  } catch {
    toggle.checked = !toggle.checked;
    status.textContent = "Unable to save setting. Please try again.";
  } finally {
    toggle.disabled = false;
  }
});
