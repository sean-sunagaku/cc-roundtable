import { useMemo } from "react";
import { marked } from "marked";
import type { ChatMessage } from "@shared/types";

interface Props {
  message: ChatMessage;
}

export function MessageBubble({ message }: Props): JSX.Element {
  const html = useMemo(() => marked.parse(message.content, { async: false }), [message.content]);
  const time = new Date(message.timestamp).toLocaleTimeString("ja-JP");
  const roleClass = message.source === "human" ? "human" : "agent";
  const senderLabel = message.subagent?.trim() || message.sender;

  return (
    <article className={`bubble ${roleClass} ${message.status}`}>
      <header>
        <span className="sender">{senderLabel}</span>
        <span className="timestamp">{time}</span>
      </header>
      <div className="bubble-body markdown" dangerouslySetInnerHTML={{ __html: html }} />
    </article>
  );
}
