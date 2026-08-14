// Read-only smoke test against a deployed BabyBlue URL.
// Usage: node scripts/smoke.mjs https://clinic-os-dev.vercel.app
// Asserts the marketing home, clinic directory, and join form render.
// Never writes: no queue joins, no intake, no feedback.
import { chromium } from "playwright";

const base = process.argv[2]?.replace(/\/$/, "");
if (!base) {
  console.error("usage: node scripts/smoke.mjs <base-url>");
  process.exit(2);
}

const failures = [];
const check = (name, ok) => {
  console.log(`${ok ? "✓" : "✗"} ${name}`);
  if (!ok) failures.push(name);
};

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
const consoleErrors = [];
page.on("console", (m) => {
  if (m.type() === "error") consoleErrors.push(m.text());
});

try {
  // Marketing home
  const home = await page.goto(`${base}/`, { waitUntil: "networkidle", timeout: 30000 });
  check("home responds 200", home.status() === 200);
  // Catch Vercel Deployment Protection: an SSO redirect lands off-host and
  // would otherwise false-positive every "responds 200" check
  check("no auth-wall redirect (still on target host)", page.url().startsWith(base));
  check(
    "home renders marketing hero",
    await page.getByText("waiting room, without the waiting", { exact: false }).first().isVisible().catch(() => false)
  );

  // Clinic directory
  const dir = await page.goto(`${base}/find-a-clinic`, { waitUntil: "networkidle", timeout: 30000 });
  check("find-a-clinic responds 200", dir.status() === 200);
  check(
    "directory lists the demo clinic",
    await page.getByText("BabyBlue Demo Clinic").first().isVisible({ timeout: 10000 }).catch(() => false)
  );

  // Clinic landing + join form (render only — no submission)
  const clinic = await page.goto(`${base}/c/demo-clinic`, { waitUntil: "networkidle", timeout: 30000 });
  check("clinic landing responds 200", clinic.status() === 200);
  check(
    "join queue button renders",
    await page.getByRole("button", { name: /join queue/i }).isVisible({ timeout: 10000 }).catch(() => false)
  );

  check("no browser console errors", consoleErrors.length === 0);
  if (consoleErrors.length) console.log("console errors:", consoleErrors);
} finally {
  await browser.close();
}

if (failures.length) {
  console.error(`\nSMOKE FAILED (${failures.length}): ${failures.join("; ")}`);
  process.exit(1);
}
console.log("\nSMOKE PASSED");
