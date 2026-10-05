import { expect, type Page } from "@playwright/test";

let n = 0;

/** Creates a fresh shop through the real sign-up screen and returns its login. */
export async function signUp(page: Page, shop = "E2E Hardware") {
  const login = `e2e-${Date.now()}-${++n}@shop.test`;
  await page.goto("/signup");
  await page.getByLabel("Shop name").fill(shop);
  await page.getByLabel("Your name").fill("Asha Owner");
  await page.getByLabel("Email or mobile number").fill(login);
  await page.getByLabel("Password").fill("e2e-password-1");
  await page.getByRole("button", { name: "Create my shop" }).click();
  await expect(page).toHaveURL(/\/onboarding/);
  return login;
}

export async function addProduct(page: Page, p: { name: string; opening?: string; min?: string; cost?: string; price?: string }) {
  await page.goto("/products/new");
  await page.getByLabel("Product name").fill(p.name);
  if (p.cost) await page.getByLabel("Purchase price (₹)").fill(p.cost);
  if (p.price) await page.getByLabel("Selling price (₹)").fill(p.price);
  if (p.opening) await page.getByLabel("Opening stock").fill(p.opening);
  if (p.min) await page.getByLabel("Minimum stock").fill(p.min);
  await page.getByRole("button", { name: "Save product" }).click();
  await expect(page).toHaveURL(/\/products\/c[a-z0-9]+\?saved=created/);
  return page.url().split("/products/")[1].split("?")[0];
}

/** Stock on hand shown on the product page. */
export async function stockOnProductPage(page: Page, id: string) {
  await page.goto(`/products/${id}`);
  return (await page.locator("p.text-4xl").innerText()).trim();
}
