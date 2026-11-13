const { test } = require("node:test");
const assert = require("node:assert/strict");
const { readFileSync } = require("node:fs");
const vm = require("node:vm");

const source = readFileSync(`${__dirname}/content.js`, "utf8");

async function setup({ hostname = "app.rvrb.one", enabled = false } = {}) {
  let now = 0;
  let listener;
  let resolveSettings;
  let observing = false;
  let mutation;
  const timers = new Map();
  let nextId = 0;
  const elements = [];
  const context = {
    location: { hostname },
    document: {
      documentElement: {},
      querySelectorAll: (selector) => {
        assert.equal(selector, '[data-vote][title="Vote Up"]');
        return elements.filter((element) => element.title === "Vote Up");
      },
    },
    Date: { now: () => now },
    console,
    MutationObserver: class {
      constructor(callback) { mutation = callback; }
      observe() { observing = true; }
      disconnect() { observing = false; }
    },
    setInterval: (fn) => { timers.set(++nextId, { fn, repeat: true }); return nextId; },
    setTimeout: (fn) => { timers.set(++nextId, { fn, repeat: false }); return nextId; },
    clearInterval: (id) => timers.delete(id),
    clearTimeout: (id) => timers.delete(id),
    chrome: { storage: {
      onChanged: { addListener: (fn) => { listener = fn; } },
      local: { get: () => new Promise((resolve) => { resolveSettings = resolve; }) },
    } },
  };
  vm.runInNewContext(source, context);
  const api = {
    timers,
    get observing() { return observing; },
    get listening() { return !!listener; },
    add(active, title = "Vote Up") {
      const element = {
        active, title, clicks: 0,
        getAttribute() { return this.active; },
        click() { this.clicks++; },
      };
      elements.push(element);
      return element;
    },
    toggle(value) { listener({ enabled: { newValue: value } }, "local"); },
    mutate() { if (observing) mutation(); },
    tick(ms = 1000) {
      now += ms;
      for (const [id, timer] of [...timers]) {
        if (!timers.has(id)) continue;
        if (!timer.repeat) timers.delete(id);
        timer.fn();
      }
    },
    async initialize() {
      resolveSettings?.({ enabled });
      await Promise.resolve();
    },
  };
  return api;
}

test("does not register listeners or timers on other hostnames", async () => {
  for (const hostname of ["example.com", "sub.app.rvrb.one", "app.rvrb.one.evil.com"]) {
    const app = await setup({ hostname, enabled: true });
    await app.initialize();
    assert.equal(app.listening, false);
    assert.equal(app.timers.size, 0);
  }
});

test("disabled by default; toggling off cancels all work", async () => {
  const app = await setup();
  const vote = app.add(null);
  await app.initialize();
  assert.equal(app.observing, false);
  assert.equal(vote.clicks, 0);
  app.toggle(true);
  assert.equal(vote.clicks, 1);
  app.mutate();
  app.toggle(false);
  assert.equal(app.observing, false);
  assert.equal(app.timers.size, 0);
  app.tick();
  assert.equal(vote.clicks, 1);
});

test("clicks inactive elements, retries with cooldown, handles new elements", async () => {
  const app = await setup({ enabled: true });
  const inactive = app.add("false");
  const active = app.add("true");
  await app.initialize();
  assert.equal(inactive.clicks, 1);
  assert.equal(active.clicks, 0);
  app.mutate();
  app.tick(50);
  assert.equal(inactive.clicks, 1);
  inactive.active = "true";
  active.active = "false";
  const added = app.add(null);
  app.mutate();
  app.tick();
  assert.equal(inactive.clicks, 1);
  assert.equal(active.clicks, 1);
  assert.equal(added.clicks, 1);
  app.tick();
  assert.equal(active.clicks, 2);
});

test("live settings take priority over stale initial settings", async () => {
  const app = await setup({ enabled: true });
  app.toggle(false);
  await app.initialize();
  assert.equal(app.observing, false);
  assert.equal(app.timers.size, 0);
});

test("only clicks elements with the exact Vote Up title", async () => {
  const app = await setup({ enabled: true });
  const up = app.add("false", "Vote Up");
  const down = app.add("false", "Vote Down");
  const missing = app.add("false", null);
  const wrongCase = app.add("false", "vote up");
  await app.initialize();
  assert.equal(up.clicks, 1);
  assert.equal(down.clicks, 0);
  assert.equal(missing.clicks, 0);
  assert.equal(wrongCase.clicks, 0);
  down.title = "Vote Up";
  app.mutate();
  app.tick();
  assert.equal(down.clicks, 1);
});

test("manifest grants only storage and exact HTTPS host access", () => {
  const manifest = JSON.parse(readFileSync(`${__dirname}/manifest.json`, "utf8"));
  assert.deepEqual(manifest.permissions, ["storage"]);
  assert.deepEqual(manifest.content_scripts[0].matches, ["https://app.rvrb.one/*"]);
});
