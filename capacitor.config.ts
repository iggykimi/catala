import type { CapacitorConfig } from "@capacitor/cli";

// APK build (on the build PC): npm run build && npx cap add android && npx cap sync && npx cap open android
const config: CapacitorConfig = {
  appId: "cat.iggykimi.catala",
  appName: "Català",
  webDir: "dist",
};

export default config;
