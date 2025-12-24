import { useNavigate } from "react-router-dom";

function Support() {
    const navigate = useNavigate();

    return (
        <main className="page">
            <section className="surface stack support-container">
                <div className="section-header">
                    <h1>מרכז התמיכה</h1>
                    <p className="form-helper">
                        צרו קשר עם צוות Giftiz לעזרה בהזמנות, בגישה לחשבון או בכל דבר אחר שתצטרכו.
                    </p>
                </div>

                <div className="stack">
                    <h2>צריכים עזרה?</h2>
                    <ul className="support-list">
                        <li>שלחו לנו מייל לכתובת <a href="mailto:support@giftiz.com">support@giftiz.com</a>.</li>
                        <li>היכנסו לעמוד צור קשר כדי לשלוח בקשה.</li>
                        <li>עברו למדור אודות כדי ללמוד עוד על התהליך שלנו.</li>
                    </ul>
                </div>

                <div className="nav-grid nav-center">
                    <button onClick={() => navigate("/")}>בית</button>
                    <button className="btn-ghost" onClick={() => navigate("/contact")}>צור קשר</button>
                </div>
            </section>
        </main>
    );
}

export default Support;