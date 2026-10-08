import { test, expect } from "@playwright/test";
test("language model uses the selected object, serializes replies, and ignores a cleared conversation", async ({
  page,
}) => {
  await page.route(
    "https://cdn.jsdelivr.net/npm/@xenova/transformers@2.17.2",
    (route) =>
      route.fulfill({
        contentType: "text/javascript",
        headers: { "Access-Control-Allow-Origin": "*" },
        body: `export async function pipeline() { return async (prompt) => { window.testPrompt = prompt; window.testCalls = (window.testCalls || 0) + 1; return new Promise(resolve => { window.finishReply = () => resolve([{generated_text: "A model reply"}]); }); }; }`,
      }),
  );
  await page.goto("/");
  await page.getByLabel("Talk to", { exact: true }).selectOption("cat");
  await page.getByLabel("Personality").selectOption("funny");
  await page.getByText("Try the experimental language model").click();
  await page.getByRole("button", { name: "Load language model" }).click();
  await expect(page.locator("#aiStatus")).toContainText("ready");
  await page.getByRole("button", { name: "Hello!", exact: true }).click();
  await expect(page.locator("#sendBtn")).toBeDisabled();
  await page.getByRole("button", { name: "Hello!", exact: true }).click();
  expect(await page.evaluate(() => window.testCalls)).toBe(1);
  expect(await page.evaluate(() => window.testPrompt)).toContain("playful cat");
  await page.getByRole("button", { name: "Clear chat" }).click();
  await page.evaluate(() => window.finishReply());
  await expect(page.locator("#sendBtn")).toBeEnabled();
  await expect(page.locator(".message")).toHaveCount(0);
  await page.getByRole("button", { name: "Use built-in replies" }).click();
  await page.getByRole("button", { name: "Hello!", exact: true }).click();
  await expect(page.locator(".message.object")).toContainText(/your cat/i);
});
test("empty model generation falls back without blocking the next message", async ({
  page,
}) => {
  await page.route(
    "https://cdn.jsdelivr.net/npm/@xenova/transformers@2.17.2",
    (route) =>
      route.fulfill({
        contentType: "text/javascript",
        headers: { "Access-Control-Allow-Origin": "*" },
        body: `export async function pipeline() { return async () => [{generated_text: ""}]; }`,
      }),
  );
  await page.goto("/");
  await page.getByText("Try the experimental language model").click();
  await page.getByRole("button", { name: "Load language model" }).click();
  await expect(page.locator("#aiStatus")).toContainText("ready");
  await page.getByRole("button", { name: "Hello!", exact: true }).click();
  await expect(page.locator("#chatStatus")).toContainText(
    "Used a built-in reply",
  );
  await expect(page.locator(".message.object")).toContainText("your cup");
  await expect(page.locator("#sendBtn")).toBeEnabled();
});
test("sample demo starts without external downloads and supports safe typed chat", async ({
  page,
}) => {
  const errors = [],
    remote = [];
  page.on("pageerror", (error) => errors.push(error.message));
  page.on("request", (request) => {
    if (!request.url().startsWith("http://127.0.0.1"))
      remote.push(request.url());
  });
  await page.goto("/");
  await page.getByLabel("Talk to", { exact: true }).selectOption("cat");
  await page.getByRole("button", { name: "Hello!", exact: true }).click();
  await expect(page.locator(".message.object")).toContainText("your cat");
  await page.getByLabel("Personality").selectOption("funny");
  await page.getByRole("button", { name: "Hello!", exact: true }).click();
  await expect(page.locator(".message.object").last()).toContainText(
    "starstruck",
  );
  await page
    .getByLabel("Message your selected object")
    .fill("<img src=x onerror=alert(1)>");
  await page.getByLabel("Message your selected object").press("Enter");
  await expect(page.locator(".message.user").last()).toContainText(
    "<img src=x",
  );
  await expect(page.locator("#chatLog img")).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Send ↗" })).toBeEnabled();
  await page.getByRole("button", { name: "Clear chat" }).click();
  await expect(page.locator(".message")).toHaveCount(0);
  expect(errors).toEqual([]);
  expect(remote).toEqual([]);
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
});
test("camera rejection is recoverable and sample chat remains available", async ({
  page,
}) => {
  await page.addInitScript(() => {
    navigator.mediaDevices.getUserMedia = async () => {
      throw new DOMException("Denied", "NotAllowedError");
    };
  });
  await page.goto("/");
  await page.getByRole("button", { name: "Use my camera" }).click();
  await expect(page.locator("#cameraStatus")).toContainText(
    "permission was denied",
  );
  await expect(
    page.getByRole("button", { name: "Use my camera" }),
  ).toBeEnabled();
  await page
    .getByRole("button", { name: "What do you do?", exact: true })
    .click();
  await expect(page.locator(".message.object")).toContainText(
    "favorite drinks",
  );
});
test("language model download failure leaves built-in replies usable", async ({
  page,
}) => {
  await page.route("https://cdn.jsdelivr.net/**", (route) => route.abort());
  await page.goto("/");
  await page.getByText("Try the experimental language model").click();
  await page.getByRole("button", { name: "Load language model" }).click();
  await expect(page.locator("#aiStatus")).toContainText("failed to load");
  await expect(
    page.getByRole("button", { name: "Load language model" }),
  ).toBeEnabled();
  await page.getByRole("button", { name: "Hello!", exact: true }).click();
  await expect(page.locator(".message.object")).toContainText("your cup");
});
test("live object selection, no detections, and camera shutdown", async ({
  page,
}) => {
  await page.addInitScript(() => {
    window.testPredictions = [
      { class: "dog", score: 0.95, bbox: [10, 20, 100, 100] },
      { class: "cat", score: 0.9, bbox: [150, 20, 100, 100] },
    ];
    window.tf = {};
    window.cocoSsd = {
      load: async () => ({ detect: async () => window.testPredictions }),
    };
    navigator.mediaDevices.getUserMedia = async () => {
      const canvas = document.createElement("canvas");
      canvas.width = 640;
      canvas.height = 480;
      window.testStream = canvas.captureStream(10);
      setInterval(() => {
        canvas.getContext("2d").fillRect(0, 0, 640, 480);
      }, 100);
      return window.testStream;
    };
  });
  await page.goto("/");
  await page.getByRole("button", { name: "Use my camera" }).click();
  await expect(page.locator("#sourceBadge")).toHaveText("LIVE CAMERA");
  await expect(page.locator("#objectSelect option")).toHaveCount(2);
  await page.getByLabel("Talk to", { exact: true }).selectOption("cat");
  await page.getByRole("button", { name: "Hello!", exact: true }).click();
  await expect(page.locator(".message.object")).toContainText("your cat");
  await page.evaluate(() => {
    window.testPredictions = [];
  });
  await expect(page.locator("#objectTag")).toHaveText("Looking for objects…");
  await page.getByRole("button", { name: "Hello!", exact: true }).click();
  await expect(page.locator("#chatStatus")).toContainText("Choose a sample");
  await page.getByRole("button", { name: "Stop camera", exact: true }).click();
  expect(
    await page.evaluate(() =>
      window.testStream
        .getTracks()
        .every((track) => track.readyState === "ended"),
    ),
  ).toBe(true);
  await expect(page.locator("#sourceBadge")).toHaveText("SAMPLE SCENE");
});
test("late camera permission cannot restart a canceled session", async ({
  page,
}) => {
  await page.addInitScript(() => {
    navigator.mediaDevices.getUserMedia = () =>
      new Promise((resolve) => {
        window.resolveCamera = () => {
          const canvas = document.createElement("canvas");
          window.testStream = canvas.captureStream();
          resolve(window.testStream);
        };
      });
  });
  await page.goto("/");
  await page.getByRole("button", { name: "Use my camera" }).click();
  await page.getByRole("button", { name: "Back to samples" }).click();
  await page.evaluate(() => window.resolveCamera());
  await expect
    .poll(() =>
      page.evaluate(() =>
        window.testStream
          .getTracks()
          .every((track) => track.readyState === "ended"),
      ),
    )
    .toBe(true);
  await expect(page.locator("#sourceBadge")).toHaveText("SAMPLE SCENE");
});
test("microphone accepts one message and recovers from errors without restart loops", async ({
  page,
}) => {
  await page.addInitScript(() => {
    window.SpeechRecognition = class {
      constructor() {
        window.testRecognition = this;
        this.starts = 0;
      }
      start() {
        this.starts++;
      }
      abort() {}
    };
  });
  await page.goto("/");
  await page.getByLabel("Talk to", { exact: true }).selectOption("dog");
  await page
    .getByRole("button", { name: "Use microphone", exact: true })
    .click();
  await expect(
    page.getByRole("button", { name: "Stop microphone" }),
  ).toHaveAttribute("aria-pressed", "true");
  await page.evaluate(() =>
    window.testRecognition.onresult({ results: [[{ transcript: "Hello!" }]] }),
  );
  await expect(page.locator(".message.object")).toContainText("your dog");
  await expect(
    page.getByRole("button", { name: "Use microphone", exact: true }),
  ).toHaveAttribute("aria-pressed", "false");
  await page.evaluate(() => window.testRecognition.onend());
  expect(await page.evaluate(() => window.testRecognition.starts)).toBe(1);
  await page
    .getByRole("button", { name: "Use microphone", exact: true })
    .click();
  await page.evaluate(() =>
    window.testRecognition.onerror({ error: "not-allowed" }),
  );
  await expect(page.locator("#chatStatus")).toContainText("permission denied");
  await expect(
    page.getByRole("button", { name: "Use microphone", exact: true }),
  ).toBeEnabled();
});
test("camera stops when the tab becomes hidden", async ({ page }) => {
  await page.addInitScript(() => {
    window.tf = {};
    window.cocoSsd = { load: async () => ({ detect: async () => [] }) };
    navigator.mediaDevices.getUserMedia = async () => {
      const canvas = document.createElement("canvas");
      window.testStream = canvas.captureStream(10);
      setInterval(() => canvas.getContext("2d").fillRect(0, 0, 100, 100), 100);
      return window.testStream;
    };
  });
  await page.goto("/");
  await page.getByRole("button", { name: "Use my camera" }).click();
  await expect(page.locator("#sourceBadge")).toHaveText("LIVE CAMERA");
  await page.evaluate(() => {
    Object.defineProperty(document, "hidden", {
      value: true,
      configurable: true,
    });
    document.dispatchEvent(new Event("visibilitychange"));
  });
  await expect(page.locator("#sourceBadge")).toHaveText("SAMPLE SCENE");
  expect(
    await page.evaluate(() =>
      window.testStream
        .getTracks()
        .every((track) => track.readyState === "ended"),
    ),
  ).toBe(true);
});
