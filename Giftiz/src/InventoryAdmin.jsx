import { useCallback, useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";

const MAX_IMAGES_PER_ITEM = 6;

function InventoryAdmin() {
  const navigate = useNavigate();
  const [items, setItems] = useState([]);
  const [editing, setEditing] = useState({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [form, setForm] = useState({ name: "", quantity: "", price: "", images: [] });
  const [submitting, setSubmitting] = useState(false);
  const [sessionId, setSessionId] = useState(() => (typeof window !== "undefined" ? localStorage.getItem("sessionId") : null));
  const [dragActive, setDragActive] = useState(false);
  const fileInputRef = useRef(null);
  const editingImageInputs = useRef({});

  useEffect(() => {
    const syncSession = () => setSessionId(localStorage.getItem("sessionId"));
    window.addEventListener("storage", syncSession);
    window.addEventListener("giftiz-session-change", syncSession);
    return () => {
      window.removeEventListener("storage", syncSession);
      window.removeEventListener("giftiz-session-change", syncSession);
    };
  }, []);

  const fetchInventory = useCallback(async () => {
    if (!sessionId) {
      setError("נדרש להתחבר עם חשבון מנהל.");
      setLoading(false);
      return;
    }
    setLoading(true);
    setError("");
    try {
      const res = await fetch("http://localhost:3001/admin/inventory", {
        headers: {
          "Content-Type": "application/json",
          "x-session-id": sessionId
        }
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.message || "לא ניתן לטעון את המלאי");
      }
      setItems(data.items || []);
      const structured = {};
      (data.items || []).forEach((item) => {
        structured[item.id] = {
          quantity: item.itemQuantity,
          price: Number(item.itemPriceILS).toFixed(2),
          images: Array.isArray(item.itemImages) ? item.itemImages : item.itemImage ? [item.itemImage] : []
        };
      });
      setEditing(structured);
    } catch (err) {
      setError(err.message);
      setItems([]);
    } finally {
      setLoading(false);
    }
  }, [sessionId]);

  useEffect(() => {
    fetchInventory();
  }, [fetchInventory]);

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

  const addImagesToForm = (fileList) => {
    if (!fileList || fileList.length === 0) {
      return;
    }
    ingestFiles(fileList, appendFormImage);
  };

  const handleImageInput = (event) => {
    addImagesToForm(event.target.files);
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  const handleDrop = (event) => {
    event.preventDefault();
    setDragActive(false);
    addImagesToForm(event.dataTransfer?.files);
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

  const clearImage = () => {
    setForm((prev) => ({ ...prev, images: [] }));
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  const removeFormImage = (index) => {
    setForm((prev) => ({
      ...prev,
      images: prev.images.filter((_, idx) => idx !== index)
    }));
  };

  const appendEditingImage = (id, dataUrl) => {
    let accepted = false;
    setEditing((prev) => {
      const current = prev[id] || { quantity: "", price: "", images: [] };
      const gallery = current.images || [];
      if (gallery.length >= MAX_IMAGES_PER_ITEM) {
        return prev;
      }
      accepted = true;
      return {
        ...prev,
        [id]: {
          ...current,
          images: [...gallery, dataUrl]
        }
      };
    });
    if (!accepted) {
      setError(`ניתן להעלות עד ${MAX_IMAGES_PER_ITEM} תמונות לפריט.`);
    }
  };

  const addImagesToExisting = (id, fileList) => {
    if (!fileList || fileList.length === 0) {
      return;
    }
    ingestFiles(fileList, (dataUrl) => appendEditingImage(id, dataUrl));
  };

  const handleExistingImageInput = (id, event) => {
    addImagesToExisting(id, event.target.files);
    if (editingImageInputs.current[id]) {
      editingImageInputs.current[id].value = "";
    }
    event.target.value = "";
  };

  const removeEditingImage = (id, index) => {
    setEditing((prev) => {
      const current = prev[id];
      if (!current) {
        return prev;
      }
      const gallery = Array.isArray(current.images) ? [...current.images] : [];
      gallery.splice(index, 1);
      return {
        ...prev,
        [id]: {
          ...current,
          images: gallery
        }
      };
    });
  };

  const handleEditChange = (id, field, value) => {
    setEditing((prev) => ({
      ...prev,
      [id]: {
        ...prev[id],
        [field]: value
      }
    }));
  };

  const handleAdd = async (event) => {
    event.preventDefault();
    if (!sessionId) {
      setError("נדרש להתחבר עם חשבון מנהל.");
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
          itemImages: form.images
        })
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.message || "לא ניתן להוסיף פריט");
      }
      setForm({ name: "", quantity: "", price: "", images: [] });
      await fetchInventory();
    } catch (err) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (id) => {
    if (!sessionId) {
      setError("נדרש להתחבר עם חשבון מנהל.");
      return;
    }
    setSubmitting(true);
    setError("");
    try {
      const res = await fetch(`http://localhost:3001/admin/inventory/${id}`, {
        method: "DELETE",
        headers: {
          "Content-Type": "application/json",
          "x-session-id": sessionId
        }
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.message || "לא ניתן להסיר פריט");
      }
      setItems((prev) => prev.filter((item) => item.id !== id));
      setEditing((prev) => {
        const clone = { ...prev };
        delete clone[id];
        return clone;
      });
      delete editingImageInputs.current[id];
    } catch (err) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  const handleUpdate = async (id) => {
    if (!sessionId) {
      setError("נדרש להתחבר עם חשבון מנהל.");
      return;
    }
    const pending = editing[id];
    if (!pending) {
      return;
    }
    setSubmitting(true);
    setError("");
    try {
      const res = await fetch(`http://localhost:3001/admin/inventory/${id}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          "x-session-id": sessionId
        },
        body: JSON.stringify({
          itemQuantity: pending.quantity,
          itemPriceILS: pending.price,
          itemImages: pending.images
        })
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.message || "לא ניתן לעדכן פריט");
      }
      setItems((prev) => prev.map((item) => (item.id === id ? data.item : item)));
      setEditing((prev) => ({
        ...prev,
        [id]: {
          quantity: data.item.itemQuantity,
          price: Number(data.item.itemPriceILS).toFixed(2),
          images: Array.isArray(data.item.itemImages) ? data.item.itemImages : []
        }
      }));
    } catch (err) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <main className="page">
      <section className="surface stack">
        <div className="stack">
          <h1>ניהול מלאי</h1>
          <p className="form-helper">הוסיפו או הסירו מוצרים זמינים בחנות וצירפו גלריית תמונות עשירה לכל פריט.</p>
        </div>

        <form className="inventory-form" onSubmit={handleAdd}>
          <input
            type="text"
            placeholder="שם מוצר"
            value={form.name}
            onChange={(e) => handleInput("name", e.target.value)}
            required
          />
          <input
            type="number"
            min="0"
            placeholder="כמות"
            value={form.quantity}
            onChange={(e) => handleInput("quantity", e.target.value)}
            required
          />
          <input
            type="number"
            min="0"
            step="0.01"
            placeholder="מחיר ב-₪"
            value={form.price}
            onChange={(e) => handleInput("price", e.target.value)}
            required
          />
          <div className="image-upload-field">
            <span className="form-helper">תמונות מוצר</span>
            <button
              type="button"
              className={`image-drop ${dragActive ? "drag-active" : ""} ${form.images.length ? "has-image" : ""}`}
              onClick={() => fileInputRef.current?.click()}
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onDrop={handleDrop}
            >
              {form.images.length ? (
                <div className="image-drop-preview">
                  <img src={form.images[0]} alt="תצוגה מקדימה" />
                  {form.images.length > 1 && (
                    <span className="image-drop-count">+{form.images.length - 1}</span>
                  )}
                </div>
              ) : (
                <span>drop images here</span>
              )}
            </button>
            <input
              type="file"
              accept="image/*"
              multiple
              ref={fileInputRef}
              onChange={handleImageInput}
              style={{ display: "none" }}
            />
            {form.images.length > 0 && (
              <>
                <div className="image-preview-grid">
                  {form.images.map((src, index) => (
                    <div className="image-chip" key={`new-item-image-${index}`}>
                      <img src={src} alt={`תמונה ${index + 1}`} />
                      <button type="button" aria-label="הסרת תמונה" onClick={() => removeFormImage(index)}>
                        ×
                      </button>
                    </div>
                  ))}
                </div>
                <button type="button" className="btn-ghost" onClick={clearImage}>
                  הסרת כל התמונות
                </button>
              </>
            )}
          </div>
          <button type="submit" disabled={submitting}>
            {submitting ? "שולח..." : "הוספת פריט"}
          </button>
        </form>

        {error && <p>{error}</p>}
        {loading ? (
          <p>טוען מלאי...</p>
        ) : (
          <div className="inventory-table-wrapper">
            {items.length === 0 ? (
              <p className="empty-state">אין פריטים במלאי</p>
            ) : (
              <table className="inventory-table">
                <thead>
                  <tr>
                    <th>מזהה</th>
                    <th>שם מוצר</th>
                    <th>כמות</th>
                    <th>מחיר (₪)</th>
                    <th>תמונות</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {items.map((item) => {
                    const rowState = editing[item.id] ?? {
                      quantity: item.itemQuantity,
                      price: Number(item.itemPriceILS).toFixed(2),
                      images: Array.isArray(item.itemImages) ? item.itemImages : []
                    };
                    const gallery = rowState.images || [];
                    return (
                      <tr key={item.id}>
                        <td>{item.id}</td>
                        <td>{item.itemName}</td>
                        <td>
                          <input
                            type="number"
                            min="0"
                            value={rowState.quantity}
                            onChange={(e) => handleEditChange(item.id, "quantity", e.target.value)}
                          />
                        </td>
                        <td>
                          <input
                            type="number"
                            min="0"
                            step="0.01"
                            value={rowState.price}
                            onChange={(e) => handleEditChange(item.id, "price", e.target.value)}
                          />
                        </td>
                        <td>
                          <div className="image-chip-grid">
                            {gallery.map((src, imageIndex) => (
                              <div className="image-chip" key={`${item.id}-image-${imageIndex}`}>
                                <img src={src} alt={`תמונה ${imageIndex + 1}`} />
                                <button
                                  type="button"
                                  aria-label="הסרת תמונה"
                                  onClick={() => removeEditingImage(item.id, imageIndex)}
                                >
                                  ×
                                </button>
                              </div>
                            ))}
                            {gallery.length < MAX_IMAGES_PER_ITEM && (
                              <button
                                type="button"
                                className="image-chip add-chip"
                                onClick={() => editingImageInputs.current[item.id]?.click()}
                              >
                                +
                              </button>
                            )}
                          </div>
                          <input
                            type="file"
                            accept="image/*"
                            multiple
                            style={{ display: "none" }}
                            ref={(node) => {
                              if (node) {
                                editingImageInputs.current[item.id] = node;
                              }
                            }}
                            onChange={(event) => handleExistingImageInput(item.id, event)}
                          />
                        </td>
                        <td>
                          <button
                            type="button"
                            className="btn-ghost"
                            onClick={() => handleDelete(item.id)}
                            disabled={submitting}
                          >
                            הסרה
                          </button>
                          <button
                            type="button"
                            onClick={() => handleUpdate(item.id)}
                            disabled={submitting}
                          >
                            שמירת שינוי
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </div>
        )}

        <div className="nav-grid">
          <button onClick={() => navigate("/admin")}>חזרה לפורטל המנהלים</button>
          <button className="btn-ghost" onClick={() => navigate("/")}>חזרה לבית</button>
        </div>
      </section>
    </main>
  );
}

export default InventoryAdmin;
