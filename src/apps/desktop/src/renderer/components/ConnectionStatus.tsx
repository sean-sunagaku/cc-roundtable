import { Wifi, WifiOff } from "lucide-react";

interface Props {
  connected: boolean;
}

export function ConnectionStatus({ connected }: Props): JSX.Element {
  return (
    <span className={`connection ${connected ? "ok" : "ng"}`}>
      {connected ? (
        <>
          <Wifi size={12} strokeWidth={1.5} />
          Connected
        </>
      ) : (
        <>
          <WifiOff size={12} strokeWidth={1.5} />
          Waiting
        </>
      )}
    </span>
  );
}
