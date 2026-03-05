interface Props {
  connected: boolean;
}

export function ConnectionStatus({ connected }: Props): JSX.Element {
  return (
    <span className={`connection ${connected ? "ok" : "ng"}`}>
      {connected ? "WS Connected" : "WS Waiting"}
    </span>
  );
}
