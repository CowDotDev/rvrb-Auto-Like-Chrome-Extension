"use strict";

const toggle = document.querySelector("#enabled");
const status = document.querySelector("#status");
const delay = document.querySelector("#delay");
let savedDelay = 15;

function showStatus() {
  status.textContent = toggle.checked ? "Automatic voting is on." : "Automatic voting is off.";
}

chrome.storage.local.get({ enabled: false, delaySeconds: 15 }).then((settings) => {
  toggle.checked = settings.enabled === true;
  toggle.disabled = false;
  savedDelay = Number.isInteger(settings.delaySeconds) && settings.delaySeconds >= 1
    && settings.delaySeconds <= 3600 ? settings.delaySeconds : 15;
  delay.value = savedDelay;
  delay.disabled = false;
  showStatus();
}).catch(() => {
  status.textContent = "Unable to load setting. Reopen this popup to retry.";
});

delay.addEventListener("change", async () => {
  if (!delay.reportValidity() || delay.value === "") {
    status.textContent = "Enter a delay from 1 to 3600 seconds.";
    return;
  }
  delay.disabled = true;
  try {
    const value = Number(delay.value);
    await chrome.storage.local.set({ delaySeconds: value });
    savedDelay = value;
    status.textContent = `Check delay saved: ${value} seconds.`;
  } catch {
    delay.value = savedDelay;
    status.textContent = "Unable to save delay. Please try again.";
  } finally {
    delay.disabled = false;
  }
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
