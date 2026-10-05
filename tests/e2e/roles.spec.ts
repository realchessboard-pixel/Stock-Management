import { expect, test } from "@playwright/test";
import { signUp } from "./helpers";

test("staff can do daily work but not management", async ({ page, browser }) => {
  await signUp(page, "Role Test Shop");
  const staffLogin = `staff-${Date.now()}@shop.test`;
  await page.goto("/users");
  await page.getByLabel("Name").fill("Suresh Staff");
  await page.getByLabel("Email or mobile number").fill(staffLogin);
  await page.getByLabel("Password").fill("staff-pass-1");
  await page.getByRole("button", { name: "Add user" }).click();
  await expect(page.getByText("User added")).toBeVisible();

  const staff = await browser.newPage();
  await staff.goto("/login");
  await staff.getByLabel("Email or mobile number").fill(staffLogin);
  await staff.getByLabel("Password").fill("staff-pass-1");
  await staff.getByRole("button", { name: "Log in" }).click();
  await expect(staff).toHaveURL(/\/dashboard/);
  await expect(staff.getByRole("link", { name: "Scan", exact: true })).toBeVisible();
  await expect(staff.getByText("Stock value")).toHaveCount(0);

  for (const path of ["/users", "/settings", "/audit", "/products/import", "/adjust", "/locations", "/products/new"]) {
    await staff.goto(path);
    await expect(staff.getByText("You don't have access"), path).toBeVisible();
  }
  expect((await staff.request.get("/api/products/export")).status()).toBe(403);
  expect((await staff.request.get("/api/movements/export")).status()).toBe(403);
  await staff.close();
});

test("signed-out visitors are sent to login and APIs refuse them", async ({ page }) => {
  await page.goto("/dashboard");
  await expect(page).toHaveURL(/\/login\?next=%2Fdashboard/);
  expect((await page.request.get("/api/products/export")).status()).toBe(401);
});
