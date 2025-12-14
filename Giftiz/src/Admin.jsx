import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";

function Admin() {
    const navigate = useNavigate();
    const [isOwner, setIsOwner] = useState(false);

    useEffect(() => {
        const sessionId = localStorage.getItem("sessionId");
        if (!sessionId) {
            setIsOwner(false);
            return;
        }
        let active = true;
        const checkOwnerAccess = async () => {
            try {
                const res = await fetch(`http://localhost:3001/sessions/${sessionId}/owner-access`);
                if (!res.ok) {
                    if (active) setIsOwner(false);
                    return;
                }
                const data = await res.json();
                if (active) {
                    setIsOwner(Boolean(data.owner));
                }
            } catch (error) {
                if (active) setIsOwner(false);
            }
        };
        checkOwnerAccess();
        return () => {
            active = false;
        };
    }, []);

    return (
        <main className="page">
            <section className="surface stack">
                <div className="stack">
                    <h1>כלי מנהלים</h1>
                    <p className="form-helper">רק מנהלי Giftiz יכולים לראות פורטל זה.</p>
                </div>
                <div className="stack">
                    <p>השתמשו בהרשאות המנהליות באחריות. פנו אל support@giftiz.com אם נדרש לכם עוד גישה.</p>
                </div>
                <div className="nav-grid nav-center">
                    <button onClick={() => navigate("/")}>חזרה לבית</button>
                    <button onClick={() => navigate("/admin/inventory")}>ניהול מלאי</button>
                    <button className="btn-ghost" onClick={() => navigate("/support")}>תמיכה</button>
                    {isOwner && (
                        <button onClick={() => navigate("/owner")}>קונסולת בעלים</button>
                        
                    )}
                </div>
            </section>
        </main>
    );
}

export default Admin;
