import { useLocation, useNavigate } from "react-router-dom";
import { useState } from "react";

function PasswordReset() {
  const location = useLocation();
  const navigate = useNavigate();
  const { email, resetToken } = location.state || {};
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [status, setStatus] = useState("");
  const [loading, setLoading] = useState(false);

  if (!email || !resetToken) {
    return (
      <main className="page">
        <section className="surface stack">
          <h2>שחזור סיסמה</h2>
          <p>חזרו לדף הקודם כדי לבקש קוד שחזור חדש.</p>
          <button onClick={() => navigate("/password-recovery")}>חזרה</button>
        </section>
      </main>
    );
  }

  const submitReset = async () => {
    if (!password || password !== confirm) {
      setStatus("הסיסמאות אינן תואמות.");
      return;
    }
    setLoading(true);
    try {
      const res = await fetch("http://localhost:3001/forgot-password/reset", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, resetToken, newPassword: password })
      });
      const data = await res.json();
      setStatus(data.message);
      if (res.ok) {
        setTimeout(() => navigate("/login"), 1800);
      }
    } catch (error) {
      setStatus("שגיאה בשינוי הסיסמה.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="page">
      <section className="surface stack">
        <h2>הגדרת סיסמה חדשה</h2>
        <input
          type="password"
          placeholder="סיסמה חדשה"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />
        <input
          type="password"
          placeholder="אימות סיסמה"
          value={confirm}
          onChange={(e) => setConfirm(e.target.value)}
        />
        <button onClick={submitReset} disabled={loading}>
          {loading ? "מעדכן..." : "שמירת סיסמה"}
        </button>
        {status && <p>{status}</p>}
      </section>
    </main>
  );
}

export default PasswordReset;
