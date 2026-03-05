import type { BrowserWindow } from "electron";
import { ipcMain } from "electron";
import type {
  MainInvokeArgs,
  MainInvokeChannel,
  MainInvokeResult,
  RendererEventArgs,
  RendererEventChannel
} from "@shared/ipc";

type MaybePromise<T> = T | Promise<T>;

export class MainIpcRouter {
  constructor(private readonly getMainWindow: () => BrowserWindow | null) {}

  handle<C extends MainInvokeChannel>(
    channel: C,
    handler: (...args: MainInvokeArgs<C>) => MaybePromise<MainInvokeResult<C>>
  ): void {
    ipcMain.handle(channel, (_event, ...args: unknown[]) => handler(...(args as MainInvokeArgs<C>)));
  }

  send<C extends RendererEventChannel>(channel: C, ...args: RendererEventArgs<C>): void {
    const mainWindow = this.getMainWindow();
    if (!mainWindow) return;
    mainWindow.webContents.send(channel, ...args);
  }
}
