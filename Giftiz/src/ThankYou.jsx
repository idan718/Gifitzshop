import { useNavigate } from "react-router-dom";

function ThankYou() {
  const navigate = useNavigate();

  return (
    <main className="page">
      <section className="surface stack">
        <h2>תודה על הרכישה!</h2>
        <p className="form-helper">
          ההזמנה אושרה. תוכלו לצפות ברכישות שלכם בחשבון בכל רגע.
        </p>
        <div className="home-primary-actions">
          <button onClick={() => navigate("/media")}>המשך קנייה</button>
          <button className="btn-ghost" onClick={() => navigate("/")}>חזרה לבית</button>
        </div>
      </section>
    </main>
  );
}

export default ThankYou;
