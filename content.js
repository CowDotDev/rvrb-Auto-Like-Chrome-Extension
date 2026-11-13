(() => {
  "use strict";

  // Defense in depth: never monitor another hostname, even if matches change.
  if (location.hostname !== "app.rvrb.one") return;

  const retryDelay = 1000;
  const lastClick = new WeakMap();
  let enabled = false;
  let interval;
  let scheduled;
  let settingsRevision = 0;

  function scan() {
    if (!enabled) return;
    for (const element of document.querySelectorAll("[data-vote]")) {
      if (!enabled) break;
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
      observer.observe(document.documentElement, {
        subtree: true,
        childList: true,
        attributes: true,
        attributeFilter: ["data-vote", "data-active"],
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
    if (area !== "local" || !changes.enabled) return;
    settingsRevision++;
    setEnabled(changes.enabled.newValue === true);
  });

  const initialRevision = settingsRevision;
  chrome.storage.local.get({ enabled: false }).then((settings) => {
    // A live toggle must take priority over an older initial storage read.
    if (settingsRevision === initialRevision) setEnabled(settings.enabled === true);
  }).catch(console.error);
})();
