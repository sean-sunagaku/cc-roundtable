var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);

// src/main/preload.ts
var preload_exports = {};
module.exports = __toCommonJS(preload_exports);
var import_electron2 = require("electron");

// src/main/renderer-ipc-client.ts
var import_electron = require("electron");
var RendererIpcClient = class {
  invoke(channel, ...args) {
    return import_electron.ipcRenderer.invoke(channel, ...args);
  }
  on(channel, handler) {
    const listener = (_event, ...args) => {
      handler(...args);
    };
    import_electron.ipcRenderer.on(channel, listener);
    return () => import_electron.ipcRenderer.removeListener(channel, listener);
  }
};

// src/main/preload.ts
var ipc = new RendererIpcClient();
var api = {
  startMeeting: (config) => ipc.invoke("meeting:start", config),
  endMeeting: (meetingId) => ipc.invoke("meeting:end", meetingId),
  sendHumanMessage: (meetingId, message) => ipc.invoke("meeting:human-message", meetingId, message),
  sendControlMessage: (meetingId, mode, extra) => ipc.invoke("meeting:control-message", meetingId, mode, extra),
  listSkills: () => ipc.invoke("meeting:list-skills"),
  listAgents: () => ipc.invoke("meeting:list-agents"),
  saveAgent: (input) => ipc.invoke("meeting:save-agent", input),
  listTabs: () => ipc.invoke("meeting:list-tabs"),
  defaultProjectDir: () => ipc.invoke("meeting:default-project-dir"),
  saveSummary: (payload) => ipc.invoke("meeting:save-summary", payload),
  retryMcp: (meetingId) => ipc.invoke("meeting:retry-mcp", meetingId),
  getSessionDebug: (meetingId) => ipc.invoke("meeting:get-session-debug", meetingId),
  openSessionDebugWindow: (meetingId) => ipc.invoke("meeting:open-session-debug-window", meetingId),
  openDevTools: () => ipc.invoke("app:open-devtools"),
  resizeTerminal: (meetingId, cols, rows) => ipc.invoke("meeting:resize-terminal", meetingId, cols, rows),
  writeTerminal: (meetingId, data) => ipc.invoke("meeting:terminal-write", meetingId, data),
  onTerminalData: (handler) => ipc.on("terminal:data", handler),
  onRelayMessage: (handler) => ipc.on("meeting:agent-message", handler),
  onTabsUpdate: (handler) => ipc.on("meeting:tabs", handler),
  onRuntimeEvent: (handler) => ipc.on("meeting:runtime-event", handler)
};
import_electron2.contextBridge.exposeInMainWorld("meetingRoom", api);
//# sourceMappingURL=preload.js.map
