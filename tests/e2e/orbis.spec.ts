import { expect, test, type Page } from "@playwright/test";

// E2E runs against a dev server started with ORBIS_E2E=1, so all data is
// deterministic fixture data served through the real ingestion pipeline.
// The TopBar surfaces a "TEST FIXTURE MODE" badge so fixtures are never
// mistaken for live data.

async function gotoHeading(page: Page, path: string, name: string | RegExp) {
  await page.goto(path);
  // Next dev performs a client-side navigation right after hydration; wait for
  // the network to settle so clicks are not lost to a mid-flight remount.
  await page.waitForLoadState("networkidle");
  await expect(page.getByRole("heading", { level: 1, name })).toBeVisible();
}

async function openNavIfMobile(page: Page) {
  const burger = page.getByRole("button", { name: "Open menu" });
  if (await burger.isVisible()) {
    await burger.click();
    // Wait for the drawer transition to settle before any link click.
    await expect(page.locator('aside[aria-label="Main navigation"]')).toHaveCSS(
      "transform",
      /none|matrix\(1, 0, 0, 1, 0, 0\)/,
    );
  }
}

test.describe("ORBIS — core flows", () => {
  test("1. home loads the global overview and flags fixture mode", async ({ page }) => {
    await gotoHeading(page, "/", "Global Overview");
    await expect(page.getByText("TEST FIXTURE MODE")).toBeVisible();
  });

  test("2. significant developments render as event cards", async ({ page }) => {
    await gotoHeading(page, "/", "Global Overview");
    await expect(page.getByText("Significant developments")).toBeVisible();
    await expect(page.getByRole("button", { name: /^Open details for / }).first()).toBeVisible();
  });

  test("3. opening an event shows a structured briefing with labelled sources", async ({ page }) => {
    await gotoHeading(page, "/", "Global Overview");
    await page.getByRole("button", { name: /^Open details for / }).first().click();
    const dialog = page.getByRole("dialog");
    await expect(dialog).toBeVisible();
    await expect(dialog.getByText(/deterministic|rule-based|AI/i).first()).toBeVisible();
    await expect(dialog.getByRole("heading", { name: /What happened/i })).toBeVisible();
  });

  test("4. the sidebar navigates to every section", async ({ page }) => {
    await gotoHeading(page, "/", "Global Overview");
    const sections: Array<[string, string]> = [
      ["My Location", "My Location"],
      ["World Map", "World Map"],
      ["Live News", "Live News"],
      ["Topics & Regions", "Topics & Regions"],
      ["Situation Timeline", "Situation Timeline"],
      ["What Changed", "What Changed"],
      ["Alerts", "Alerts"],
      ["Saved Items", "Saved Items"],
      ["Sources & Methodology", "Sources & Methodology"],
      ["Settings", "Settings"],
    ];
    for (const [link, heading] of sections) {
      await openNavIfMobile(page);
      await page
        .locator('aside[aria-label="Main navigation"]')
        .getByRole("link", { name: link, exact: true })
        .click();
      await expect(page.getByRole("heading", { level: 1, name: heading })).toBeVisible();
    }
  });

  test("5. global search routes to the news view with the query applied", async ({ page }) => {
    await gotoHeading(page, "/", "Global Overview");
    const search = page.getByRole("textbox", { name: "Global search" });
    await search.fill("the");
    await search.press("Enter");
    await expect(page).toHaveURL(/\/news\?q=the/);
    await expect(page.getByRole("heading", { level: 1, name: "Live News" })).toBeVisible();
  });

  test("6. the news view filters by topic", async ({ page }) => {
    await gotoHeading(page, "/news", "Live News");
    const topic = page.locator("#news-topic");
    const [filterRequest] = await Promise.all([
      page.waitForRequest(
        (r) => r.url().includes("/api/articles?") && r.url().includes("topic=natural-disaster"),
      ),
      topic.selectOption("natural-disaster"),
    ]);
    expect(filterRequest).toBeTruthy();
    await expect(topic).toHaveValue("natural-disaster");
  });

  test("7. a location can be selected and persists across reloads (browser-local)", async ({ page }) => {
    await gotoHeading(page, "/location", "My Location");
    await page.locator("#place-search").fill("Nairobi");
    const option = page
      .getByRole("listbox", { name: "Location results" })
      .getByRole("button", { name: /Nairobi/ })
      .first();
    await option.click();
    await expect(page.locator("#place-search")).toBeVisible();
    await page.reload();
    await expect(page.getByRole("heading", { level: 1, name: "My Location" })).toBeVisible();
    await expect(
      page.locator("#main-content").getByText("Nairobi", { exact: true }).first(),
    ).toBeVisible();
  });

  test("8. saving an event surfaces it under Saved Items", async ({ page }) => {
    await gotoHeading(page, "/", "Global Overview");
    await page.getByRole("button", { name: "Save" }).first().click();
    await gotoHeading(page, "/saved", "Saved Items");
    await expect(page.getByText("Nothing saved yet")).toHaveCount(0);
  });

  test("9. settings persist the briefing mode across reloads", async ({ page }) => {
    await gotoHeading(page, "/settings", "Settings");
    await page.locator("#briefing-mode").selectOption("detailed");
    await page.reload();
    await expect(page.locator("#briefing-mode")).toHaveValue("detailed");
  });

  test("10. alert preferences persist across reloads", async ({ page }) => {
    await gotoHeading(page, "/alerts", "Alerts");
    const enabled = page.getByRole("checkbox", { name: "alerts enabled" });
    await expect(enabled).toBeChecked();
    await enabled.uncheck();
    await page.reload();
    await expect(page.getByRole("checkbox", { name: "alerts enabled" })).not.toBeChecked();
  });

  test("11. the timeline shows a chronology for a selected event", async ({ page }) => {
    await gotoHeading(page, "/timeline", "Situation Timeline");
    await expect(page.getByText("Events")).toBeVisible();
    await expect(page.getByText(/Time legend/)).toBeVisible();
  });

  test("12. What Changed lists material change filters", async ({ page }) => {
    await gotoHeading(page, "/what-changed", "What Changed");
    await expect(page.getByText("Change types")).toBeVisible();
    await expect(page.getByText("include new independent reporting")).toBeVisible();
  });

  test("13. the world map states only geolocated events are plotted", async ({ page }) => {
    await gotoHeading(page, "/map", "World Map");
    await expect(page.getByText(/geolocated/).first()).toBeVisible();
  });

  test("14. the health endpoint reports liveness", async ({ request }) => {
    const res = await request.get("/api/health");
    expect(res.status()).toBe(200);
    const body = await res.json();
    expect(body.ok).toBe(true);
    expect(body.service).toBe("orbis");
  });

  test("15. the mobile menu opens the navigation drawer", async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== "mobile-chromium", "mobile-only behaviour");
    await gotoHeading(page, "/", "Global Overview");
    const burger = page.getByRole("button", { name: "Open menu" });
    await expect(burger).toBeVisible();
    await burger.click();
    const aside = page.locator('aside[aria-label="Main navigation"]');
    const overview = aside.getByRole("link", { name: "Overview", exact: true });
    await expect(overview).toBeVisible();
    // The drawer slides in (transition-transform); poll until the slide-in has
    // settled and the link sits inside the viewport.
    await expect
      .poll(async () => {
        const box = await overview.boundingBox();
        if (!box) return -1;
        return box.x;
      })
      .toBeGreaterThanOrEqual(0);
    const box = await aside.boundingBox();
    expect(box?.x ?? -1).toBeGreaterThanOrEqual(0);
    const viewport = page.viewportSize();
    expect((box?.x ?? 0) + (box?.width ?? 0)).toBeLessThanOrEqual((viewport?.width ?? 0) + 1);
  });
});
