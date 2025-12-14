import { useState } from "react";
import { useNavigate } from "react-router-dom";

function SignUp() {
  const navigate = useNavigate();

  const [name, setName] = useState("");
  const [pwd, setPwd] = useState("");
  const [userEmail, setUserEmail] = useState("");
  const [message, setMessage] = useState("");

  const sendData = async (e) => {
    e.preventDefault();

    const res = await fetch("http://localhost:3001/signup", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, pwd, userEmail }),
    });

    const data = await res.json();
    setMessage(data.message);

    if (res.status === 200) {
      if (data.userId) {
        localStorage.setItem("giftizPendingUserId", String(data.userId));
      }
      // go to verify page with userId
      navigate("/verify", { state: { userId: data.userId } });
    }
  };

  return (
    <main className="page">
      <section className="surface stack">
        <div className="stack">
          <h2>צרו חשבון</h2>
          <p className="form-helper">נשלח קוד אימות כדי לוודא את כתובת הדוא"ל לפני שנפתח את הסשן.</p>
        </div>
        <form onSubmit={sendData}>
          <input type="text" placeholder="שם משתמש"
            onChange={(e) => setName(e.target.value)} required />

          <input type="password" placeholder="סיסמה"
            onChange={(e) => setPwd(e.target.value)} required />

          <input type="email" placeholder="דואר אלקטרוני"
            onChange={(e) => setUserEmail(e.target.value)} required />

          <button type="submit">הרשמה</button>
        </form>

        {message && <p>{message}</p>}
        <div className="nav-grid">
          <button className="btn-ghost" onClick={() => navigate("/login")}>כבר יש לכם חשבון?</button>
          <button onClick={() => navigate("/")}>חזרה לבית</button>
        </div>
      </section>
    </main>
  );
}

export default SignUp;