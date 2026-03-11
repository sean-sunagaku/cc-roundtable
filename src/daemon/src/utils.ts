import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import crypto from "node:crypto";
import { createRequire } from "node:module";
import type { IncomingMessage, ServerResponse } from "node:http";
import {
  MEETING_ROOM_DAEMON_DEFAULT_HOST,
  MEETING_ROOM_DAEMON_DEFAULT_PORT
} from "@contracts/meeting-room-daemon";
import { JSON_HEADERS } from "./constants";

const requireFromRepo = createRequire(__filename);

export function resolveRepoRoot(): string {
  let current = process.cwd();
  while (true) {
    if (
      fs.existsSync(path.resolve(current, "src/apps/desktop")) &&
      fs.existsSync(path.resolve(current, "docs"))
    ) {
      return current;
    }
    const parent = path.resolve(current, "..");
    if (parent === current) {
      break;
    }
    current = parent;
  }
  return process.cwd();
}

export function resolveWebFile(requestPath: string): string | null {
  const repoRoot = resolveRepoRoot();
  const relative = requestPath.replace(/^\/web\/?/, "") || "index.html";
  const filePath = path.resolve(repoRoot, "src/apps/web/client", relative);
  if (!filePath.startsWith(path.resolve(repoRoot, "src/apps/web/client"))) {
    return null;
  }
  return filePath;
}

export function resolvePublicShareFile(requestPath: string): string | null {
  const repoRoot = resolveRepoRoot();
  const relative =
    requestPath.replace(/^\/share-assets\/?/, "").replace(/^\/+/, "") || "index.html";
  const filePath = path.resolve(repoRoot, "src/apps/web/share-client", relative);
  if (!filePath.startsWith(path.resolve(repoRoot, "src/apps/web/share-client"))) {
    return null;
  }
  return filePath;
}

export function contentTypeFor(filePath: string): string {
  if (filePath.endsWith(".html")) return "text/html; charset=utf-8";
  if (filePath.endsWith(".js")) return "text/javascript; charset=utf-8";
  if (filePath.endsWith(".css")) return "text/css; charset=utf-8";
  if (filePath.endsWith(".json")) return "application/json; charset=utf-8";
  return "text/plain; charset=utf-8";
}

export function requireNodePty(): {
  spawn: (file: string, args: string[], options: Record<string, unknown>) => unknown;
} {
  return requireFromRepo(
    path.resolve(resolveRepoRoot(), "src/apps/desktop/node_modules/node-pty")
  ) as {
    spawn: (file: string, args: string[], options: Record<string, unknown>) => unknown;
  };
}

export async function readJsonBody<T>(request: IncomingMessage): Promise<T> {
  const chunks: Buffer[] = [];
  for await (const chunk of request) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  }
  return JSON.parse(Buffer.concat(chunks).toString("utf-8")) as T;
}

export function sendJson(response: ServerResponse, statusCode: number, payload: unknown): void {
  response.writeHead(statusCode, JSON_HEADERS);
  response.end(JSON.stringify(payload));
}

export function readHost(): string {
  return process.env.MEETING_ROOM_DAEMON_HOST?.trim() || MEETING_ROOM_DAEMON_DEFAULT_HOST;
}

export function readPort(): number {
  const raw = process.env.MEETING_ROOM_DAEMON_PORT?.trim();
  if (!raw) return MEETING_ROOM_DAEMON_DEFAULT_PORT;
  const port = Number.parseInt(raw, 10);
  return Number.isNaN(port) || port <= 0 ? MEETING_ROOM_DAEMON_DEFAULT_PORT : port;
}

export function createId(prefix: string): string {
  return `${prefix}_${Date.now()}_${crypto.randomBytes(3).toString("hex")}`;
}

export function deepClone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

export function shellQuote(value: string): string {
  return `'${value.replace(/'/g, "'\"'\"'")}'`;
}

export function buildClaudeLaunchArgs(shell: string, command: string): string[] {
  if (process.platform === "win32") {
    return ["-NoLogo", "-Command", command];
  }
  if (path.basename(shell).toLowerCase().includes("zsh")) {
    return ["-lc", command];
  }
  return ["-lc", command];
}

export function ensureWorkspaceTrustAccepted(projectDir: string): void {
  const claudeConfigPath = path.join(os.homedir(), ".claude.json");
  if (!fs.existsSync(claudeConfigPath)) {
    return;
  }
  try {
    const raw = fs.readFileSync(claudeConfigPath, "utf-8");
    const parsed = JSON.parse(raw) as { projects?: Record<string, Record<string, unknown>> };
    const projects = parsed.projects ?? {};
    const normalized = path.resolve(projectDir);
    const realpath = fs.existsSync(normalized) ? fs.realpathSync(normalized) : normalized;
    const keys = [projectDir, normalized, realpath];
    const existingKey = keys.find((candidate) => typeof projects[candidate] === "object");
    const targetKey = existingKey ?? realpath;
    const existing = projects[targetKey] ?? {};
    if (existing.hasTrustDialogAccepted === true) {
      return;
    }
    parsed.projects = {
      ...projects,
      [targetKey]: {
        ...existing,
        hasTrustDialogAccepted: true
      }
    };
    fs.writeFileSync(claudeConfigPath, `${JSON.stringify(parsed, null, 2)}\n`, "utf-8");
  } catch {
    // Ignore trust bootstrap failures.
  }
}
