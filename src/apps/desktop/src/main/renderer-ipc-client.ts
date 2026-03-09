import { ipcRenderer } from "electron";
import type {
  MainInvokeArgs,
  MainInvokeChannel,
  MainInvokeResult,
  RendererEventArgs,
  RendererEventChannel
} from "@shared/ipc";

export class RendererIpcClient {
  invoke<C extends MainInvokeChannel>(channel: C, ...args: MainInvokeArgs<C>): Promise<MainInvokeResult<C>> {
    return ipcRenderer.invoke(channel, ...args) as Promise<MainInvokeResult<C>>;
  }

  on<C extends RendererEventChannel>(channel: C, handler: (...args: RendererEventArgs<C>) => void): () => void {
    const listener = (_event: unknown, ...args: unknown[]) => {
      handler(...(args as RendererEventArgs<C>));
    };
    ipcRenderer.on(channel, listener);
    return () => ipcRenderer.removeListener(channel, listener);
  }
}
