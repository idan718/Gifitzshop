import { useState } from "react";
import { useNavigate } from "react-router-dom";


function Contact() {

    const navigate = useNavigate();
    const [form, setForm] = useState({ name: "", email: "", message: "" });
    const [status, setStatus] = useState("");
    const [sending, setSending] = useState(false);

    const handleChange = (field, value) => {
        setForm((prev) => ({ ...prev, [field]: value }));
    };

    const handleSubmit = async (event) => {
        event.preventDefault();
        setStatus("");
        setSending(true);
        try {
            const res = await fetch("http://localhost:3001/contact-message", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    name: form.name,
                    email: form.email,
                    message: form.message
                })
            });
            const data = await res.json();
            if (!res.ok) {
                throw new Error(data.message || "שליחת ההודעה נכשלה");
            }
            setStatus(data.message || "ההודעה נשלחה בהצלחה");
            setForm({ name: "", email: "", message: "" });
        } catch (error) {
            setStatus(error.message || "שליחת ההודעה נכשלה");
        } finally {
            setSending(false);
        }
    };

    return(
        <main className="page">
            <section className="surface stack">
                <div className="section-header">
                    <h1>צרו קשר</h1>
                    <p className="form-helper">יש לכם בקשת פיצ'ר או מצאתם באג? השאירו לנו הודעה ונחזור אליכם בהקדם.</p>
                </div>

                <form onSubmit={handleSubmit}>
                    <div className="form-fields">
                        <div className="field">
                            <label htmlFor="contact-name">שם מלא</label>
                            <input
                                id="contact-name"
                                type="text"
                                placeholder="שם מלא"
                                autoComplete="name"
                                value={form.name}
                                onChange={(e) => handleChange("name", e.target.value)}
                                required
                            />
                        </div>
                        <div className="field">
                            <label htmlFor="contact-email">דואר אלקטרוני</label>
                            <input
                                id="contact-email"
                                type="email"
                                placeholder="דואר אלקטרוני"
                                autoComplete="email"
                                value={form.email}
                                onChange={(e) => handleChange("email", e.target.value)}
                                required
                            />
                        </div>
                        <div className="field">
                            <label htmlFor="contact-message">הודעה</label>
                            <textarea
                                id="contact-message"
                                rows="5"
                                placeholder="איך נוכל לעזור?"
                                value={form.message}
                                onChange={(e) => handleChange("message", e.target.value)}
                                required
                            />
                        </div>
                        <button type="submit" disabled={sending}>{sending ? "שולח..." : "שליחת הודעה"}</button>
                    </div>
                </form>

                {status && <p className="alert info" role="status" aria-live="polite">{status}</p>}
                <div className="nav-grid">
                    <button className="btn-ghost" onClick={() => navigate("/")}>חזרה לבית</button>
                </div>
            </section>
        </main>
    )
}

export default Contact;