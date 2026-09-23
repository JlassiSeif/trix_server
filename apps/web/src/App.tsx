import { useEffect, useState } from "react";

// Scaffold only (M1b): proves the browser can reach the server over WebSocket.
// The lobby and table UI arrive in M3.
export function App() {
  const [status, setStatus] = useState("connecting…");

  useEffect(() => {
    const url = `${location.protocol === "https:" ? "wss" : "ws"}://${location.host}/ws`;
    const socket = new WebSocket(url);
    socket.onmessage = (event) => {
      const msg = JSON.parse(String(event.data)) as { type: string; engine?: string };
      if (msg.type === "hello") setStatus(`connected (engine ${msg.engine})`);
    };
    socket.onclose = () => setStatus("disconnected");
    return () => socket.close();
  }, []);

  return (
    <main style={{ fontFamily: "system-ui, sans-serif", padding: "2rem" }}>
      <h1>Trix</h1>
      <p>Server: {status}</p>
    </main>
  );
}
