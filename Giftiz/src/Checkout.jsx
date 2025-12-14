import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { loadStripe } from "@stripe/stripe-js";
import { Elements, PaymentElement, useElements, useStripe } from "@stripe/react-stripe-js";

function Checkout() {
  const navigate = useNavigate();
  const [clientSecret, setClientSecret] = useState("");
  const [cartItems, setCartItems] = useState([]);
  const [amountILS, setAmountILS] = useState(0);
  const [status, setStatus] = useState("");
  const [loading, setLoading] = useState(false);
  const [stripePromise, setStripePromise] = useState(null);
  const [stripeConfigLoading, setStripeConfigLoading] = useState(true);
  const sessionId = typeof window !== "undefined" ? localStorage.getItem("sessionId") : null;

  useEffect(() => {
    const loadConfig = async () => {
      try {
        const res = await fetch("http://localhost:3001/config/stripe");
        const data = await res.json();
        if (!res.ok) {
          throw new Error(data.message || "לא ניתן לטעון את הגדרות Stripe");
        }
        if (!data.publishableKey) {
          throw new Error("מפתח הפרסום של Stripe חסר בשרת");
        }
        setStripePromise(loadStripe(data.publishableKey));
      } catch (error) {
        setStatus(error.message);
      } finally {
        setStripeConfigLoading(false);
      }
    };

    loadConfig();
  }, []);

  useEffect(() => {
    if (!sessionId) {
      setStatus("אנא התחברו כדי להמשיך לקופה.");
      return;
    }

    const createIntent = async () => {
      setLoading(true);
      setStatus("");
      try {
        const res = await fetch("http://localhost:3001/checkout/create-intent", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "x-session-id": sessionId
          },
          body: JSON.stringify({ sessionId })
        });
        const data = await res.json();
        if (!res.ok) {
          throw new Error(data.message || "לא ניתן להתחיל את הקופה");
        }
        setClientSecret(data.clientSecret);
        setCartItems(data.items || []);
        setAmountILS(data.amountILS || 0);
        setStatus("");
      } catch (error) {
        setStatus(error.message);
        setClientSecret("");
        setCartItems([]);
        setAmountILS(0);
      } finally {
        setLoading(false);
      }
    };

    createIntent();
  }, [sessionId]);

  const appearance = useMemo(() => ({ theme: "stripe" }), []);
  const options = useMemo(() => (
    clientSecret
      ? {
          clientSecret,
          appearance
        }
      : null
  ), [clientSecret, appearance]);

  return (
    <main className="page">
      <section className="surface stack checkout-panel">
        <h2>קופה</h2>
        {status && <p>{status}</p>}
        {loading && <p>טוען סיכום...</p>}

        {cartItems.length > 0 && (
          <div className="stack">
            <h3>סיכום הזמנה</h3>
            <div className="checkout-list">
              {cartItems.map((item) => (
                <article key={item.id} className="checkout-item">
                  <div className="cart-item-details">
                    <strong>{item.name}</strong>
                    <span>כמות: {item.quantity}</span>
                  </div>
                  <div className="cart-item-details text-right">
                    <span>₪{item.priceILS?.toFixed ? item.priceILS.toFixed(2) : item.priceILS}</span>
                    <span>סכום ביניים: ₪{item.subtotal?.toFixed ? item.subtotal.toFixed(2) : item.subtotal}</span>
                  </div>
                </article>
              ))}
            </div>
            <div className="checkout-summary">
              <span>סה"כ</span>
              <span>₪{amountILS.toFixed(2)}</span>
            </div>
          </div>
        )}

        {stripeConfigLoading && <p>טוען הגדרות תשלום...</p>}

        {stripePromise && options && (
          <Elements key={clientSecret} stripe={stripePromise} options={options}>
            <CheckoutForm
              sessionId={sessionId}
              amountILS={amountILS}
              onSuccess={() => {
                setStatus("התשלום הצליח! מעבירים אתכם לעמוד הבא...");
                setCartItems([]);
                setAmountILS(0);
                setClientSecret("");
                navigate("/thank-you");
              }}
            />
          </Elements>
        )}
      </section>
    </main>
  );
}

function CheckoutForm({ sessionId, amountILS, onSuccess }) {
  const stripe = useStripe();
  const elements = useElements();
  const [processing, setProcessing] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [paymentReady, setPaymentReady] = useState(false);

  const handleSubmit = async (event) => {
    event.preventDefault();
    if (!stripe || !elements || !sessionId) {
      return;
    }

    setProcessing(true);
    setErrorMessage("");

    try {
      const paymentElement = elements.getElement('payment');
      if (!paymentElement) {
        throw new Error("טופס התשלום עדיין נטען. נא להמתין רגע ולנסות שוב.");
      }

      const { error, paymentIntent } = await stripe.confirmPayment({
        elements,
        redirect: "if_required"
      });

      if (error) {
        throw new Error(error.message);
      }

      if (!paymentIntent) {
        throw new Error("לא ניתן לאשר את התשלום");
      }

      const res = await fetch("http://localhost:3001/checkout/complete", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-session-id": sessionId
        },
        body: JSON.stringify({ sessionId, paymentIntentId: paymentIntent.id })
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.message || "לא ניתן לרשום את הרכישה");
      }

      onSuccess(paymentIntent);
    } catch (err) {
      setErrorMessage(err.message || "התשלום נכשל");
    } finally {
      setProcessing(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="stack">
      <PaymentElement onReady={() => { setErrorMessage(""); setPaymentReady(true); }} />
      {errorMessage && <p>{errorMessage}</p>}
      <button type="submit" disabled={!stripe || processing || !paymentReady}>
        {processing ? "מעבד..." : paymentReady ? `שלמו ₪${amountILS.toFixed(2)}` : "טוען טופס תשלום..."}
      </button>
    </form>
  );
}

export default Checkout;