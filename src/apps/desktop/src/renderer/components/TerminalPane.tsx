import { useEffect, useRef } from "react";
import { Terminal } from "@xterm/xterm";
import { FitAddon } from "@xterm/addon-fit";

interface Props {
  meetingId: string;
  onResize: (meetingId: string, cols: number, rows: number) => Promise<void>;
  writeData: (meetingId: string, data: string) => Promise<boolean>;
  subscribeData: (handler: (meetingId: string, chunk: string) => void) => () => void;
  initialContent?: string;
}

export function TerminalPane({
  meetingId,
  onResize,
  writeData,
  subscribeData,
  initialContent
}: Props): JSX.Element {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const terminalRef = useRef<Terminal | null>(null);
  const seededRef = useRef(false);

  const runTerminalCommand = (command: Promise<unknown>) => {
    void command.catch(() => undefined);
  };

  useEffect(() => {
    seededRef.current = false;
    const term = new Terminal({
      cursorBlink: true,
      theme: {
        background: "#0B1A2A",
        foreground: "#D8E8F5",
        cursor: "#5BA8A0",
        cursorAccent: "#0B1A2A",
        selectionBackground: "#294A66"
      }
    });
    const fit = new FitAddon();
    term.loadAddon(fit);
    terminalRef.current = term;

    if (containerRef.current) {
      term.open(containerRef.current);
      fit.fit();
      term.focus();
      runTerminalCommand(onResize(meetingId, term.cols, term.rows));
    }

    const unsub = subscribeData((incomingId, chunk) => {
      if (incomingId !== meetingId) return;
      term.write(chunk);
    });

    const dataListener = term.onData((data) => {
      runTerminalCommand(writeData(meetingId, data));
    });

    const observer = new ResizeObserver(() => {
      fit.fit();
      runTerminalCommand(onResize(meetingId, term.cols, term.rows));
    });
    if (containerRef.current) observer.observe(containerRef.current);

    return () => {
      dataListener.dispose();
      observer.disconnect();
      unsub();
      term.dispose();
      terminalRef.current = null;
      seededRef.current = false;
    };
  }, [meetingId, onResize, subscribeData, writeData]);

  useEffect(() => {
    if (seededRef.current) return;
    const term = terminalRef.current;
    if (!term) return;
    if (!initialContent || !initialContent.trim()) return;
    term.write(`${initialContent}\r\n`);
    seededRef.current = true;
  }, [initialContent, meetingId]);

  const handleContainerClick = () => {
    terminalRef.current?.focus();
  };

  return (
    <div
      className="terminal-pane"
      ref={containerRef}
      onClick={handleContainerClick}
      onFocus={() => terminalRef.current?.focus()}
      tabIndex={0}
      role="application"
    />
  );
}
