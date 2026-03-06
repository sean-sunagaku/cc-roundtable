import { FormEvent, KeyboardEvent, useState } from "react";

interface Props {
  disabled?: boolean;
  onSend: (message: string) => Promise<void>;
}

export function InputBar({ disabled, onSend }: Props): JSX.Element {
  const [value, setValue] = useState("");

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (!value.trim()) return;
    const msg = value;
    setValue("");
    await onSend(msg);
  };

  const onKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      void submit(event as unknown as FormEvent);
    }
  };

  return (
    <form className="input-bar" onSubmit={submit}>
      <textarea
        placeholder="会議にメッセージを送信..."
        value={value}
        onChange={(event) => setValue(event.target.value)}
        onKeyDown={onKeyDown}
        disabled={disabled}
      />
      <button type="submit" disabled={disabled || !value.trim()}>
        送信
      </button>
    </form>
  );
}
