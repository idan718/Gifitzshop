import { useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";

function Owner() {
    const navigate = useNavigate();
    const [sessionId, setSessionId] = useState(() => (typeof window !== "undefined" ? localStorage.getItem("sessionId") : null));
    const [categories, setCategories] = useState([]);
    const [newCategory, setNewCategory] = useState("");
    const [categoryMessage, setCategoryMessage] = useState("");
    const [error, setError] = useState("");
    const [loadingAction, setLoadingAction] = useState(false);
    const [loadingCategories, setLoadingCategories] = useState(true);

    useEffect(() => {
        const syncSession = () => setSessionId(localStorage.getItem("sessionId"));
        window.addEventListener("storage", syncSession);
        window.addEventListener("giftiz-session-change", syncSession);
        return () => {
            window.removeEventListener("storage", syncSession);
            window.removeEventListener("giftiz-session-change", syncSession);
        };
    }, []);

    const fetchCategories = useCallback(async () => {
        setLoadingCategories(true);
        setError("");
        try {
            const res = await fetch("http://localhost:3001/categories");
            if (!res.ok) {
                throw new Error("טעינת הקטגוריות נכשלה");
            }
            const data = await res.json();
            setCategories(Array.isArray(data) ? data : []);
        } catch (err) {
            setError(err.message);
            setCategories([]);
        } finally {
            setLoadingCategories(false);
        }
    }, []);

    useEffect(() => {
        fetchCategories();
    }, [fetchCategories]);

    const requireSession = () => {
        if (!sessionId) {
            setError("עליכם להתחבר כבעלים כדי לבצע פעולה זו.");
            return false;
        }
        return true;
    };

    const createCategory = async (event) => {
        event.preventDefault();
        if (!requireSession()) {
            return;
        }
        if (!newCategory.trim()) {
            setError("הזינו שם קטגוריה.");
            return;
        }
        setLoadingAction(true);
        setCategoryMessage("");
        setError("");
        try {
            const res = await fetch("http://localhost:3001/owner/categories", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    "x-session-id": sessionId
                },
                body: JSON.stringify({ name: newCategory })
            });
            const data = await res.json();
            if (!res.ok) {
                throw new Error(data.message || "לא ניתן ליצור קטגוריה");
            }
            setCategoryMessage(data.message);
            setNewCategory("");
            setCategories((prev) => [...prev, data.category]);
        } catch (err) {
            setError(err.message);
        } finally {
            setLoadingAction(false);
        }
    };

    const deleteCategory = async (categoryId) => {
        if (!requireSession()) {
            return;
        }
        if (!window.confirm("האם למחוק קטגוריה זו?")) {
            return;
        }
        setLoadingAction(true);
        setCategoryMessage("");
        setError("");
        try {
            const res = await fetch(`http://localhost:3001/owner/categories/${categoryId}`, {
                method: "DELETE",
                headers: {
                    "Content-Type": "application/json",
                    "x-session-id": sessionId
                }
            });
            const data = await res.json();
            if (!res.ok) {
                throw new Error(data.message || "לא ניתן למחוק קטגוריה");
            }
            setCategoryMessage(data.message);
            setCategories((prev) => prev.filter((category) => Number(category.id) !== Number(categoryId)));
        } catch (err) {
            setError(err.message);
        } finally {
            setLoadingAction(false);
        }
    };

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

                <div className="stack">
                    <h2>ניהול קטגוריות מוצרים</h2>
                    <p className="form-helper">הקטגוריות שתצרו כאן יוצגו לעורכים ולמבקרים בעמוד המוצרים.</p>
                    <form className="category-form" onSubmit={createCategory}>
                        <input
                            type="text"
                            placeholder="שם קטגוריה חדש"
                            value={newCategory}
                            onChange={(e) => setNewCategory(e.target.value)}
                        />
                        <button type="submit" disabled={loadingAction}>
                            {loadingAction ? "שומר..." : "הוספת קטגוריה"}
                        </button>
                    </form>
                    {loadingCategories ? (
                        <p>טוען קטגוריות...</p>
                    ) : categories.length === 0 ? (
                        <p className="empty-state">אין קטגוריות. התחילו להוסיף כעת.</p>
                    ) : (
                        <div className="category-grid">
                            {categories.map((category) => (
                                <div className="category-card" key={category.id}>
                                    <span>{category.name}</span>
                                    <button type="button" className="btn-ghost" onClick={() => deleteCategory(category.id)} disabled={loadingAction}>
                                        מחיקה
                                    </button>
                                </div>
                            ))}
                        </div>
                    )}
                    {categoryMessage && <p className="form-helper">{categoryMessage}</p>}
                    {error && <p className="form-helper" role="alert">{error}</p>}
                </div>
            </section>
        </main>
    );
}

export default Owner;
