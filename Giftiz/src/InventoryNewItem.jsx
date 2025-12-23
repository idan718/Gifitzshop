import { useCallback, useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";

const MAX_IMAGES_PER_ITEM = 6;

function InventoryNewItem() {
  const navigate = useNavigate();
  const [categories, setCategories] = useState([]);
  const [loadingCategories, setLoadingCategories] = useState(true);
  const [form, setForm] = useState({
    name: "",
    quantity: "",
    price: "",
    categoryId: "",
    images: []
  });
  const [sessionId, setSessionId] = useState(() => (typeof window !== "undefined" ? localStorage.getItem("sessionId") : null));
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const fileInputRef = useRef(null);
  const [dragActive, setDragActive] = useState(false);

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
    try {
      const res = await fetch("http://localhost:3001/categories");
      if (!res.ok) {
        throw new Error("לא ניתן לטעון קטגוריות");
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

  const handleInput = (field, value) => {
    setForm((prev) => ({ ...prev, [field]: value }));
  };

  const ingestFiles = (files, onLoad) => {
    const list = Array.from(files || []);
    list.forEach((file) => {
      if (!file.type.startsWith("image/")) {
        setError("אנא העלו קובץ תמונה תקין.");
        return;
      }
      const reader = new FileReader();
      reader.onload = (event) => {
        const result = event.target?.result;
        if (typeof result === "string") {
          onLoad(result);
        }
      };
      reader.readAsDataURL(file);
    });
  };

  const appendFormImage = (dataUrl) => {
    let accepted = false;
    setForm((prev) => {
      const nextImages = prev.images || [];
      if (nextImages.length >= MAX_IMAGES_PER_ITEM) {
        return prev;
      }
      accepted = true;
      return { ...prev, images: [...nextImages, dataUrl] };
    });
    if (!accepted) {
      setError(`ניתן להעלות עד ${MAX_IMAGES_PER_ITEM} תמונות לפריט.`);
    }
  };

  const handleImageInput = (event) => {
    ingestFiles(event.target.files, appendFormImage);
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  const handleDrop = (event) => {
    event.preventDefault();
    setDragActive(false);
    ingestFiles(event.dataTransfer?.files, appendFormImage);
  };

  const handleDragOver = (event) => {
    event.preventDefault();
    if (event.dataTransfer) {
      event.dataTransfer.dropEffect = "copy";
    }
    if (!dragActive) {
      setDragActive(true);
    }
  };

  const handleDragLeave = (event) => {
    event.preventDefault();
    if (dragActive && !event.currentTarget.contains(event.relatedTarget)) {
      setDragActive(false);
    }
  };

  const clearImages = () => {
    setForm((prev) => ({ ...prev, images: [] }));
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    if (!sessionId) {
      setError("נדרש להתחבר עם חשבון מנהל.");
      return;
    }
    if (!form.categoryId) {
      setError("בחרו קטגוריה לפריט.");
      return;
    }
    setSubmitting(true);
    setError("");
    try {
      const res = await fetch("http://localhost:3001/admin/inventory", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-session-id": sessionId
        },
        body: JSON.stringify({
          itemName: form.name,
          itemQuantity: form.quantity,
          itemPriceILS: form.price,
          itemImages: form.images,
          itemCategoryId: Number(form.categoryId)
        })
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.message || "לא ניתן להוסיף פריט");
      }
      setForm({ name: "", quantity: "", price: "", categoryId: "", images: [] });
      navigate("/admin/inventory", { replace: true });
    } catch (err) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  const disableForm = loadingCategories || categories.length === 0;

  return (
    <main className="page">
      <section className="surface stack">
        <div className="stack">
          <h1>הוספת פריט חדש</h1>
          <p className="form-helper">מלאו את כל שדות הפריט, בחרו קטגוריה ולחצו על "שמירה".</p>
        </div>

        <form className="inventory-form" onSubmit={handleSubmit}>
          <input
            type="text"
            placeholder="שם מוצר"
            value={form.name}
            onChange={(e) => handleInput("name", e.target.value)}
            required
            disabled={disableForm}
          />
          <input
            type="number"
            min="0"
            placeholder="כמות"
            value={form.quantity}
            onChange={(e) => handleInput("quantity", e.target.value)}
            required
            disabled={disableForm}
          />
          <input
            type="number"
            min="0"
            step="0.01"
            placeholder="מחיר ב-₪"
            value={form.price}
            onChange={(e) => handleInput("price", e.target.value)}
            required
            disabled={disableForm}
          />
          <select
            value={form.categoryId}
            onChange={(e) => handleInput("categoryId", e.target.value)}
            disabled={disableForm}
            required
          >
            <option value="">בחרו קטגוריה</option>
            {categories.map((category) => (
              <option value={category.id} key={category.id}>
                {category.name}
              </option>
            ))}
          </select>
          <div className="image-upload-field">
            <span className="form-helper">תמונות מוצר</span>
            <button
              type="button"
              className={`image-drop ${dragActive ? "drag-active" : ""} ${form.images.length ? "has-image" : ""}`}
              onClick={() => fileInputRef.current?.click()}
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onDrop={handleDrop}
              disabled={disableForm}
            >
              {form.images.length ? (
                <div className="image-drop-preview">
                  <img src={form.images[0]} alt="תצוגה מקדימה" />
                  {form.images.length > 1 && (
                    <span className="image-drop-count">+{form.images.length - 1}</span>
                  )}
                </div>
              ) : (
                <span>גררו לכאן תמונות או לחצו להעלאה</span>
              )}
            </button>
            <input
              type="file"
              accept="image/*"
              multiple
              ref={fileInputRef}
              onChange={handleImageInput}
              style={{ display: "none" }}
              disabled={disableForm}
            />
            {form.images.length > 0 && (
              <>
                <div className="image-preview-grid">
                  {form.images.map((src, index) => (
                    <div className="image-chip" key={`new-item-${index}`}>
                      <img src={src} alt={`תמונה ${index + 1}`} />
                      <button type="button" onClick={() => setForm((prev) => ({
                        ...prev,
                        images: prev.images.filter((_, idx) => idx !== index)
                      }))}>
                        ×
                      </button>
                    </div>
                  ))}
                </div>
                <button type="button" className="btn-ghost" onClick={clearImages}>
                  הסרת כל התמונות
                </button>
              </>
            )}
          </div>
          <button type="submit" disabled={disableForm || submitting}>
            {submitting ? "שומר..." : "שמירת פריט"}
          </button>
        </form>

        {disableForm && (
          <p className="form-helper">
            {loadingCategories ? "טוען קטגוריות..." : "אין קטגוריות זמינות. בקשו מבעלים להוסיף קטגוריה חדשה."}
          </p>
        )}
        {error && <p>{error}</p>}

        <div className="nav-grid">
          <button onClick={() => navigate("/admin/inventory")}>חזרה לניהול המלאי</button>
          <button className="btn-ghost" onClick={() => navigate("/admin")}>חזרה לכלי המנהלים</button>
        </div>
      </section>
    </main>
  );
}

export default InventoryNewItem;
