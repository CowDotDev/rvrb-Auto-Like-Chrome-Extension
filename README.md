# rvrb Auto-Like Chrome Extension

A small Manifest V3 extension that keeps `[data-vote]` elements active on **https://app.rvrb.one**. Disabled by default.

## Install

1. Download and extract this repository, or clone it.
2. Open `chrome://extensions` and enable **Developer mode**.
3. Click **Load unpacked** and select the repository folder.
4. Reload any already-open app.rvrb.one tabs.
5. Open the extension's toolbar popup and check **Enable automatic voting**.

The setting persists across browser restarts and applies to all matching tabs. Turn it off in the popup to stop immediately.

The toolbar icon is **grey** on other sites, **red** on app.rvrb.one with automatic voting off, and **green** on app.rvrb.one with automatic voting on. Pin the extension to keep the indicator visible.

## Behavior and permissions

- Only injects into `https://app.rvrb.one/*`, not subdomains or other hosts.
- Clicks every `[data-vote]` element whose `data-active` is not exactly `"true"`.
- Watches relevant DOM mutations and retries at one-second intervals, with a per-element one-second click cooldown.
- Disconnects the observer and cancels timers while disabled.
- Uses `storage` to save the toggle and exact-site host access to recognize rvrb tabs. An event-driven background service worker updates toolbar icons; it never scans page contents. No broad `tabs` permission, analytics, or external requests.
- Uses DOM `.click()`; sites that require trusted physical input may reject it. Shadow DOM and embedded frames are not scanned.

## Test

Run `node --test` for automated content-script tests. For a browser smoke test, load the extension, enable it on app.rvrb.one, confirm inactive votes activate, then disable it and verify votes stay inactive. Confirm unrelated websites have no injected content script.
