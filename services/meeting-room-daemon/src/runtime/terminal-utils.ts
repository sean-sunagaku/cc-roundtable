import type { RuntimeHandle } from "../types";
import { RESPONSE_MARKER_END, RESPONSE_MARKER_START } from "../constants";

export function extractMarkedContent(content: string): string {
  const start = content.indexOf(RESPONSE_MARKER_START);
  if (start < 0) return content;
  const bodyStart = start + RESPONSE_MARKER_START.length;
  const end = content.indexOf(RESPONSE_MARKER_END, bodyStart);
  if (end < 0) return content;
  return content.slice(bodyStart, end).trim();
}

export function stripAnsi(input: string): string {
  return input.replace(/\u001b\[[0-9;?]*[A-Za-z]/g, "").replace(/\u001b\][^\u0007]*\u0007/g, "");
}

export function hasClaudeReadySignal(text: string): boolean {
  const normalized = stripAnsi(text).replace(/\u0007/g, "");
  return /❯\s/.test(normalized) || /what task would you like the agent team/i.test(normalized);
}

function extractUsagePercent(text: string): number | null {
  const match = text.match(/used\s+(\d+)%/i);
  if (!match) return null;
  const percent = Number.parseInt(match[1], 10);
  return Number.isNaN(percent) ? null : percent;
}

export function isUsageLimitReached(text: string): boolean {
  if (/usage limit reached|weekly limit reached|limit has been reached/i.test(text)) {
    return true;
  }
  const percent = extractUsagePercent(text);
  return percent !== null && percent >= 100;
}

function isMcpStatusBadge(line: string): boolean {
  const compact = line.replace(/\s+/g, " ").trim();
  if (!compact) return false;
  if (!/\bmcp server failed\b/i.test(compact)) return false;
  if (!/\/mcp\b/i.test(compact)) return false;
  return /[·•]/.test(compact) || /\b\d+\s+mcp server failed\b/i.test(compact) || /\bmanage mcp servers\b/i.test(compact);
}

export function hasMcpFailureSignal(text: string): boolean {
  const normalized = stripAnsi(text).replace(/\u0007/g, "");
  const lines = normalized.split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
  return lines.some((line) => /mcp server failed/i.test(line) && !isMcpStatusBadge(line));
}

function shouldKeepTailLine(line: string): boolean {
  const compact = line.replace(/\s+/g, " ").trim();
  if (!compact) return false;
  if (/^[✢✳✶✻✽·⠂⠐⠒⠲⠴⠦⠧⠇⠋⠙⠸⏺]+$/.test(compact)) return false;
  if (/^\d+$/.test(compact)) return false;
  if (/^[a-zA-Z]$/.test(compact)) return false;
  return true;
}

export function collectTailLines(runtime: RuntimeHandle, chunk: string): string[] {
  const text = stripAnsi(chunk).replace(/\u0007/g, "");
  let pending = runtime.lineBuffer;
  const lines: string[] = [];
  for (const ch of text) {
    if (ch === "\r") {
      pending = "";
      continue;
    }
    if (ch === "\n") {
      const line = pending.trimEnd();
      if (shouldKeepTailLine(line)) {
        lines.push(line);
      }
      pending = "";
      continue;
    }
    const code = ch.charCodeAt(0);
    if (code < 32 && ch !== "\t") continue;
    pending += ch;
    if (pending.length > 4000) {
      pending = pending.slice(-4000);
    }
  }
  runtime.lineBuffer = pending;
  return lines;
}

export function collectDebugTail(existing: string[], chunk: string): string[] {
  const lines = chunk
    .split(/\r?\n/)
    .map((line) => stripAnsi(line).replace(/\u0007/g, "").trimEnd())
    .filter((line) => line.length > 0);
  return [...existing, ...lines].slice(-120);
}

export function suppressFallback(runtime: RuntimeHandle, durationMs: number): void {
  runtime.suppressFallbackUntil = Math.max(runtime.suppressFallbackUntil ?? 0, Date.now() + durationMs);
}

export function isFallbackAgentLine(line: string): boolean {
  const compact = line.replace(/\s+/g, " ").trim();
  if (!compact) return false;
  if (compact.length < 6) return false;
  if (/^[/\\]/.test(compact)) return false;
  if (/^chore|^scampering|^calculating/i.test(compact)) return false;
  if (/tokens|thinking|ctrl\+g|weekly limit|mcp server failed|use skill/i.test(compact)) return false;
  if (/チームに\s*broadcast\s*してください/i.test(compact)) return false;
  if (/bypass permissions/i.test(compact)) return false;
  if (/^Pondering|^ClaudeAPI$/i.test(compact)) return false;
  if (/^resets \d+pm|^\d+ MCP server failed/i.test(compact)) return false;
  if (/claude\s*code|opus\s*\d|claude in chrome enabled|successfully loaded skill/i.test(compact)) return false;
  if (/^~\/|repository\/|^\[ctx:\s*\d+%]/i.test(compact)) return false;
  if (/^reading \d+ file|^envisioning|^nebulizing|^now let me|^invalid tool parameters/i.test(compact)) return false;
  if (/ctrl\+o|shift\+tab|task would you like the agent team/i.test(compact)) return false;
  return true;
}

export function extractClaudeResponsesFromChunk(cleaned: string): string[] {
  const results: string[] = [];
  const seen = new Set<string>();
  const add = (value: string): void => {
    const compact = value.replace(/\s+/g, " ").trim();
    if (compact.length >= 8 && isFallbackAgentLine(compact) && !seen.has(compact)) {
      seen.add(compact);
      results.push(compact);
    }
  };
  const markerRe = /[⏺✳✶✢✻✽✿·]\s*([^\r\n]+?)(?=[\r\n]|─{2,}|❯\s|$)/g;
  let match: RegExpExecArray | null;
  while ((match = markerRe.exec(cleaned)) !== null) add(match[1]);
  const indentRe = /\s{2,}([^\r\n⏺✳✶✢✻✽✿·❯─\s][^\r\n⏺✳✶✢✻✽✿·❯─]*?)(?=[\r\n]|─{2,}|❯\s|[⏺✳✶✢✻✽✿·]|\s{4,}|$)/g;
  while ((match = indentRe.exec(cleaned)) !== null) add(match[1]);
  return results;
}
