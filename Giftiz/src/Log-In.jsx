import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { TRUSTED_DEVICE_STORAGE_KEY } from "./authStorage";

function LogIn() {
  const navigate = useNavigate();
  const [name, setName] = useState("");
  const [pwd, setPwd] = useState("");
  const [msg, setMsg] = useState("");
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
    setMsg("");
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
      setMsg(data.message);

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
      setMsg("לא ניתן להתחבר לשירות ההתחברות");
    } finally {
      setLoginLoading(false);
    }
  };

  const verifyLoginCode = async () => {
    if (!pendingTicketId || !loginCode.trim()) {
      setMsg("הזינו את קוד ההתחברות שנשלח אליכם");
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
      setMsg(data.message);
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
      setMsg("לא ניתן לאמת את קוד ההתחברות.");
    } finally {
      setLoginVerifying(false);
    }
  };

  return (
    <main className="page">
      <section className="surface stack">
        <div className="section-header">
          <h2>ברוכים השבים</h2>
          <p className="form-helper">התחברו כדי לשמור את העגלה מסונכרנת ולהמשיך בתשלום.</p>
        </div>

        <div className="form-fields">
          <div className="field">
            <label htmlFor="login-username">שם משתמש</label>
            <input
              id="login-username"
              type="text"
              placeholder="שם משתמש"
              autoComplete="username"
              onChange={(e) => setName(e.target.value)}
            />
          </div>

          <div className="field">
            <label htmlFor="login-password">סיסמה</label>
            <input
              id="login-password"
              type="password"
              placeholder="סיסמה"
              autoComplete="current-password"
              onChange={(e) => setPwd(e.target.value)}
            />
          </div>

          <label className="check-row">
            <input
              type="checkbox"
              checked={rememberDevice}
              onChange={(e) => setRememberDevice(e.target.checked)}
            />
            לזכור אותי במכשיר זה
          </label>

          <button onClick={sendLogin} disabled={loginLoading}>
            {loginLoading ? "שולח קוד..." : "שליחת קוד התחברות"}
          </button>
        </div>

        {needsLoginCode && (
          <div className="form-fields">
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
              />
            </div>
            <button onClick={verifyLoginCode} disabled={loginVerifying}>
              {loginVerifying ? "מאמת..." : "אישור קוד"}
            </button>
          </div>
        )}

        {msg && <p className="alert info" role="status" aria-live="polite">{msg}</p>}
        <div className="nav-grid">
          <button onClick={() => navigate("/signup")}>צרו חשבון</button>
          <button onClick={() => navigate("/login/email")}>התחברות במייל</button>
          <button onClick={() => navigate("/password-recovery")}>שחזור סיסמה</button>
          <button className="btn-ghost" onClick={() => navigate("/")}>חזרה לבית</button>
        </div>
      </section>
    </main>
  );
}

export default LogIn;
