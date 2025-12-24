import { useNavigate } from "react-router-dom";
import { useState, useEffect } from "react";
import './Home.css';


function Home() {

  const navigate = useNavigate();
  const [sessionId, setSessionId] = useState(() => localStorage.getItem("sessionId") || "");
  const isLoggedIn = Boolean(sessionId);

  useEffect(() => {
    const syncSession = () => setSessionId(localStorage.getItem("sessionId") || "");
    window.addEventListener("storage", syncSession);
    return () => window.removeEventListener("storage", syncSession);
  }, []);

  const handleLogout = async () => {
    const currentSession = localStorage.getItem("sessionId");
    if (!currentSession) {
      setSessionId("");
      window.dispatchEvent(new Event("giftiz-session-change"));
      return;
    }
    try {
      await fetch("http://localhost:3001/logout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sessionId: currentSession })
      });
    } catch (error) {
      // best effort logout
    }
    localStorage.removeItem("sessionId");
    setSessionId("");
    window.dispatchEvent(new Event("giftiz-session-change"));
  };

  const goToCart = () => {
    if (!isLoggedIn) {
      alert("אנא התחברו כדי לראות את העגלה");
      return;
    }
    navigate("/cart");
  };

  return (
    <main className="page">
      <section className="home-hero surface">
        <div className="home-hero-content">
          <p className="status-pill">אוצרות שנבחרו באהבה</p>
          <h1>ברוכים הבאים ל-Giftiz</h1>
          <p>גלו פריטים נבחרים, ניהלו את העגלה שלכם וסיימו תשלום בביטחון. חשבון אחד מסנכרן את כל המועדפים בכל עמוד.</p>
          {isLoggedIn && <span className="status-pill" aria-live="polite">ההתחברות פעילה</span>}
          <div className="home-primary-actions">
            <button onClick={() => navigate("/media")}>לעיון במוצרים</button>
            <button className="btn-ghost" onClick={goToCart}>לעגלה</button>
            {!isLoggedIn && (
              <button className="btn-ghost" onClick={() => navigate("/login")}>התחברות</button>
            )}
          </div>
        </div>
      </section>

    </main>
  )
}

export default Home;