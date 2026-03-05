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
var import_electron = require("electron");
var api = {
  startMeeting: (config) => import_electron.ipcRenderer.invoke("meeting:start", config),
  endMeeting: (meetingId) => import_electron.ipcRenderer.invoke("meeting:end", meetingId),
  sendHumanMessage: (meetingId, message) => import_electron.ipcRenderer.invoke("meeting:human-message", meetingId, message),
  sendControlMessage: (meetingId, mode, extra) => import_electron.ipcRenderer.invoke("meeting:control-message", meetingId, mode, extra),
  listSkills: () => import_electron.ipcRenderer.invoke("meeting:list-skills"),
  listAgents: () => import_electron.ipcRenderer.invoke("meeting:list-agents"),
  saveAgent: (input) => import_electron.ipcRenderer.invoke("meeting:save-agent", input),
  listTabs: () => import_electron.ipcRenderer.invoke("meeting:list-tabs"),
  defaultProjectDir: () => import_electron.ipcRenderer.invoke("meeting:default-project-dir"),
  saveSummary: (payload) => import_electron.ipcRenderer.invoke("meeting:save-summary", payload),
  retryMcp: (meetingId) => import_electron.ipcRenderer.invoke("meeting:retry-mcp", meetingId),
  getSessionDebug: (meetingId) => import_electron.ipcRenderer.invoke("meeting:get-session-debug", meetingId),
  openSessionDebugWindow: (meetingId) => import_electron.ipcRenderer.invoke("meeting:open-session-debug-window", meetingId),
  openDevTools: () => import_electron.ipcRenderer.invoke("app:open-devtools"),
  resizeTerminal: (meetingId, cols, rows) => import_electron.ipcRenderer.invoke("meeting:resize-terminal", meetingId, cols, rows),
  writeTerminal: (meetingId, data) => import_electron.ipcRenderer.invoke("meeting:terminal-write", meetingId, data),
  onTerminalData: (handler) => {
    const listener = (_event, meetingId, chunk) => handler(meetingId, chunk);
    import_electron.ipcRenderer.on("terminal:data", listener);
    return () => import_electron.ipcRenderer.removeListener("terminal:data", listener);
  },
  onRelayMessage: (handler) => {
    const listener = (_event, payload) => handler(payload);
    import_electron.ipcRenderer.on("meeting:agent-message", listener);
    return () => import_electron.ipcRenderer.removeListener("meeting:agent-message", listener);
  },
  onTabsUpdate: (handler) => {
    const listener = (_event, tabs) => handler(tabs);
    import_electron.ipcRenderer.on("meeting:tabs", listener);
    return () => import_electron.ipcRenderer.removeListener("meeting:tabs", listener);
  },
  onRuntimeEvent: (handler) => {
    const listener = (_event, event) => handler(event);
    import_electron.ipcRenderer.on("meeting:runtime-event", listener);
    return () => import_electron.ipcRenderer.removeListener("meeting:runtime-event", listener);
  }
};
import_electron.contextBridge.exposeInMainWorld("meetingRoom", api);
//# sourceMappingURL=preload.js.map
