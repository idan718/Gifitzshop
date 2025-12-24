import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { TRUSTED_DEVICE_STORAGE_KEY } from "./authStorage";

function LogIn() {
  const navigate = useNavigate();
  const [name, setName] = useState("");
  const [pwd, setPwd] = useState("");
  const [msg, setMsg] = useState({ text: "", type: "info" });
  const [pendingTicketId, setPendingTicketId] = useState("");
  const [needsLoginCode, setNeedsLoginCode] = useState(false);
  const [loginCode, setLoginCode] = useState("");
  const [loginLoading, setLoginLoading] = useState(false);

  const [loginVerifying, setLoginVerifying] = useState(false);
  const [rememberDevice, setRememberDevice] = useState(() => {
    if (typeof window === "undefined") {
      return false;
    }
    return Boolean(localStorage.getItem(TRUSTED_DEVICE_STORAGE_KEY));
  });

  const storedTrustedDeviceToken = () => {
    if (typeof window === "undefined") {
      return null;
    }
    return localStorage.getItem(TRUSTED_DEVICE_STORAGE_KEY);
  };

  const resetFlows = () => {
    setNeedsLoginCode(false);
    setPendingTicketId("");
    setLoginCode("");
  };

  const completeLogin = (sessionId, trustedDeviceToken) => {
    localStorage.setItem("sessionId", sessionId);
    if (trustedDeviceToken) {
      localStorage.setItem(TRUSTED_DEVICE_STORAGE_KEY, trustedDeviceToken);
    }
    window.dispatchEvent(new Event("giftiz-session-change"));
    resetFlows();
    navigate("/");
  };

  const sendLogin = async () => {
    setMsg({ text: "", type: "info" });
    resetFlows();
    setLoginLoading(true);
    const trustedDeviceToken = rememberDevice ? storedTrustedDeviceToken() : null;
    if (!rememberDevice) {
      localStorage.removeItem(TRUSTED_DEVICE_STORAGE_KEY);
    }
    try {
      const res = await fetch("http://localhost:3001/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, pwd, rememberDevice, trustedDeviceToken })
      });

      const data = await res.json();
      setMsg({
        text: data.message || "",
        type: res.ok ? (data.sessionId ? "success" : "info") : "error"
      });

      if (data.trustedDeviceRejected) {
        localStorage.removeItem(TRUSTED_DEVICE_STORAGE_KEY);
      }

      if (res.ok && data.ticketId) {
        setPendingTicketId(data.ticketId);
        if (data.requiresLoginCode) {
          setNeedsLoginCode(true);
        }
      } else if (res.ok && data.sessionId) {
        completeLogin(data.sessionId, data.trustedDeviceToken);
      }
    } catch (error) {
      setMsg({ text: "לא ניתן להתחבר לשירות ההתחברות", type: "error" });
    } finally {
      setLoginLoading(false);
    }
  };

  const verifyLoginCode = async () => {
    if (!pendingTicketId || !loginCode.trim()) {
      setMsg({ text: "הזינו את קוד ההתחברות שנשלח אליכם", type: "error" });
      return;
    }
    setLoginVerifying(true);
    try {
      const res = await fetch("http://localhost:3001/login/verify-code", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ticketId: pendingTicketId, code: loginCode, rememberDevice })
      });
      const data = await res.json();
      setMsg({ text: data.message || "", type: res.ok ? "success" : "error" });
      if (!res.ok) {
        return;
      }
      setNeedsLoginCode(false);
      setLoginCode("");
      setPendingTicketId("");
      if (data.sessionId) {
        completeLogin(data.sessionId, data.trustedDeviceToken);
      }
    } catch (error) {
      setMsg({ text: "לא ניתן לאמת את קוד ההתחברות.", type: "error" });
    } finally {
      setLoginVerifying(false);
    }
  };

  const isBusy = loginLoading || loginVerifying;

  return (
    <main className="page">
      <section className="surface stack auth-panel">
        <div className="section-header">
          <h2>ברוכים השבים</h2>
          <p className="form-helper">התחברו כדי לשמור את העגלה מסונכרנת ולהמשיך בתשלום.</p>
        </div>

        <form
          className="form-fields"
          onSubmit={(e) => {
            e.preventDefault();
            if (!isBusy) {
              sendLogin();
            }
          }}
        >
          <div className="field">
            <label htmlFor="login-username">שם משתמש</label>
            <input
              id="login-username"
              type="text"
              placeholder="שם משתמש"
              autoComplete="username"
              value={name}
              onChange={(e) => setName(e.target.value)}
              disabled={isBusy}
              required
            />
          </div>

          <div className="field">
            <label htmlFor="login-password">סיסמה</label>
            <input
              id="login-password"
              type="password"
              placeholder="סיסמה"
              autoComplete="current-password"
              value={pwd}
              onChange={(e) => setPwd(e.target.value)}
              disabled={isBusy}
              required
            />
          </div>

          <label className="check-row">
            <input
              type="checkbox"
              checked={rememberDevice}
              onChange={(e) => setRememberDevice(e.target.checked)}
              disabled={isBusy}
            />
            לזכור אותי במכשיר זה
          </label>

          <div className="toolbar">
            <button type="submit" disabled={isBusy}>
              {loginLoading ? "שולח קוד..." : "שליחת קוד התחברות"}
            </button>
            <button type="button" className="btn-ghost" onClick={() => navigate("/password-recovery")} disabled={isBusy}>
              שחזור סיסמה
            </button>
          </div>
        </form>

        {needsLoginCode && (
          <form
            className="form-fields"
            onSubmit={(e) => {
              e.preventDefault();
              if (!loginVerifying) {
                verifyLoginCode();
              }
            }}
          >
            <p className="form-helper">הזינו את קוד ההתחברות החד-פעמי שנשלח אליכם במייל.</p>
            <div className="field">
              <label htmlFor="login-code">קוד אימות</label>
              <input
                id="login-code"
                type="text"
                inputMode="numeric"
                autoComplete="one-time-code"
                placeholder="קוד אימות"
                value={loginCode}
                onChange={(e) => setLoginCode(e.target.value)}
                disabled={loginVerifying}
              />
            </div>
            <button type="submit" disabled={loginVerifying}>
              {loginVerifying ? "מאמת..." : "אישור קוד"}
            </button>
          </form>
        )}

        {msg.text && <p className={`alert ${msg.type}`} role="status" aria-live="polite">{msg.text}</p>}
        <div className="nav-grid">
          <button onClick={() => navigate("/signup")}>צרו חשבון</button>
          <button onClick={() => navigate("/login/email")}>התחברות במייל</button>
          <button className="btn-ghost" onClick={() => navigate("/")}>חזרה לבית</button>
        </div>
      </section>
    </main>
  );
}

export default LogIn;
