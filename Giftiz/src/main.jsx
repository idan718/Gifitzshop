import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App.jsx";
import { BrowserRouter } from "react-router-dom";
import "./index.css";

function registerSessionHeartbeat() {
  if (typeof window === "undefined" || window.__sessionHeartbeatRegistered) {
    return;
  }
  window.__sessionHeartbeatRegistered = true;

  const HEARTBEAT_INTERVAL_MS = 4_000;
  let heartbeatTimer = null;

  const stopHeartbeat = () => {
    if (heartbeatTimer !== null) {
      clearInterval(heartbeatTimer);
      heartbeatTimer = null;
    }
  };
  
  const expireSessionLocally = () => {
    localStorage.removeItem("sessionId");
    stopHeartbeat();
    window.dispatchEvent(new Event("giftiz-session-change"));
  };

  const sendCloseIntent = (sessionId) => {
    if (!sessionId) {
      return;
    }

    const closeUrl = `http://localhost:3001/sessions/${sessionId}/close-intent`;

    if (navigator.sendBeacon) {
      try {
        const blob = new Blob([], { type: "text/plain" });
        navigator.sendBeacon(closeUrl, blob);
        return;
      } catch (error) {
        // fall back to fetch
      }
    }

    fetch(closeUrl, {
      method: "POST",
      keepalive: true
    }).catch(() => {
      // best effort
    });
  };

  const sendHeartbeat = async () => {
    const sessionId = localStorage.getItem("sessionId");
    if (!sessionId) {
      stopHeartbeat();
      return;
    }

    try {
      const res = await fetch(`http://localhost:3001/sessions/${sessionId}/ping`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        keepalive: true
      });

      if (res.status === 404 || res.status === 410 || res.status === 401) {
        expireSessionLocally();
      }
    } catch (error) {
      // Ignore transient network failures; do not expire the session client-side.
    }
  };

  const startHeartbeat = () => {
    stopHeartbeat();
    if (!localStorage.getItem("sessionId")) {
      return;
    }

    sendHeartbeat();
    heartbeatTimer = window.setInterval(sendHeartbeat, HEARTBEAT_INTERVAL_MS);
  };

  window.addEventListener("storage", () => {
    if (localStorage.getItem("sessionId")) {
      startHeartbeat();
    } else {
      stopHeartbeat();
    }
  });

  window.addEventListener("pagehide", (event) => {
    if (event.persisted) {
      return;
    }
    const sessionId = localStorage.getItem("sessionId");
    if (!sessionId) {
      return;
    }
    sendCloseIntent(sessionId);
  });

  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "visible" && localStorage.getItem("sessionId")) {
      startHeartbeat();
    }
  });

  startHeartbeat();
}

registerSessionHeartbeat();

ReactDOM.createRoot(document.getElementById("root")).render(
  <BrowserRouter>
    <App />
  </BrowserRouter>
);
