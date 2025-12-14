import { useNavigate } from "react-router-dom";


function About()
{

    const navigate = useNavigate();

    return(
        <main className="page">
            <section className="surface stack">
                <h1>אודות Giftiz</h1>
                <p className="form-helper">Giftiz היא סביבת ניסוי פשוטה להתנסות בסשנים, עגלות ותשלומים. השתמשו בה כדי להבין מה הלקוחות שלכם יחוו בהמשך.</p>
                <div className="nav-grid">
                    <button onClick={() => navigate("/")}>חזרה לבית</button>
                    <button className="btn-ghost" onClick={() => navigate("/media")}>עיון במוצרים</button>
                    
                </div>
            </section>
        </main>
    )
}

export default About;