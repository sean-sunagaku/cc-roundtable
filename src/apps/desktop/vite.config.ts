import path from "node:path";
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

function manualChunks(id: string): string | undefined {
  if (!id.includes("node_modules")) {
    return undefined;
  }
  if (id.includes("/three/")) {
    return "vendor-three";
  }
  if (id.includes("/@xterm/")) {
    return "vendor-xterm";
  }
  if (id.includes("/marked/")) {
    return "vendor-markdown";
  }
  if (id.includes("/lucide-react/")) {
    return "vendor-ui";
  }
  if (id.includes("/react/") || id.includes("/react-dom/") || id.includes("/scheduler/")) {
    return "vendor-react";
  }
  return "vendor";
}

export default defineConfig({
  base: "./",
  root: path.resolve(__dirname, "src/renderer"),
  plugins: [react()],
  resolve: {
    alias: {
      "@shared": path.resolve(__dirname, "src/shared")
    }
  },
  build: {
    outDir: path.resolve(__dirname, "dist/renderer"),
    emptyOutDir: true,
    rollupOptions: {
      output: {
        manualChunks
      }
    }
  }
});
