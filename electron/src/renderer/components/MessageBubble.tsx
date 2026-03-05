import { useMemo, useState } from "react";
import { marked } from "marked";
import type { ChatMessage } from "@shared/types";

interface Props {
  message: ChatMessage;
}

const FOLD_THRESHOLD = 320;

export function MessageBubble({ message }: Props): JSX.Element {
  const [expanded, setExpanded] = useState(false);
  const isLong = message.content.length > FOLD_THRESHOLD;
  const body = !isLong || expanded ? message.content : `${message.content.slice(0, FOLD_THRESHOLD)}...`;

  const html = useMemo(() => marked.parse(body, { async: false }), [body]);
  const time = new Date(message.timestamp).toLocaleTimeString("ja-JP");
  const roleClass = message.source === "human" ? "human" : "agent";

  return (
    <article className={`bubble ${roleClass} ${message.status}`}>
      <header>
        <span className="sender">{message.sender}</span>
        <span className="timestamp">{time}</span>
      </header>
      <div className="bubble-body markdown" dangerouslySetInnerHTML={{ __html: html }} />
      {isLong ? (
        <button className="fold-toggle" onClick={() => setExpanded((state) => !state)} type="button">
          {expanded ? "折りたたむ" : "続きを読む"}
        </button>
      ) : null}
    </article>
  );
}
