import { useNavigate } from "react-router-dom";

function Owner() {
    const navigate = useNavigate();

    return (
        <main className="page">
            <section className="surface stack">
                <div className="stack">
                    <h1>קונסולת בעלים</h1>
                    <p className="form-helper">כלים בלעדיים לחשבון הבעלות של Giftiz.</p>
                </div>
                <div className="stack">
                    <p>צריכים פעולה מעמיקה יותר? שלחו מייל לכתובת support@giftiz.com וציינו את מזהה הסשן לצורך מעקב.</p>
                </div>
                <div className="nav-grid nav-center">
                    <button onClick={() => navigate("/")}>ללוח הראשי</button>
                    <button onClick={() => navigate("/owner/security")}>ניהול הרשאות</button>
                    <button className="btn-ghost" onClick={() => navigate("/admin")}>לפורטל המנהלים</button>
                </div>
            </section>
        </main>
    );
}

export default Owner;
