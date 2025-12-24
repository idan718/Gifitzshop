import { useState } from "react";
import { useNavigate } from "react-router-dom";

function PasswordRecovery() {
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [status, setStatus] = useState("");
  const [step, setStep] = useState("request");
  const [loading, setLoading] = useState(false);

  const requestCode = async () => {
    setStatus("");
    setLoading(true);
    try {
      const res = await fetch("http://localhost:3001/forgot-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email })
      });
      const data = await res.json();
      setStatus(data.message);
      if (res.ok) {
        setStep("verify");
      }
    } catch (error) {
      setStatus("שגיאה בשליחת קוד האימות. נסו שוב בעוד רגע.");
    } finally {
      setLoading(false);
    }
  };

  const verifyCode = async () => {
    if (!code.trim()) {
      setStatus("הקלידו את קוד האימות שנשלח למייל.");
      return;
    }
    setLoading(true);
    try {
      const res = await fetch("http://localhost:3001/forgot-password/verify-code", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, code })
      });
      const data = await res.json();
      setStatus(data.message);
      if (res.ok && data.resetToken) {
        navigate("/password-reset", { state: { email, resetToken: data.resetToken } });
      }
    } catch (error) {
      setStatus("לא ניתן לאמת את הקוד כרגע.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="page">
      <section className="surface stack">
        <div className="section-header">
          <h2>שחזור סיסמה</h2>
          <p className="form-helper">הזינו את כתובת הדוא"ל איתה נרשמתם ונשלח קוד אימות לשחזור.</p>
        </div>

        <div className="form-fields">
          <div className="field">
            <label htmlFor="recovery-email">דוא"ל</label>
            <input
              id="recovery-email"
              type="email"
              placeholder={'דוא"ל'}
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </div>

          <button onClick={requestCode} disabled={loading}>
            {loading && step === "request" ? "שולח..." : "שליחת קוד שחזור"}
          </button>
        </div>

        {step === "verify" && (
          <div className="form-fields">
            <p className="form-helper">הקלידו את הקוד בן שש הספרות שקיבלתם במייל.</p>
            <div className="field">
              <label htmlFor="recovery-code">קוד אימות</label>
              <input
                id="recovery-code"
                type="text"
                inputMode="numeric"
                autoComplete="one-time-code"
                placeholder="קוד אימות"
                value={code}
                onChange={(e) => setCode(e.target.value)}
              />
            </div>
            <button onClick={verifyCode} disabled={loading}>
              {loading && step === "verify" ? "מאמת..." : "אישור והמשך"}
            </button>
          </div>
        )}

        {status && <p className="alert info" role="status" aria-live="polite">{status}</p>}
        <div className="nav-grid">
          <button className="btn-ghost" onClick={() => navigate("/login")}>חזרה להתחברות</button>
          <button onClick={() => navigate("/")}>חזרה לבית</button>
        </div>
      </section>
    </main>
  );
}

export default PasswordRecovery;
