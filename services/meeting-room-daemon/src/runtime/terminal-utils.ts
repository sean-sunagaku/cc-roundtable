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

function compactWhitespace(line: string): string {
  return line.replace(/\s+/g, " ").trim();
}

function compactAscii(line: string): string {
  return line.toLowerCase().replace(/[^a-z0-9]+/g, "");
}

function stripDecorativePrefix(line: string): string {
  return line.replace(/^[\s"'`>│├└╰╭╮╯•·⏺✳✶✢✻✽✿▶▸▹→←↳⎿┌┐┘└\-]+/, "").trim();
}

function isUiNoiseLine(line: string): boolean {
  const compact = compactWhitespace(line);
  if (!compact) return true;

  const plain = stripDecorativePrefix(compact);
  if (!plain) return true;
  const ascii = compactAscii(plain);

  if (/invalid tool parameters/i.test(plain)) return true;
  if (/bypass\s*permissions?/i.test(plain)) return true;
  if (/^\[?human ?input\]?$/i.test(plain)) return true;
  if (/^task would you like the agent team/i.test(plain)) return true;
  if (/^tool loaded\.?$/i.test(plain)) return true;
  if (/^initiali[sz]ing(?:\.\.\.|…)?$/i.test(plain)) return true;
  if (/^(read|searched for|recalled)\b/i.test(plain) && /(file|files|pattern|patterns|memory|memories|ctrl\+o to expand)/i.test(plain)) return true;
  if (/^\d+\s+agents?\s+launched\b/i.test(plain)) return true;
  if (/^beaming(?:\.\.\.|…)?(?:\s*\(.+\)|\s*\d+)?$/i.test(plain)) return true;
  if (/^~\/|repository\/|^\[ctx:\s*\d+%]/i.test(plain)) return true;
  if (/^@[a-z0-9._-]+(?:\s+@[a-z0-9._-]+)*\s+·\s+↓\s+to expand$/i.test(plain)) return true;
  if (/^(ctrl\+|shift\+tab|enter to send|esc to cancel)/i.test(plain)) return true;
  if (/^[A-Za-z][A-Za-z-]*ing(?:\.\.\.|…)$/.test(plain)) return true;
  if (/^".*\*\*\/\*.*"$/.test(plain)) return true;
  if (/\*\*\/\*/.test(plain)) return true;
  if (/チーム全体へ\s*broadcast\s*してください/i.test(plain)) return true;
  if (/そのうえで、必要な検討と提案を続けてください。/.test(plain)) return true;
  if (ascii.includes("nowiunderstandtheskill")) return true;
  if (ascii.includes("letmeloadtherequiredtoolsandstartthemeeting")) return true;
  return false;
}

function isSuppressedChatMessage(line: string): boolean {
  const compact = compactWhitespace(line);
  if (!compact) return true;
  if (/^#{1,6}\s*Team Event\b/i.test(compact)) return true;
  if (/TeamCreate を実行/.test(compact)) return true;
  if (/Task を作成/.test(compact)) return true;
  return isUiNoiseLine(compact);
}

export function collectDebugTail(existing: string[], chunk: string): string[] {
  const next = [...existing];
  for (const rawLine of chunk.split(/\r?\n/)) {
    const line = stripAnsi(rawLine).replace(/\u0007/g, "").trimEnd();
    if (!line.length || isUiNoiseLine(line)) {
      continue;
    }
    if (next[next.length - 1] === line) {
      continue;
    }
    next.push(line);
  }
  return next.slice(-120);
}

export function filterVisibleTailLines(lines: string[]): string[] {
  const filtered: string[] = [];
  for (const line of lines) {
    if (!line.length || isUiNoiseLine(line)) {
      continue;
    }
    if (filtered[filtered.length - 1] === line) {
      continue;
    }
    filtered.push(line);
  }
  return filtered.slice(-120);
}

export function shouldDisplayAgentMessageContent(content: string): boolean {
  return !isSuppressedChatMessage(content);
}
