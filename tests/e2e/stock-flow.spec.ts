import { expect, test } from "@playwright/test";
import { addProduct, signUp, stockOnProductPage } from "./helpers";

test("daily flow on Android: scan → receive → stock out → damage = 108, ledger and dashboard agree", async ({ page }) => {
  await signUp(page);
  const id = await addProduct(page, { name: "SS Tower Bolt 4 inch", opening: "100", min: "10", cost: "40", price: "60" });
  expect(await stockOnProductPage(page, id)).toBe("100 pcs");

  // Real camera scan (fake camera shows SF00000001, this shop's first generated barcode)
  await page.goto("/scan");
  await expect(page.getByText("SS Tower Bolt 4 inch")).toBeVisible({ timeout: 20_000 });
  await page.getByRole("link", { name: "Receive" }).click();
  await page.getByLabel("Quantity received").fill("20");
  await page.getByRole("button", { name: /Confirm \+20/ }).click();
  await expect(page.getByText("Stock received")).toBeVisible();
  await expect(page.getByText(/Stock: 100 → 120/)).toBeVisible();

  await page.goto(`/stock-out?product=${id}`);
  await page.getByLabel("Quantity going out").fill("10");
  await page.getByRole("button", { name: /Confirm −10/ }).click();
  await expect(page.getByText(/Stock: 120 → 110/)).toBeVisible();

  await page.goto(`/adjust?product=${id}`);
  await page.locator("button[aria-pressed]", { hasText: "Damaged" }).click();
  await page.getByLabel("Quantity").fill("2");
  await page.getByRole("button", { name: "Broken" }).click();
  await page.getByRole("button", { name: "Confirm adjustment" }).click();
  await expect(page.getByText(/Stock: 110 → 108/)).toBeVisible();

  expect(await stockOnProductPage(page, id)).toBe("108 pcs");
  await page.goto(`/products/${id}/ledger`);
  await expect(page.getByText("4 movements")).toBeVisible();

  await page.goto("/dashboard");
  await expect(page.getByRole("link", { name: /Units in stock\s*108/ })).toBeVisible();
  await expect(page.getByRole("link", { name: /Today in\s*\+20/ })).toBeVisible();
  await expect(page.getByRole("link", { name: /Today out\s*−12/ })).toBeVisible();
});

test("cannot remove more stock than available; double-tap on Confirm records once", async ({ page }) => {
  await signUp(page);
  const id = await addProduct(page, { name: "Hinge 35mm", opening: "5" });

  await page.goto(`/stock-out?product=${id}`);
  await page.getByLabel("Quantity going out").fill("6");
  await expect(page.getByText("Only 5 available")).toBeVisible();
  await expect(page.getByRole("button", { name: /Confirm/ })).toBeDisabled();

  await page.goto(`/receive?product=${id}`);
  await page.getByLabel("Quantity received").fill("3");
  await page.getByRole("button", { name: /Confirm \+3/ }).dblclick();
  await expect(page.getByText("Stock received")).toBeVisible();
  expect(await stockOnProductPage(page, id)).toBe("8 pcs");
});

test("unknown barcode offers to create the product with the code filled in", async ({ page }) => {
  await signUp(page);
  await page.goto("/scan");
  await page.getByPlaceholder("Type barcode or SKU").fill("8909999999999");
  await page.getByRole("button", { name: "Find" }).click();
  await expect(page.getByText("Product not found")).toBeVisible();
  await page.getByRole("link", { name: "Create product" }).click();
  await expect(page.getByLabel("Barcode number")).toHaveValue("8909999999999");
});
