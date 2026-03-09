import { useEffect, useRef } from "react";
import { MessageCircle } from "lucide-react";
import type { ChatMessage } from "@shared/types";
import { MessageBubble } from "./MessageBubble";

interface Props {
  messages: ChatMessage[];
}

export function ChatView({ messages }: Props): JSX.Element {
  const containerRef = useRef<HTMLDivElement>(null);
  const userScrolledRef = useRef(false);
  const prevCountRef = useRef(0);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const handleScroll = () => {
      const atBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 40;
      userScrolledRef.current = !atBottom;
    };
    el.addEventListener("scroll", handleScroll, { passive: true });
    return () => el.removeEventListener("scroll", handleScroll);
  }, []);

  useEffect(() => {
    if (messages.length > prevCountRef.current && !userScrolledRef.current) {
      const el = containerRef.current;
      if (el) {
        el.scrollTop = el.scrollHeight;
      }
    }
    prevCountRef.current = messages.length;
  }, [messages.length]);

  const sorted = [...messages].sort((a, b) => a.timestamp.localeCompare(b.timestamp));

  return (
    <section className="chat-view" ref={containerRef}>
      {sorted.length === 0 ? (
        <div className="empty-state">
          <MessageCircle size={40} strokeWidth={1.5} />
          <p>メッセージを待機中</p>
        </div>
      ) : (
        sorted.map((message) => <MessageBubble key={message.id} message={message} />)
      )}
    </section>
  );
}
