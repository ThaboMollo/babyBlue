// Read-only smoke test against a deployed BabyBlue Admin Portal URL.
// Usage: node scripts/smoke.mjs https://clinic-os-portal-dev.vercel.app
//
// The portal is auth-gated: unauthenticated, the only reachable screen is
// /login, and every protected route must redirect there. This asserts the
// login screen renders and the auth guard works. Never writes, never logs in.
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
const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
const consoleErrors = [];
page.on("console", (m) => {
  if (m.type() === "error") consoleErrors.push(m.text());
});

try {
  // Login screen
  const login = await page.goto(`${base}/login`, { waitUntil: "networkidle", timeout: 30000 });
  check("login responds 200", login.status() === 200);
  // Catch Vercel Deployment Protection: an SSO redirect lands off-host and
  // would otherwise false-positive every "responds 200" check.
  check("no auth-wall redirect (still on target host)", page.url().startsWith(base));
  check(
    "login renders Admin Portal",
    await page.getByText("Admin Portal", { exact: false }).first().isVisible({ timeout: 10000 }).catch(() => false)
  );
  check(
    "sign-in button renders",
    await page.getByRole("button", { name: /sign in/i }).isVisible({ timeout: 10000 }).catch(() => false)
  );

  // Auth guard: a protected route must bounce to /login when unauthenticated.
  await page.goto(`${base}/`, { waitUntil: "networkidle", timeout: 30000 });
  check("protected route redirects to login", page.url().replace(/\/$/, "").endsWith("/login"));

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
