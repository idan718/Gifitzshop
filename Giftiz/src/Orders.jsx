import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";

const STATUS_LABELS = {
  pending: "בטיפול",
  ready: "מוכן"
};

function safeString(value) {
  if (value === null || value === undefined) {
    return "";
  }
  return String(value);
}

function formatMaybeIso(isoString) {
  if (!isoString) {
    return "";
  }
  try {
    const date = new Date(isoString);
    if (Number.isNaN(date.getTime())) {
      return "";
    }
    return new Intl.DateTimeFormat("he-IL", {
      dateStyle: "medium",
      timeStyle: "short",
      timeZone: "Asia/Jerusalem"
    }).format(date);
  } catch {
    return "";
  }
}

export default function Orders() {
  const navigate = useNavigate();
  const [sessionId, setSessionId] = useState(() => (typeof window !== "undefined" ? localStorage.getItem("sessionId") : null));
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [query, setQuery] = useState("");

  useEffect(() => {
    const syncSession = () => setSessionId(localStorage.getItem("sessionId"));
    window.addEventListener("storage", syncSession);
    window.addEventListener("giftiz-session-change", syncSession);
    return () => {
      window.removeEventListener("storage", syncSession);
      window.removeEventListener("giftiz-session-change", syncSession);
    };
  }, []);

  const fetchOrders = useCallback(async () => {
    if (!sessionId) {
      setError("אנא התחברו כדי לצפות בהזמנות.");
      setOrders([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    setError("");
    try {
      const res = await fetch("http://localhost:3001/orders/my", {
        headers: {
          "Content-Type": "application/json",
          "x-session-id": sessionId
        }
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.message || "לא ניתן לטעון הזמנות");
      }
      setOrders(Array.isArray(data.orders) ? data.orders : []);
    } catch (err) {
      setError(err.message || "לא ניתן לטעון הזמנות");
      setOrders([]);
    } finally {
      setLoading(false);
    }
  }, [sessionId]);

  useEffect(() => {
    fetchOrders();
  }, [fetchOrders]);

  const normalizedQuery = query.trim().toLowerCase();

  const filteredOrders = useMemo(() => {
    const sorted = [...orders].sort((a, b) => new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime());
    if (!normalizedQuery) {
      return sorted;
    }

    return sorted.filter((order) => {
      const haystack = [
        safeString(order.id),
        safeString(order.createdAt),
        safeString(order.createdAtHuman),
        safeString(order.status),
        ...(Array.isArray(order.items) ? order.items.flatMap((item) => [safeString(item.name), safeString(item.id)]) : [])
      ]
        .join(" ")
        .toLowerCase();

      return haystack.includes(normalizedQuery);
    });
  }, [orders, normalizedQuery]);

  return (
    <main className="page">
      <section className="surface stack">
        <div className="section-header">
          <h2>ההזמנות שלי</h2>
          <p className="form-helper">כאן תוכלו לעקוב אחרי סטטוס ההזמנה שלכם.</p>
        </div>

        <div className="toolbar">
          <div className="toolbar-grow">
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="חיפוש הזמנות (מספר הזמנה, מוצר...)"
              aria-label="חיפוש הזמנות"
            />
          </div>
          <button type="button" className="btn-ghost" onClick={fetchOrders} disabled={loading}>
            {loading ? "מרענן..." : "רענון"}
          </button>
        </div>

        {error && <p className="alert error" role="status" aria-live="polite">{error}</p>}
        {loading && <p className="alert info" role="status" aria-live="polite">טוען הזמנות...</p>}

        {!loading && filteredOrders.length === 0 ? (
          <p className="empty-state">אין הזמנות להצגה</p>
        ) : (
          <div className="stack">
            {filteredOrders.map((order) => {
              const createdLabel = order.createdAtHuman || formatMaybeIso(order.createdAt) || "";
              const statusLabel = STATUS_LABELS[order.status] || safeString(order.status) || "בטיפול";
              const readyLabel = order.readyAtHuman || formatMaybeIso(order.readyAt);

              return (
                <details key={order.id} className="surface">
                  <summary>
                    הזמנה #{order.id} · סטטוס: {statusLabel} · {createdLabel}
                  </summary>

                  <div className="stack" style={{ marginTop: "0.85rem" }}>
                    <div><strong>סכום:</strong> ₪{Number(order.totalILS || 0).toFixed(2)}</div>
                    {readyLabel ? <div><strong>מוכן מתאריך:</strong> {readyLabel}</div> : null}

                    <div className="stack" style={{ gap: "0.5rem" }}>
                      <strong>פריטים</strong>
                      {(order.items || []).map((item) => (
                        <div key={`${order.id}-${item.id}-${item.name}`} className="surface" style={{ padding: "0.75rem" }}>
                          {item.quantity || 0}× {item.name || "פריט"} — ₪{Number(item.priceILS || 0).toFixed(2)}
                        </div>
                      ))}
                    </div>

                    <div className="cta-row">
                      <button type="button" className="btn-ghost" onClick={() => navigate("/media")}>המשך קנייה</button>
                      <button type="button" className="btn-ghost" onClick={() => navigate("/")}>חזרה לבית</button>
                    </div>
                  </div>
                </details>
              );
            })}
          </div>
        )}
      </section>
    </main>
  );
}
