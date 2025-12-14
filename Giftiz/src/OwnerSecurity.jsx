import { useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";

function OwnerSecurity() {
  const navigate = useNavigate();
  const [sessionId, setSessionId] = useState(() => (typeof window !== "undefined" ? localStorage.getItem("sessionId") : null));
  const [addAdminId, setAddAdminId] = useState("");
  const [removeAdminId, setRemoveAdminId] = useState("");
  const [deleteUserId, setDeleteUserId] = useState("");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const syncSession = () => setSessionId(localStorage.getItem("sessionId"));
    window.addEventListener("storage", syncSession);
    window.addEventListener("giftiz-session-change", syncSession);
    return () => {
      window.removeEventListener("storage", syncSession);
      window.removeEventListener("giftiz-session-change", syncSession);
    };
  }, []);

  const requireSession = useCallback(() => {
    if (!sessionId) {
      setMessage("עליכם להתחבר כבעלים כדי לבצע פעולה זו.");
      return false;
    }
    return true;
  }, [sessionId]);

  const removeAdmin = async (event) => {
    event.preventDefault();
    setMessage("");
    if (!requireSession()) {
      return;
    }
    if (!removeAdminId.trim()) {
      setMessage("הזינו מזהה משתמש להסרת הרשאות מנהל.");
      return;
    }
    setLoading(true);
    try {
      const res = await fetch("http://localhost:3001/owner/actions/remove-admin", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-session-id": sessionId
        },
        body: JSON.stringify({ userId: removeAdminId })
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.message || "לא ניתן להסיר הרשאות מנהל");
      }
      setMessage(data.message);
      setRemoveAdminId("");
    } catch (err) {
      setMessage(err.message);
    } finally {
      setLoading(false);
    }
  };

  const addAdmin = async (event) => {
    event.preventDefault();
    setMessage("");
    if (!requireSession()) {
      return;
    }
    if (!addAdminId.trim()) {
      setMessage("הזינו מזהה משתמש להענקת הרשאות מנהל.");
      return;
    }
    setLoading(true);
    try {
      const res = await fetch("http://localhost:3001/owner/actions/add-admin", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-session-id": sessionId
        },
        body: JSON.stringify({ userId: addAdminId })
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.message || "לא ניתן להעניק הרשאות מנהל");
      }
      setMessage(data.message);
      setAddAdminId("");
    } catch (err) {
      setMessage(err.message);
    } finally {
      setLoading(false);
    }
  };

  const deleteUser = async (event) => {
    event.preventDefault();
    setMessage("");
    if (!requireSession()) {
      return;
    }
    if (!deleteUserId.trim()) {
      setMessage("הזינו מזהה משתמש למחיקה.");
      return;
    }
    if (!window.confirm("האם אתם בטוחים שברצונכם למחוק את המשתמש?") ) {
      return;
    }
    setLoading(true);
    try {
      const res = await fetch(`http://localhost:3001/owner/users/${deleteUserId}`, {
        method: "DELETE",
        headers: {
          "Content-Type": "application/json",
          "x-session-id": sessionId
        }
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.message || "לא ניתן למחוק את המשתמש");
      }
      setMessage(data.message);
      setDeleteUserId("");
    } catch (err) {
      setMessage(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="page">
      <section className="surface stack">
        <div className="stack">
          <h1>ניהול הרשאות בעלים</h1>
          <p className="form-helper">בצעו פעולות רגישות כמו הסרת הרשאות מנהל או מחיקת משתמשים באמצעות מזהה המשתמש.</p>
        </div>

        <form className="stack" onSubmit={addAdmin}>
          <h2>הענקת הרשאות מנהל</h2>
          <p className="form-helper">הזינו את מזהה המשתמש שיקבל סמכויות מנהל. המשתמש יידרש להתחבר מחדש.</p>
          <input
            type="number"
            min="1"
            placeholder="מזהה משתמש"
            value={addAdminId}
            onChange={(e) => setAddAdminId(e.target.value)}
          />
          <button type="submit" disabled={loading}>
            {loading ? "מבצע..." : "הענק הרשאות מנהל"}
          </button>
        </form>

        <form className="stack" onSubmit={removeAdmin}>
          <h2>הסרת הרשאות מנהל</h2>
          <p className="form-helper">הזינו את מזהה המשתמש כדי להסיר ממנו הרשאות מנהל ולאלץ אותו להתחבר מחדש כמשתמש רגיל.</p>
          <input
            type="number"
            min="1"
            placeholder="מזהה משתמש"
            value={removeAdminId}
            onChange={(e) => setRemoveAdminId(e.target.value)}
          />
          <button type="submit" disabled={loading}>
            {loading ? "מבצע..." : "הסר הרשאות מנהל"}
          </button>
        </form>

        <form className="stack" onSubmit={deleteUser}>
          <h2>מחיקת משתמש</h2>
          <p className="form-helper">מחיקת משתמש תמחק לצמיתות את ההרשאות והסשנים שלו.</p>
          <input
            type="number"
            min="1"
            placeholder="מזהה משתמש"
            value={deleteUserId}
            onChange={(e) => setDeleteUserId(e.target.value)}
          />
          <button type="submit" className="danger" disabled={loading}>
            {loading ? "מבצע..." : "מחק משתמש"}
          </button>
        </form>

        {message && <p>{message}</p>}

        <div className="nav-grid">
          <button onClick={() => navigate("/owner")}>חזרה לקונסולת הבעלים</button>
          <button className="btn-ghost" onClick={() => navigate("/")}>חזרה לבית</button>
        </div>
      </section>
    </main>
  );
}

export default OwnerSecurity;
