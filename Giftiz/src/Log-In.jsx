import { useState } from "react";
import { useNavigate } from "react-router-dom";

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

  const resetFlows = () => {
    setNeedsLoginCode(false);
    setPendingTicketId("");
    setLoginCode("");
  };

  const completeLogin = (sessionId) => {
    localStorage.setItem("sessionId", sessionId);
    window.dispatchEvent(new Event("giftiz-session-change"));
    resetFlows();
    navigate("/");
  };

  const sendLogin = async () => {
    setMsg("");
    resetFlows();
    setLoginLoading(true);
    try {
      const res = await fetch("http://localhost:3001/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, pwd })
      });

      const data = await res.json();
      setMsg(data.message);

      if (res.ok && data.ticketId) {
        setPendingTicketId(data.ticketId);
        if (data.requiresLoginCode) {
          setNeedsLoginCode(true);
        }
      } else if (res.ok && data.sessionId) {
        completeLogin(data.sessionId);
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
        body: JSON.stringify({ ticketId: pendingTicketId, code: loginCode })
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
        completeLogin(data.sessionId);
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
        <div className="stack">
          <h2>ברוכים השבים</h2>
          <p className="form-helper">התחברו כדי לשמור את העגלה מסונכרנת ולהמשיך בתשלום.</p>
        </div>

        <div className="stack">
          <input type="text" placeholder="שם משתמש"
            onChange={(e) => setName(e.target.value)} />

          <input type="password" placeholder="סיסמה"
            onChange={(e) => setPwd(e.target.value)} />

          <button onClick={sendLogin} disabled={loginLoading}>
            {loginLoading ? "שולח קוד..." : "שליחת קוד התחברות"}
          </button>
        </div>

        {needsLoginCode && (
          <div className="stack">
            <p className="form-helper">הזינו את קוד ההתחברות החד-פעמי שנשלח אליכם במייל.</p>
            <input
              type="text"
              placeholder="קוד אימות"
              value={loginCode}
              onChange={(e) => setLoginCode(e.target.value)}
            />
            <button onClick={verifyLoginCode} disabled={loginVerifying}>
              {loginVerifying ? "מאמת..." : "אישור קוד"}
            </button>
          </div>
        )}

        {msg && <p>{msg}</p>}
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
