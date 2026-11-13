import { expect, test } from "@playwright/test";

/**
 * Pages of documentation of Storybook. MDX reads no Markdown table without an extra plugin:
 * a table written in Markdown there is displayed as raw text.
 */
test.describe("introduction page", () => {
  test("lists the sections in a table, without raw Markdown left", async ({ page }) => {
    await page.goto("/iframe.html?viewMode=docs&id=introduction--docs");
    const docs = page.locator("#storybook-docs");
    await expect(docs.locator("h1")).toHaveText("@pricemoov-oss/react-table");

    const rows = docs.locator("table tbody tr");
    expect(await rows.count()).toBeGreaterThanOrEqual(12);
    await expect(rows.first().locator("td").first()).toHaveText("Table / Basics");
    await expect(docs.locator("table")).toContainText("Recipes / Live data");
    // a Markdown table left as text shows its separator row
    expect(await docs.innerText()).not.toMatch(/\|\s*-{3,}/);
  });
});
