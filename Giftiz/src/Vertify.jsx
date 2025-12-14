import { useMemo, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";

function Verify() {
  const navigate = useNavigate();
  const { state } = useLocation();
  const userId = useMemo(() => {
    if (state?.userId) {
      return state.userId;
    }
    const stored = typeof window !== "undefined" ? localStorage.getItem("giftizPendingUserId") : null;
    return stored ? Number(stored) : null;
  }, [state]);

  const [code, setCode] = useState("");
  const [msg, setMsg] = useState("");

  const sendCode = async () => {
    if (!userId) {
      setMsg("חסרים פרטי הרשמה. אנא מלאו שוב את טופס ההרשמה.");
      navigate("/signup");
      return;
    }

    const res = await fetch("http://localhost:3001/verify", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userId, code }),
    });

    const data = await res.json();
    setMsg(data.message);

    if (res.status === 200 && data.sessionId) {
      localStorage.removeItem("giftizPendingUserId");
      localStorage.setItem("sessionId", data.sessionId);
      window.dispatchEvent(new Event("giftiz-session-change"));
      navigate("/");
    }
  };

  return (
    <main className="page">
      <section className="surface stack">
        <h2>אמתו את הדואר האלקטרוני</h2>
        <p className="form-helper">הזינו את קוד בן שש הספרות ששלחנו לתיבת המייל שלכם.</p>

        <input
          type="text"
          placeholder="קוד אימות"
          onChange={(e) => setCode(e.target.value)}
        />

        <button onClick={sendCode}>אימות</button>

        {msg && <p>{msg}</p>}
      </section>
    </main>
  );
}

export default Verify;
