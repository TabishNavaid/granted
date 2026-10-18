import { defineConfig } from "@playwright/test";

const port = process.env.PORT ?? "3100";

export default defineConfig({
  testDir: "./tests",
  timeout: 30_000,
  retries: 0,
  use: {
    baseURL: process.env.BASE_URL ?? `http://localhost:${port}`,
    viewport: { width: 1280, height: 800 },
  },
  webServer: process.env.BASE_URL
    ? undefined
    : {
        command: `npm run dev -- -p ${port}`,
        url: `http://localhost:${port}`,
        reuseExistingServer: true,
        timeout: 120_000,
      },
});
