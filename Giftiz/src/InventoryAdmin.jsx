import { useCallback, useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";

const MAX_IMAGES_PER_ITEM = 6;

function InventoryAdmin() {
  const navigate = useNavigate();
  const [items, setItems] = useState([]);
  const [categories, setCategories] = useState([]);
  const [editing, setEditing] = useState({});
  const [loading, setLoading] = useState(true);
  const [categoriesLoading, setCategoriesLoading] = useState(true);
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [sessionId, setSessionId] = useState(() => (typeof window !== "undefined" ? localStorage.getItem("sessionId") : null));
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

  const fetchCategories = useCallback(async () => {
    setCategoriesLoading(true);
    try {
      const res = await fetch("http://localhost:3001/categories");
      if (!res.ok) {
        throw new Error("לא ניתן לטעון קטגוריות זמינות");
      }
      const data = await res.json();
      setCategories(Array.isArray(data) ? data : []);
    } catch (err) {
      setError(err.message);
      setCategories([]);
    } finally {
      setCategoriesLoading(false);
    }
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
          images: Array.isArray(item.itemImages) ? item.itemImages : item.itemImage ? [item.itemImage] : [],
          categoryId: item.categoryId ? String(item.categoryId) : ""
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

  useEffect(() => {
    fetchCategories();
  }, [fetchCategories]);

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
      const payload = {
        itemQuantity: pending.quantity,
        itemPriceILS: pending.price,
        itemImages: pending.images
      };
      if (pending.categoryId) {
        payload.itemCategoryId = Number(pending.categoryId);
      }
      const res = await fetch(`http://localhost:3001/admin/inventory/${id}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          "x-session-id": sessionId
        },
        body: JSON.stringify(payload)
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
          images: Array.isArray(data.item.itemImages) ? data.item.itemImages : [],
          categoryId: data.item.categoryId ? String(data.item.categoryId) : ""
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

        <div className="stack">
          <div className="nav-grid">
            <button onClick={() => navigate("/admin/inventory/new")}>
              הוספת פריט חדש
            </button>
            <button className="btn-ghost" type="button" onClick={fetchInventory}>
              רענון מלאי
            </button>
            <button className="btn-ghost" type="button" onClick={fetchCategories}>
              רענון קטגוריות
            </button>
          </div>
          {categoriesLoading ? (
            <p>טוען קטגוריות...</p>
          ) : categories.length === 0 ? (
            <p className="form-helper">אין קטגוריות פעילות. בעלים יכולים להוסיף קטגוריה חדשה ממסך הקונסולה.</p>
          ) : (
            <p className="form-helper">בחרו קטגוריה עבור כל פריט ושמרו את השינויים.</p>
          )}
        </div>

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
                    <th>קטגוריה</th>
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
                      images: Array.isArray(item.itemImages) ? item.itemImages : [],
                      categoryId: item.categoryId ? String(item.categoryId) : ""
                    };
                    const gallery = rowState.images || [];
                    return (
                      <tr key={item.id}>
                        <td>{item.id}</td>
                        <td>{item.itemName}</td>
                        <td>
                          <select
                            value={rowState.categoryId || ""}
                            onChange={(e) => handleEditChange(item.id, "categoryId", e.target.value)}
                            disabled={categoriesLoading}
                          >
                            <option value="">בחרו קטגוריה</option>
                            {categories.map((category) => (
                              <option value={category.id} key={category.id}>
                                {category.name}
                              </option>
                            ))}
                          </select>
                        </td>
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
