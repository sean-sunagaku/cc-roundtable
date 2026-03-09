import { useMemo, useState } from "react";
import { marked } from "marked";
import type { ChatMessage } from "@shared/types";

interface Props {
  message: ChatMessage;
}

const AGENT_COLORS = [
  "#2E8A82", "#B8892A", "#7B6DAF", "#B06B78",
  "#5A9472", "#B07A4E", "#5A7FA0", "#9A6B90",
];

const FOLD_THRESHOLD = 80;
const FOLD_VISIBLE = 20;

function hashColor(name: string): string {
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = ((hash << 5) - hash + name.charCodeAt(i)) | 0;
  }
  return AGENT_COLORS[Math.abs(hash) % AGENT_COLORS.length];
}

function countLines(content: string): number {
  return content.split("\n").length;
}

export function MessageBubble({ message }: Props): JSX.Element {
  const [folded, setFolded] = useState(true);
  const html = useMemo(() => marked.parse(message.content, { async: false }), [message.content]);
  const time = new Date(message.timestamp).toLocaleTimeString("ja-JP");
  const roleClass = message.source === "human" ? "human" : "agent";
  const senderLabel = message.subagent?.trim() || message.sender;
  const lineCount = countLines(message.content);
  const isLong = lineCount > FOLD_THRESHOLD;
  const agentColor = message.source === "agent" ? hashColor(senderLabel) : undefined;

  const style = agentColor
    ? ({ "--agent-color": agentColor } as React.CSSProperties)
    : undefined;

  return (
    <article className={`bubble ${roleClass} ${message.status}`} style={style}>
      <header>
        <span className="sender">{senderLabel}</span>
        <span className="timestamp">{time}</span>
      </header>
      <div
        className={`bubble-body markdown${isLong && folded ? " folded" : ""}`}
        dangerouslySetInnerHTML={{ __html: html }}
      />
      {isLong ? (
        <button
          type="button"
          className="fold-toggle"
          onClick={() => setFolded((v) => !v)}
        >
          {folded
            ? `${FOLD_VISIBLE}/${lineCount} 行を表示中 — 全文を展開`
            : "折りたたむ"}
        </button>
      ) : null}
    </article>
  );
}
