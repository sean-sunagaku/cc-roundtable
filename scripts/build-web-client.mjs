#!/usr/bin/env node

import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";
import { fileURLToPath, pathToFileURL } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, "..");
const electronNodeModules = path.join(rootDir, "electron", "node_modules");
const require = createRequire(import.meta.url);

let esbuild;
try {
  esbuild = require(path.join(electronNodeModules, "esbuild"));
} catch (error) {
  console.error("esbuild が見つかりません。先に `npm --prefix electron install` を実行してください。");
  process.exit(error instanceof Error ? 1 : 1);
}

const webEntry = path.join(rootDir, "apps", "web", "src", "main.tsx");
const webTsconfig = path.join(rootDir, "apps", "web", "tsconfig.json");
const webOutdir = path.join(rootDir, "apps", "web", "client");
const htmlSource = path.join(rootDir, "apps", "web", "src", "index.html");
const watch = process.argv.includes("--watch");

function copyHtmlTemplate() {
  fs.mkdirSync(webOutdir, { recursive: true });
  fs.copyFileSync(htmlSource, path.join(webOutdir, "index.html"));
}

function removeStaleSourceMaps() {
  for (const fileName of ["app.js.map", "app.css.map"]) {
    const filePath = path.join(webOutdir, fileName);
    if (fs.existsSync(filePath)) {
      fs.rmSync(filePath);
    }
  }
}

export function createWebBuildOptions(plugins = []) {
  return {
    entryPoints: [webEntry],
    bundle: true,
    platform: "browser",
    format: "esm",
    sourcemap: watch,
    minify: !watch,
    tsconfig: webTsconfig,
    outfile: path.join(webOutdir, "app.js"),
    logLevel: "info",
    nodePaths: [electronNodeModules],
    alias: {
      marked: path.join(electronNodeModules, "marked", "lib", "marked.esm.js")
    },
    plugins
  };
}

export async function buildWebClient() {
  await esbuild.build(createWebBuildOptions());
  copyHtmlTemplate();
  removeStaleSourceMaps();
}

export async function watchWebClient() {
  const copyPlugin = {
    name: "copy-web-index",
    setup(build) {
      build.onEnd((result) => {
        if (result.errors.length === 0) {
          copyHtmlTemplate();
          if (!watch) {
            removeStaleSourceMaps();
          }
        }
      });
    }
  };
  copyHtmlTemplate();
  const context = await esbuild.context(createWebBuildOptions([copyPlugin]));
  await context.watch();
  return context;
}

async function main() {
  if (watch) {
    await watchWebClient();
    return;
  }
  await buildWebClient();
}

if (import.meta.url === pathToFileURL(process.argv[1] || "").href) {
  void main().catch((error) => {
    console.error(error);
    process.exit(1);
  });
}
