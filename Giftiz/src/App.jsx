import { useCallback, useEffect, useState } from "react";
import { NavLink, Route, Routes, useLocation, useNavigate } from "react-router-dom";
import "./App.css";
import Home from "./Home";
import About from "./About";
import Contact from "./Contact";
import SignUp from "./Sign-Up.jsx";
import LogIn from "./Log-In.jsx";
import EmailLogin from "./EmailLogin.jsx";
import Support from "./Support.jsx";
import Verify from "./Vertify.jsx";
import Checkout from "./Checkout.jsx";
import Media from "./Media.jsx";
import SearchEngineBar from "./SearchBar.jsx";
import Cart from "./Cart.jsx";
import ThankYou from "./ThankYou.jsx";
import Admin from "./Admin.jsx";
import Owner from "./Owner.jsx";
import InventoryAdmin from "./InventoryAdmin.jsx";
import OwnerSecurity from "./OwnerSecurity.jsx";
import PasswordRecovery from "./PasswordRecovery.jsx";
import PasswordReset from "./PasswordReset.jsx";

function App() {
  const location = useLocation();
  const navigate = useNavigate();
  const [isLoggedIn, setIsLoggedIn] = useState(() => Boolean(typeof window !== "undefined" && localStorage.getItem("sessionId")));
  const [isAdmin, setIsAdmin] = useState(false);

  const fetchAdminStatus = useCallback(async (sessionId) => {
    if (!sessionId) {
      setIsAdmin(false);
      return;
    }
    try {
      const res = await fetch(`http://localhost:3001/sessions/${sessionId}/admin`);
      if (!res.ok) {
        throw new Error("Unable to fetch admin status");
      }
      const data = await res.json();
      setIsAdmin(Boolean(data.admin));
    } catch (error) {
      setIsAdmin(false);
    }
  }, []);

  useEffect(() => {
    const syncSession = () => {
      const sessionId = localStorage.getItem("sessionId");
      const loggedIn = Boolean(sessionId);
      setIsLoggedIn(loggedIn);
      if (loggedIn) {
        fetchAdminStatus(sessionId);
      } else {
        setIsAdmin(false);
      }
    };
    window.addEventListener("storage", syncSession);
    window.addEventListener("giftiz-session-change", syncSession);
    syncSession();
    return () => {
      window.removeEventListener("storage", syncSession);
      window.removeEventListener("giftiz-session-change", syncSession);
    };
  }, [fetchAdminStatus]);

  useEffect(() => {
    const sessionId = localStorage.getItem("sessionId");
    setIsLoggedIn(Boolean(sessionId));
    if (sessionId) {
      fetchAdminStatus(sessionId);
    } else {
      setIsAdmin(false);
    }
  }, [location.key, fetchAdminStatus]);

  const handleLogout = useCallback(async () => {
    const sessionId = localStorage.getItem("sessionId");
    if (sessionId) {
      try {
        await fetch("http://localhost:3001/logout", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ sessionId })
        });
      } catch (error) {
        // best effort logout
      }
    }
    localStorage.removeItem("sessionId");
    setIsLoggedIn(false);
    setIsAdmin(false);
    window.dispatchEvent(new Event("giftiz-session-change"));
    navigate("/");
  }, [navigate]);

  return (
    <div className="app-shell">
      <header className="site-header surface">
        <div className="brand-group">
          <span className="brand-mark">Giftiz</span>
          <p className="brand-tagline">מציאות נעימות עם ניחוח סוף העשור הקודם</p>
        </div>
        <nav className="primary-nav">
          <NavLink to="/" end>בית</NavLink>
          <NavLink to="/media">מוצרים</NavLink>
          <NavLink to="/about">אודות</NavLink>
          <NavLink to="/support">תמיכה</NavLink>
          <NavLink to="/contact">צור קשר</NavLink>
        </nav>
        <div className="header-cta">
          <NavLink to="/cart" className="nav-pill">עגלה</NavLink>
          {isAdmin && (
            <NavLink to="/admin" className="nav-pill">מנהל</NavLink>
          )}
          {isLoggedIn ? (
            <button type="button" className="nav-pill btn-ghost" onClick={handleLogout}>התנתקות</button>
          ) : (
            <NavLink to="/signup" className="nav-pill accent">הצטרפו</NavLink>
          )}
        </div>
      </header>

      <div className="app-content">
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/about" element={<About />} />
          <Route path="/contact" element={<Contact />} />
          <Route path="/signup" element={<SignUp />} />
          <Route path="/login" element={<LogIn />} />
          <Route path="/login/email" element={<EmailLogin />} />
          <Route path="/support" element={<Support />} />
          <Route path="/verify" element={<Verify />} />
          <Route path="/password-recovery" element={<PasswordRecovery />} />
          <Route path="/password-reset" element={<PasswordReset />} />
          <Route path="/checkout" element={<Checkout />} />
          <Route path="/media" element={<Media />} />
          <Route path="/SearchEngineBar" element={<SearchEngineBar/>} />
          <Route path="/cart" element={<Cart/>} />
          <Route path="/thank-you" element={<ThankYou />} />
          <Route path="/admin" element={<Admin />} />
          <Route path="/admin/inventory" element={<InventoryAdmin />} />
          <Route path="/owner" element={<Owner />} />
          <Route path="/owner/security" element={<OwnerSecurity />} />
        </Routes>
      </div>

      <footer className="site-footer surface">
        <p>© {new Date().getFullYear()} Giftiz · מתנות אוצרות עם טאץ' חמים.</p>
        <div className="footer-links">
          <NavLink to="/support">תמיכה</NavLink>
          <NavLink to="/about">הסיפור שלנו</NavLink>
          <a href="mailto:support@giftiz.com">support@giftiz.com</a>
        </div>
      </footer>
    </div>
  );
}

export default App;
