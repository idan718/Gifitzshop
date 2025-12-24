import { useState } from "react";
import { useNavigate } from "react-router-dom";

function SignUp() {
  const navigate = useNavigate();

  const [name, setName] = useState("");
  const [pwd, setPwd] = useState("");
  const [userEmail, setUserEmail] = useState("");
  const [message, setMessage] = useState({ text: "", type: "info" });
  const [loading, setLoading] = useState(false);

  const sendData = async (e) => {
    e.preventDefault();
    if (loading) return;
    setMessage({ text: "", type: "info" });
    setLoading(true);

    try {
      const res = await fetch("http://localhost:3001/signup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, pwd, userEmail }),
      });

      const data = await res.json();
      setMessage({
        text: data.message || "",
        type: res.ok ? "success" : "error",
      });

      if (res.status === 200) {
        if (data.userId) {
          localStorage.setItem("giftizPendingUserId", String(data.userId));
        }
        // go to verify page with userId
        navigate("/verify", { state: { userId: data.userId } });
      }
    } catch (error) {
      setMessage({ text: "שגיאה בהתחברות לשרת", type: "error" });
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="page">
      <section className="surface stack auth-panel">
        <div className="section-header">
          <h2>צרו חשבון</h2>
          <p className="form-helper">נשלח קוד אימות כדי לוודא את כתובת הדוא"ל לפני שנפתח את הסשן.</p>
        </div>
        <form onSubmit={sendData}>
          <div className="form-fields">
            <div className="field">
              <label htmlFor="signup-username">שם משתמש</label>
              <input
                id="signup-username"
                type="text"
                placeholder="שם משתמש"
                autoComplete="username"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
                disabled={loading}
              />
            </div>

            <div className="field">
              <label htmlFor="signup-password">סיסמה</label>
              <input
                id="signup-password"
                type="password"
                placeholder="סיסמה"
                autoComplete="new-password"
                value={pwd}
                onChange={(e) => setPwd(e.target.value)}
                required
                disabled={loading}
              />
            </div>

            <div className="field">
              <label htmlFor="signup-email">דואר אלקטרוני</label>
              <input
                id="signup-email"
                type="email"
                placeholder="דואר אלקטרוני"
                autoComplete="email"
                value={userEmail}
                onChange={(e) => setUserEmail(e.target.value)}
                required
                disabled={loading}
              />
            </div>

            <div className="toolbar">
              <button type="submit" disabled={loading}>
                {loading ? "שולח קוד..." : "הרשמה"}
              </button>
              <button type="button" className="btn-ghost" onClick={() => navigate("/login")} disabled={loading}>
                כבר יש לכם חשבון?
              </button>
            </div>
          </div>
        </form>

        {message.text && <p className={`alert ${message.type}`} role="status" aria-live="polite">{message.text}</p>}
        <div className="nav-grid">
          <button onClick={() => navigate("/")}>חזרה לבית</button>
        </div>
      </section>
    </main>
  );
}

export default SignUp;