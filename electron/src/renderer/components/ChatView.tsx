import type { ChatMessage } from "@shared/types";
import { MessageBubble } from "./MessageBubble";

interface Props {
  messages: ChatMessage[];
}

export function ChatView({ messages }: Props): JSX.Element {
  const sorted = [...messages].sort((a, b) => a.timestamp.localeCompare(b.timestamp));
  return (
    <section className="chat-view">
      {sorted.length === 0 ? (
        <p className="subtle">メッセージはまだありません。最初の指示を送って会議を始めてください。</p>
      ) : (
        sorted.map((message) => <MessageBubble key={message.id} message={message} />)
      )}
    </section>
  );
}
