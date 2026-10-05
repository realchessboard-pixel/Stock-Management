import { expect, test } from "@playwright/test";
import { signUp } from "./helpers";

test("installable PWA: valid manifest, icons and service worker", async ({ page, context }) => {
  await page.goto("/login");
  const manifest = await (await page.request.get("/manifest.webmanifest")).json();
  expect(manifest).toMatchObject({ display: "standalone", start_url: expect.stringContaining("/dashboard") });
  for (const icon of manifest.icons) expect((await page.request.get(icon.src)).status(), icon.src).toBe(200);
  expect(manifest.icons.some((i: { purpose?: string }) => i.purpose === "maskable")).toBe(true);

  await expect.poll(async () => page.evaluate(async () => (await navigator.serviceWorker.getRegistration())?.active?.state ?? null), { timeout: 20_000 }).toBe("activated");

  // Chrome's own installability check (same one Android uses for "Install app").
  const cdp = await context.newCDPSession(page);
  const { installabilityErrors } = (await cdp.send("Page.getInstallabilityErrors")) as { installabilityErrors: { errorId: string }[] };
  // "in-incognito" only appears because Playwright browsers are always incognito.
  expect(installabilityErrors.map((e) => e.errorId).filter((id) => id !== "in-incognito")).toEqual([]);
});

test("offline: navigation shows the friendly offline page, and data pages are never cached", async ({ page, context }) => {
  await signUp(page, "Offline Shop");
  await page.goto("/dashboard");
  await expect.poll(async () => page.evaluate(async () => (await navigator.serviceWorker.getRegistration())?.active?.state ?? null), { timeout: 20_000 }).toBe("activated");
  await page.reload(); // let the service worker control the page

  const cachedUrls = await page.evaluate(async () => {
    const out: string[] = [];
    for (const name of await caches.keys()) for (const req of await (await caches.open(name)).keys()) out.push(new URL(req.url).pathname);
    return out;
  });
  expect(cachedUrls.filter((u) => !u.startsWith("/_next/static/") && !u.startsWith("/icons/") && u !== "/offline")).toEqual([]);

  await context.setOffline(true);
  await page.goto("/products").catch(() => {});
  await expect(page.getByText("You're offline")).toBeVisible();
  await context.setOffline(false);
});

test("Android keyboard: bottom navigation hides while typing so Confirm stays visible", async ({ page }) => {
  await signUp(page, "Keyboard Shop");
  await page.goto("/products/new");
  const nav = page.locator("nav.bottom-nav");
  // The name field is auto-focused (keyboard opens straight away), so the nav starts hidden.
  await expect(nav).toBeHidden();
  await page.evaluate(() => (document.activeElement as HTMLElement | null)?.blur());
  await expect(nav).toBeVisible();
  await page.getByLabel("Opening stock").focus();
  await expect(nav).toBeHidden();
  await expect(page.getByRole("button", { name: "Save product" })).toBeInViewport();
  // Tapping Save while typing must work first time (the button must not jump away).
  await page.getByLabel("Opening stock").fill("7");
  await page.getByLabel("Opening stock").focus();
  await page.getByRole("button", { name: "Save product" }).tap();
  await expect(page.getByText("Product name is required")).toBeVisible();
});

test("pages load quickly on a mid-range Android phone over 4G", async ({ page, context }) => {
  await signUp(page, "Speed Shop");
  const cdp = await context.newCDPSession(page);
  await cdp.send("Emulation.setCPUThrottlingRate", { rate: 4 });
  await cdp.send("Network.emulateNetworkConditions", { offline: false, latency: 150, downloadThroughput: (4 * 1024 * 1024) / 8, uploadThroughput: (1 * 1024 * 1024) / 8 });
  for (const path of ["/dashboard", "/scan", "/products", "/receive"]) {
    const t = Date.now();
    await page.goto(path, { waitUntil: "load" });
    const ms = Date.now() - t;
    console.log(`${path}: ${ms} ms`);
    expect(ms, `${path} load time`).toBeLessThan(6000);
  }
});
