#!/usr/bin/env node

import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";
import { fileURLToPath, pathToFileURL } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, "..");
const electronNodeModules = path.join(rootDir, "src", "apps", "desktop", "node_modules");
const require = createRequire(import.meta.url);

let esbuild;
try {
  esbuild = require(path.join(electronNodeModules, "esbuild"));
} catch (error) {
  console.error("esbuild が見つかりません。先に `npm --prefix src/apps/desktop install` を実行してください。");
  process.exit(error instanceof Error ? 1 : 1);
}

const webEntry = path.join(rootDir, "src", "apps", "web", "src", "main.tsx");
const publicShareEntry = path.join(rootDir, "src", "apps", "web", "src", "public-share-main.tsx");
const webTsconfig = path.join(rootDir, "src", "apps", "web", "tsconfig.json");
const webOutdir = path.join(rootDir, "src", "apps", "web", "client");
const publicShareOutdir = path.join(rootDir, "src", "apps", "web", "share-client");
const htmlSource = path.join(rootDir, "src", "apps", "web", "src", "index.html");
const publicShareHtmlSource = path.join(rootDir, "src", "apps", "web", "src", "public-share.html");
const watch = process.argv.includes("--watch");

function copyHtmlTemplate(sourcePath, outdir) {
  fs.mkdirSync(outdir, { recursive: true });
  fs.copyFileSync(sourcePath, path.join(outdir, "index.html"));
}

function removeStaleSourceMaps(outdir) {
  for (const fileName of ["app.js.map", "app.css.map"]) {
    const filePath = path.join(outdir, fileName);
    if (fs.existsSync(filePath)) {
      fs.rmSync(filePath);
    }
  }
}

export function createWebBuildOptions(entryPoint, outdir, plugins = []) {
  return {
    entryPoints: [entryPoint],
    bundle: true,
    platform: "browser",
    format: "esm",
    sourcemap: watch,
    minify: !watch,
    tsconfig: webTsconfig,
    outfile: path.join(outdir, "app.js"),
    logLevel: "info",
    nodePaths: [electronNodeModules],
    alias: {
      marked: path.join(electronNodeModules, "marked", "lib", "marked.esm.js")
    },
    plugins
  };
}

export async function buildWebClient() {
  await Promise.all([
    buildTarget(webEntry, webOutdir, htmlSource),
    buildTarget(publicShareEntry, publicShareOutdir, publicShareHtmlSource)
  ]);
}

export async function watchWebClient() {
  const copyPlugin = (sourcePath, outdir) => ({
    name: `copy-web-index-${path.basename(outdir)}`,
    setup(build) {
      build.onEnd((result) => {
        if (result.errors.length === 0) {
          copyHtmlTemplate(sourcePath, outdir);
          if (!watch) {
            removeStaleSourceMaps(outdir);
          }
        }
      });
    }
  });

  const contexts = await Promise.all([
    watchTarget(webEntry, webOutdir, htmlSource, copyPlugin(htmlSource, webOutdir)),
    watchTarget(
      publicShareEntry,
      publicShareOutdir,
      publicShareHtmlSource,
      copyPlugin(publicShareHtmlSource, publicShareOutdir)
    )
  ]);

  return {
    dispose: async () => {
      await Promise.all(contexts.map((context) => context.dispose()));
    }
  };
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

async function buildTarget(entryPoint, outdir, sourcePath) {
  await esbuild.build(createWebBuildOptions(entryPoint, outdir));
  copyHtmlTemplate(sourcePath, outdir);
  removeStaleSourceMaps(outdir);
}

async function watchTarget(entryPoint, outdir, sourcePath, plugin) {
  copyHtmlTemplate(sourcePath, outdir);
  const context = await esbuild.context(createWebBuildOptions(entryPoint, outdir, [plugin]));
  await context.watch();
  return context;
}
