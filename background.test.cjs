const { test } = require("node:test");
const assert = require("node:assert/strict");
const { readFileSync, existsSync } = require("node:fs");
const vm = require("node:vm");

function setup() {
  const events = {};
  const event = (name) => ({ addListener(fn) { events[name] = fn; } });
  const tabs = [
    { id: 1, url: "https://app.rvrb.one/" },
    { id: 2, url: "https://example.com/" },
  ];
  const icons = new Map();
  let enabled = false;
  const context = vm.createContext({
    URL,
    chrome: {
      tabs: {
        get: async (id) => tabs.find((tab) => tab.id === id),
        query: async () => tabs,
        onUpdated: event("updated"), onActivated: event("activated"),
      },
      storage: {
        local: { get: async () => ({ enabled }) },
        onChanged: event("changed"),
      },
      action: {
        setIcon: async ({ tabId, path }) => { icons.set(tabId, path[16]); },
        setTitle: async () => {},
      },
      runtime: { onInstalled: event("installed"), onStartup: event("startup") },
    },
  });
  vm.runInContext(readFileSync(`${__dirname}/background.js`, "utf8"), context);
  return { context, tabs, icons, events, enable() { enabled = true; } };
}

test("icon colors require exact HTTPS host and enabled setting", () => {
  const { context } = setup();
  for (const [url, enabled, expected] of [
    ["https://app.rvrb.one/", false, "red"],
    ["https://app.rvrb.one/path", true, "green"],
    ["https://example.com", true, "grey"],
    ["https://app.rvrb.one.evil.com", true, "grey"],
    ["http://app.rvrb.one", true, "grey"],
    [undefined, true, "grey"],
  ]) {
    context.input = { url, enabled };
    assert.equal(vm.runInContext("iconState(input.url, input.enabled)", context), expected);
  }
});

test("updates all tabs and changes color after toggles and navigation", async () => {
  const app = setup();
  await vm.runInContext("updateAllTabs()", app.context);
  assert.equal(app.icons.get(1), "icons/red-16.png");
  assert.equal(app.icons.get(2), "icons/grey-16.png");
  app.enable();
  await vm.runInContext("updateAllTabs()", app.context);
  assert.equal(app.icons.get(1), "icons/green-16.png");
  app.tabs[0].url = undefined;
  await vm.runInContext("updateTab(1)", app.context);
  assert.equal(app.icons.get(1), "icons/grey-16.png");
  assert.deepEqual(Object.keys(app.events).sort(), ["activated", "changed", "installed", "startup", "updated"]);
});

test("all icon assets exist", () => {
  for (const color of ["grey", "red", "green"]) {
    for (const size of [16, 32]) {
      assert.ok(existsSync(`${__dirname}/icons/${color}-${size}.png`));
    }
  }
});
