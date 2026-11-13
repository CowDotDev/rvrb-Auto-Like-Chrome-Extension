(() => {
  "use strict";

  // Defense in depth: never monitor another hostname, even if matches change.
  if (location.hostname !== "app.rvrb.one") return;

  let retryDelay = 15000;
  let lastScan = -Infinity;
  const lastClick = new WeakMap();
  let enabled = false;
  let interval;
  let scheduled;
  let enabledChanged = false;
  let delayChanged = false;

  function setDelay(value) {
    retryDelay = Number.isInteger(value) && value >= 1 && value <= 3600
      ? value * 1000 : 15000;
    if (enabled) {
      clearInterval(interval);
      clearTimeout(scheduled);
      scheduled = undefined;
      interval = setInterval(scan, retryDelay);
    }
  }

  function scan() {
    if (!enabled) return;
    if (Date.now() - lastScan < retryDelay) return;
    lastScan = Date.now();
    for (const element of document.querySelectorAll('[data-vote][title="Vote Up"]')) {
      if (!enabled) break;
      // Respect a deliberate downvote, including one made between clicks.
      if (document.querySelector('[data-vote][title="Vote Down"][data-active="true"]')) break;
      if (element.getAttribute("data-active") === "true") continue;
      if (typeof element.click !== "function") continue;
      const now = Date.now();
      if (now - (lastClick.get(element) ?? -Infinity) < retryDelay) continue;
      lastClick.set(element, now);
      element.click();
    }
  }

  const observer = new MutationObserver(() => {
    if (!enabled || scheduled !== undefined) return;
    scheduled = setTimeout(() => {
      scheduled = undefined;
      scan();
    }, 50);
  });

  function setEnabled(value) {
    if (enabled === value) return;
    enabled = value;
    if (enabled) {
      lastScan = -Infinity;
      observer.observe(document.documentElement, {
        subtree: true,
        childList: true,
        attributes: true,
        attributeFilter: ["data-vote", "data-active", "title"],
      });
      interval = setInterval(scan, retryDelay);
      scan();
    } else {
      observer.disconnect();
      clearInterval(interval);
      clearTimeout(scheduled);
      interval = undefined;
      scheduled = undefined;
    }
  }

  chrome.storage.onChanged.addListener((changes, area) => {
    if (area !== "local") return;
    if (changes.delaySeconds) {
      delayChanged = true;
      setDelay(changes.delaySeconds.newValue);
    }
    if (changes.enabled) {
      enabledChanged = true;
      setEnabled(changes.enabled.newValue === true);
    }
  });

  chrome.storage.local.get({ enabled: false, delaySeconds: 15 }).then((settings) => {
    // A live toggle must take priority over an older initial storage read.
    if (!delayChanged) setDelay(settings.delaySeconds);
    if (!enabledChanged) setEnabled(settings.enabled === true);
  }).catch(console.error);
})();
