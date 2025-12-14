import { useState } from "react";
import { useNavigate } from "react-router-dom";

function EmailLogin() {
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [emailLoginMessage, setEmailLoginMessage] = useState("");
  const [emailLoginTicketId, setEmailLoginTicketId] = useState("");
  const [emailLoginNeedsCode, setEmailLoginNeedsCode] = useState(false);
  const [emailLoginCode, setEmailLoginCode] = useState("");
  const [emailLoginLoading, setEmailLoginLoading] = useState(false);

  const startEmailLogin = async () => {
    setEmailLoginMessage("");
    setEmailLoginNeedsCode(false);
    setEmailLoginTicketId("");
    setEmailLoginLoading(true);
    try {
      const res = await fetch("http://localhost:3001/login-email", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email })
      });
      const data = await res.json();
      setEmailLoginMessage(data.message);
      if (res.ok && data.ticketId) {
        setEmailLoginTicketId(data.ticketId);
        setEmailLoginNeedsCode(true);
        setEmailLoginCode("");
      } else if (res.ok && data.sessionId) {
        localStorage.setItem("sessionId", data.sessionId);
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
        body: JSON.stringify({ ticketId: emailLoginTicketId, code: emailLoginCode })
      });
      const data = await res.json();
      setEmailLoginMessage(data.message);
      if (res.ok && data.sessionId) {
        localStorage.setItem("sessionId", data.sessionId);
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
        <div className="stack">
          <h2>התחברות במייל</h2>
          <p className="form-helper">נשלח קוד אימות חד פעמי לדוא"ל שלכם, והזינו אותו כאן כדי להתחבר.</p>
        </div>

        <div className="stack">
          <input
            type="email"
            placeholder={'הקלידו את כתובת הדוא"ל שלכם'}
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
          <button onClick={startEmailLogin} disabled={emailLoginLoading}>
            {emailLoginLoading && !emailLoginNeedsCode ? "שולח קוד..." : "שליחת קוד התחברות"}
          </button>
        </div>

        {emailLoginNeedsCode && (
          <div className="stack">
            <p className="form-helper">הקלידו את הקוד בן שש הספרות שנשלח אליכם.</p>
            <input
              type="text"
              placeholder="קוד אימות"
              value={emailLoginCode}
              onChange={(e) => setEmailLoginCode(e.target.value)}
            />
            <button onClick={verifyEmailLoginCode} disabled={emailLoginLoading}>
              {emailLoginLoading ? "מאמת..." : "אישור והתחברות"}
            </button>
          </div>
        )}

        {emailLoginMessage && <p>{emailLoginMessage}</p>}

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
