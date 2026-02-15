import { chmodSync, existsSync } from "node:fs";

const binPath = new URL("../dist/index.js", import.meta.url);

if (!existsSync(binPath)) {
  console.warn(`[camofox-mcp] Skipping chmod: missing ${binPath.pathname}`);
  process.exit(0);
}

try {
  chmodSync(binPath, 0o755);
} catch (error) {
  console.warn(`[camofox-mcp] Failed to chmod +x ${binPath.pathname}:`, error);
  process.exit(0);
}
