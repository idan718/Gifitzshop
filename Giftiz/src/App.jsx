import { useCallback, useEffect, useState } from "react";
import { NavLink, Navigate, Route, Routes, useNavigate } from "react-router-dom";
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
import InventoryNewItem from "./InventoryNewItem.jsx";
import OwnerSecurity from "./OwnerSecurity.jsx";
import PasswordRecovery from "./PasswordRecovery.jsx";
import PasswordReset from "./PasswordReset.jsx";
import Orders from "./Orders.jsx";
import AdminOrders from "./AdminOrders.jsx";
import { TRUSTED_DEVICE_STORAGE_KEY } from "./authStorage";

function App() {
  const navigate = useNavigate();
  const [isLoggedIn, setIsLoggedIn] = useState(() => Boolean(typeof window !== "undefined" && localStorage.getItem("sessionId")));
  const [isAdmin, setIsAdmin] = useState(false);
  const [isOwner, setIsOwner] = useState(false);
  const [sessionReady, setSessionReady] = useState(false);

  const loadSessionRoles = useCallback(async (sessionId) => {
    if (!sessionId) {
      setIsAdmin(false);
      setIsOwner(false);
      return { admin: false, owner: false };
    }

    try {
      const res = await fetch(`http://localhost:3001/sessions/${sessionId}/admin`);
      if (!res.ok) {
        throw new Error("Unable to fetch admin status");
      }
      const data = await res.json();
      const adminFlag = Boolean(data.admin);
      const ownerFlag = Boolean(data.owner);
      setIsAdmin(adminFlag);
      setIsOwner(ownerFlag);
      return { admin: adminFlag, owner: ownerFlag };
    } catch (error) {
      setIsAdmin(false);
      setIsOwner(false);
      return { admin: false, owner: false };
    }
  }, []);

  const syncSessionState = useCallback(async () => {
    if (typeof window === "undefined") {
      setIsLoggedIn(false);
      setIsAdmin(false);
      setIsOwner(false);
      setSessionReady(true);
      return;
    }

    const sessionId = localStorage.getItem("sessionId");
    const loggedIn = Boolean(sessionId);
    setIsLoggedIn(loggedIn);

    if (loggedIn) {
      await loadSessionRoles(sessionId);
    } else {
      setIsAdmin(false);
      setIsOwner(false);
    }

    setSessionReady(true);
  }, [loadSessionRoles]);

  const tryTrustedAutoLogin = useCallback(async () => {
    if (typeof window === "undefined") {
      return;
    }
    const existingSession = localStorage.getItem("sessionId");
    if (existingSession) {
      return;
    }
    const token = localStorage.getItem(TRUSTED_DEVICE_STORAGE_KEY);
    if (!token) {
      return;
    }
    try {
      const res = await fetch("http://localhost:3001/login/trusted", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token })
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.message || "Trusted login failed");
      }
      if (data.sessionId) {
        localStorage.setItem("sessionId", data.sessionId);
      }
      if (data.trustedDeviceToken) {
        localStorage.setItem(TRUSTED_DEVICE_STORAGE_KEY, data.trustedDeviceToken);
      }
      window.dispatchEvent(new Event("giftiz-session-change"));
    } catch {
      // If the token is invalid/expired, remove it so we don't keep retrying.
      localStorage.removeItem(TRUSTED_DEVICE_STORAGE_KEY);
    }
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") {
      return undefined;
    }

    const handleSessionChange = () => {
      syncSessionState();
    };

    window.addEventListener("storage", handleSessionChange);
    window.addEventListener("giftiz-session-change", handleSessionChange);
    tryTrustedAutoLogin();
    syncSessionState();

    return () => {
      window.removeEventListener("storage", handleSessionChange);
      window.removeEventListener("giftiz-session-change", handleSessionChange);
    };
  }, [syncSessionState]);

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
    localStorage.removeItem(TRUSTED_DEVICE_STORAGE_KEY);
    setIsLoggedIn(false);
    setIsAdmin(false);
    setIsOwner(false);
    window.dispatchEvent(new Event("giftiz-session-change"));
    navigate("/");
  }, [navigate]);

  const RouteGuard = ({ children, allow, redirectTo = "/login" }) => {
    if (!sessionReady) {
      return (
        <div className="route-guard surface" aria-live="polite">
          טוען הרשאות משתמש...
        </div>
      );
    }

    if (!allow) {
      return <Navigate to={redirectTo} replace />;
    }

    return children;
  };

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
          {isLoggedIn && <NavLink to="/orders">הזמנות</NavLink>}
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
          <Route
            path="/orders"
            element={(
              <RouteGuard allow={isLoggedIn}>
                <Orders />
              </RouteGuard>
            )}
          />
          <Route
            path="/admin"
            element={(
              <RouteGuard allow={isLoggedIn && isAdmin}>
                <Admin />
              </RouteGuard>
            )}
          />
          <Route
            path="/admin/orders"
            element={(
              <RouteGuard allow={isLoggedIn && isAdmin}>
                <AdminOrders />
              </RouteGuard>
            )}
          />
          <Route
            path="/admin/inventory"
            element={(
              <RouteGuard allow={isLoggedIn && isAdmin}>
                <InventoryAdmin />
              </RouteGuard>
            )}
          />
          <Route
            path="/admin/inventory/new"
            element={(
              <RouteGuard allow={isLoggedIn && isAdmin}>
                <InventoryNewItem />
              </RouteGuard>
            )}
          />
          <Route
            path="/owner"
            element={(
              <RouteGuard allow={isLoggedIn && isOwner} redirectTo="/">
                <Owner />
              </RouteGuard>
            )}
          />
          <Route
            path="/owner/security"
            element={(
              <RouteGuard allow={isLoggedIn && isOwner} redirectTo="/">
                <OwnerSecurity />
              </RouteGuard>
            )}
          />
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
