import fs from "node:fs";
import path from "node:path";
import type { DurableEvent } from "../types";

export class DurableEventLogStore {
  constructor(private readonly eventLogDir: string) {
    fs.mkdirSync(this.eventLogDir, { recursive: true });
  }

  append(event: DurableEvent): void {
    const filePath = path.resolve(this.eventLogDir, `${event.meetingId}.jsonl`);
    fs.mkdirSync(path.dirname(filePath), { recursive: true });
    fs.appendFileSync(filePath, `${JSON.stringify(event)}\n`, "utf-8");
  }

  readAll(): DurableEvent[] {
    if (!fs.existsSync(this.eventLogDir)) {
      return [];
    }

    const events: DurableEvent[] = [];
    for (const entry of fs.readdirSync(this.eventLogDir)) {
      if (!entry.endsWith(".jsonl")) {
        continue;
      }
      const filePath = path.resolve(this.eventLogDir, entry);
      const lines = fs.readFileSync(filePath, "utf-8").split(/\r?\n/).filter(Boolean);
      for (const line of lines) {
        try {
          events.push(JSON.parse(line) as DurableEvent);
        } catch {
          // Ignore malformed log lines.
        }
      }
    }
    return events;
  }
}
