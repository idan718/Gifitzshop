import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { TRUSTED_DEVICE_STORAGE_KEY } from "./authStorage";

function EmailLogin() {
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [emailLoginMessage, setEmailLoginMessage] = useState("");
  const [emailLoginTicketId, setEmailLoginTicketId] = useState("");
  const [emailLoginNeedsCode, setEmailLoginNeedsCode] = useState(false);
  const [emailLoginCode, setEmailLoginCode] = useState("");
  const [emailLoginLoading, setEmailLoginLoading] = useState(false);
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

  const startEmailLogin = async () => {
    setEmailLoginMessage("");
    setEmailLoginNeedsCode(false);
    setEmailLoginTicketId("");
    setEmailLoginLoading(true);
    const trustedDeviceToken = rememberDevice ? storedTrustedDeviceToken() : null;
    if (!rememberDevice) {
      localStorage.removeItem(TRUSTED_DEVICE_STORAGE_KEY);
    }
    try {
      const res = await fetch("http://localhost:3001/login-email", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, rememberDevice, trustedDeviceToken })
      });
      const data = await res.json();
      setEmailLoginMessage(data.message);
      if (res.ok && data.ticketId) {
        setEmailLoginTicketId(data.ticketId);
        setEmailLoginNeedsCode(true);
        setEmailLoginCode("");
      } else if (res.ok && data.sessionId) {
        localStorage.setItem("sessionId", data.sessionId);
        if (data.trustedDeviceToken) {
          localStorage.setItem(TRUSTED_DEVICE_STORAGE_KEY, data.trustedDeviceToken);
        }
        window.dispatchEvent(new Event("giftiz-session-change"));
        navigate("/");
      }
    } catch (error) {
      setEmailLoginMessage("לא ניתן לשלוח קוד אימות כעת.");
    } finally {
      setEmailLoginLoading(false);
    }
  };

  const verifyEmailLoginCode = async () => {
    if (!emailLoginTicketId || !emailLoginCode.trim()) {
      setEmailLoginMessage("הקלידו את קוד האימות שקיבלתם בדוא\"ל.");
      return;
    }
    setEmailLoginLoading(true);
    try {
      const res = await fetch("http://localhost:3001/login-email/verify-code", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ticketId: emailLoginTicketId, code: emailLoginCode, rememberDevice })
      });
      const data = await res.json();
      setEmailLoginMessage(data.message);
      if (res.ok && data.sessionId) {
        localStorage.setItem("sessionId", data.sessionId);
        if (data.trustedDeviceToken) {
          localStorage.setItem(TRUSTED_DEVICE_STORAGE_KEY, data.trustedDeviceToken);
        }
        window.dispatchEvent(new Event("giftiz-session-change"));
        setEmailLoginNeedsCode(false);
        setEmailLoginTicketId("");
        setEmailLoginCode("");
        navigate("/");
      }
    } catch (error) {
      setEmailLoginMessage("קוד האימות לא אומת. נסו שוב.");
    } finally {
      setEmailLoginLoading(false);
    }
  };

  return (
    <main className="page">
      <section className="surface stack">
        <div className="section-header">
          <h2>התחברות במייל</h2>
          <p className="form-helper">נשלח קוד אימות חד פעמי לדוא"ל שלכם, והזינו אותו כאן כדי להתחבר.</p>
        </div>

        <div className="form-fields">
          <div className="field">
            <label htmlFor="email-login-email">דוא"ל</label>
            <input
              id="email-login-email"
              type="email"
              placeholder={'הקלידו את כתובת הדוא"ל שלכם'}
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
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
          <button onClick={startEmailLogin} disabled={emailLoginLoading}>
            {emailLoginLoading && !emailLoginNeedsCode ? "שולח קוד..." : "שליחת קוד התחברות"}
          </button>
        </div>

        {emailLoginNeedsCode && (
          <div className="form-fields">
            <p className="form-helper">הקלידו את הקוד בן שש הספרות שנשלח אליכם.</p>
            <div className="field">
              <label htmlFor="email-login-code">קוד אימות</label>
              <input
                id="email-login-code"
                type="text"
                inputMode="numeric"
                autoComplete="one-time-code"
                placeholder="קוד אימות"
                value={emailLoginCode}
                onChange={(e) => setEmailLoginCode(e.target.value)}
              />
            </div>
            <button onClick={verifyEmailLoginCode} disabled={emailLoginLoading}>
              {emailLoginLoading ? "מאמת..." : "אישור והתחברות"}
            </button>
          </div>
        )}

        {emailLoginMessage && <p className="alert info" role="status" aria-live="polite">{emailLoginMessage}</p>}

        <div className="nav-grid">
          <button onClick={() => navigate("/login")}>התחברות עם סיסמה</button>
          <button onClick={() => navigate("/password-recovery")}>שכחתם סיסמה?</button>
          <button className="btn-ghost" onClick={() => navigate("/")}>חזרה לבית</button>
        </div>
      </section>
    </main>
  );
}

export default EmailLogin;
