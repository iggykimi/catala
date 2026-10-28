import { defineConfig, devices } from "@playwright/test";

// PORT lets a second run (e.g. screenshots) work while another one is going.
const port = Number(process.env.PORT ?? 4173);

export default defineConfig({
  testDir: "e2e",
  timeout: 180_000,
  fullyParallel: true,
  reporter: "list",
  use: { ...devices["Pixel 7"], baseURL: `http://localhost:${port}` },
  webServer: {
    command: `npx vite build && npx vite preview --port ${port} --strictPort`,
    url: `http://localhost:${port}`,
    reuseExistingServer: false,
    timeout: 120_000,
  },
});
