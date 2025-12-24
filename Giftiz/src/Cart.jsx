import { useEffect, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";

export default function Cart() {
  const location = useLocation();
  const navigate = useNavigate();
  const [sessionId, setSessionId] = useState(() => location.state?.sessionId || localStorage.getItem("sessionId"));
  const [cart, setCart] = useState([]);
  const [message, setMessage] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    const syncSession = () => setSessionId(localStorage.getItem("sessionId"));
    window.addEventListener("storage", syncSession);
    return () => window.removeEventListener("storage", syncSession);
  }, []);

  useEffect(() => {
    if (!sessionId) {
      setMessage("אין סשן פעיל. אנא התחברו.");
      setCart([]);
      return;
    }

    const fetchCart = async () => {
      setIsLoading(true);
      try {
        const res = await fetch(`http://localhost:3001/cart/${sessionId}`);
        const data = await res.json();
        if (!res.ok) {
          throw new Error(data.message || "לא ניתן לטעון את העגלה");
        }
        setCart(data.cart || []);
        setMessage("");
      } catch (error) {
        setMessage(error.message);
      } finally {
        setIsLoading(false);
      }
    };

    fetchCart();
  }, [sessionId]);

  const removeItem = async (itemId) => {
    if (!sessionId) return;
    try {
      setIsLoading(true);
      const res = await fetch(`http://localhost:3001/cart/${sessionId}/items/${itemId}`, { method: "DELETE" });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.message || "לא ניתן להסיר את הפריט");
      }
      setCart(data.cart || []);
    } catch (error) {
      setMessage(error.message);
    } finally {
      setIsLoading(false);
    }
  };

  const totalILS = cart.reduce((sum, item) => sum + (Number(item.priceILS) || 0) * (item.quantity || 0), 0);
  const formatPrice = (value) => `₪${(Number(value) || 0).toFixed(2)}`;

  return (
    <main className="page">
      <section className="surface stack">
        <h2>העגלה שלכם</h2>
        {message && <p className="alert info" role="status" aria-live="polite">{message}</p>}
        {isLoading && <p className="alert info" role="status" aria-live="polite">טוען...</p>}
        {cart.length === 0 ? (
          <p className="empty-state">העגלה ריקה</p>
        ) : (
          <>
            <div className="cart-list">
              {cart.map(item => {
                const itemPrice = Number(item.priceILS) || 0;
                const itemSubtotal = itemPrice * (item.quantity || 0);
                return (
                  <article
                    key={item.id}
                    className="cart-item"
                  >
                    <div className="cart-item-details">
                      <strong>{item.name}</strong>
                      <span>כמות: {item.quantity}</span>
                      <span>מחיר: {formatPrice(itemPrice)}</span>
                      <span>סכום ביניים: {formatPrice(itemSubtotal)}</span>
                    </div>
                    <button className="btn-ghost" onClick={() => removeItem(item.id)}>הסרה</button>
                  </article>
                );
              })}
            </div>

            <div className="cart-summary">
              <span>סה"כ</span>
              <span>{formatPrice(totalILS)}</span>
            </div>

            <button
              onClick={() => navigate("/checkout")}
              disabled={cart.length === 0}
            >
              המשך לתשלום
            </button>

            <div className="cta-row">
              <button type="button" className="btn-ghost" onClick={() => navigate("/media")}>המשך קנייה</button>
              <button type="button" className="btn-ghost" onClick={() => navigate("/")}>חזרה לבית</button>
            </div>
          </>
        )}
      </section>
    </main>
  );
}
