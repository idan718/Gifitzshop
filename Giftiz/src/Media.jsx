import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import SearchBar from "./SearchBar";

function Media() {
  const navigate = useNavigate();
  const [items, setItems] = useState([]);
  const [filteredItems, setFilteredItems] = useState([]);
  const [popupItem, setPopupItem] = useState(null);
  const [popupQuantity, setPopupQuantity] = useState(1);
  const [popupImageIndex, setPopupImageIndex] = useState(0);
  const MAX_PER_ITEM = 20;

  useEffect(() => {
    const fetchItems = async () => {
      try {
        const res = await fetch("http://localhost:3001/items");
        if (!res.ok) {
          throw new Error("לא ניתן לטעון את המלאי");
        }
        const data = await res.json();
        setItems(Array.isArray(data) ? data : []);
        setFilteredItems(Array.isArray(data) ? data : []);
      } catch (error) {
        console.error("Inventory fetch failed", error);
        setItems([]);
        setFilteredItems([]);
      }
    };
    fetchItems();
  }, []);

  const resolveGallery = (item) => {
    if (!item) {
      return [];
    }
    if (Array.isArray(item.itemImages) && item.itemImages.length) {
      return item.itemImages;
    }
    if (item.itemImage) {
      return [item.itemImage];
    }
    return [];
  };

  useEffect(() => {
    if (!popupItem) {
      return;
    }
    const gallery = resolveGallery(popupItem);
    setPopupImageIndex((current) => {
      if (gallery.length === 0) {
        return 0;
      }
      return Math.min(current, gallery.length - 1);
    });
  }, [popupItem]);

  const getMaxPurchasable = (item) => {
    if (!item) {
      return MAX_PER_ITEM;
    }
    const stock = Number(item.itemQuantity);
    if (!Number.isFinite(stock) || stock <= 0) {
      return 0;
    }
    return Math.min(MAX_PER_ITEM, stock);
  };

  const clampQuantity = (item, value) => {
    const limit = getMaxPurchasable(item);
    if (limit === 0) {
      return 0;
    }
    const numericValue = Number(value) || 1;
    return Math.max(1, Math.min(limit, numericValue));
  };

  const addToCart = async (item, desiredQuantity = 1) => {
    const sessionId = localStorage.getItem("sessionId");
    if (!sessionId) {
      alert("אנא התחברו כדי להוסיף פריטים לעגלה");
      return;
    }

    const maxAllowed = getMaxPurchasable(item);
    if (maxAllowed === 0) {
      alert("המוצר אזל מהמלאי.");
      return;
    }

    const quantity = clampQuantity(item, desiredQuantity);

    try {
      const res = await fetch(`http://localhost:3001/cart/${sessionId}/items`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: item.id,
          name: item.itemName,
          priceILS: item.itemPriceILS,
          quantity
        })
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.message || "לא ניתן להוסיף את הפריט");
      }
    } catch (error) {
      alert(error.message || "הוספת הפריט לעגלה נכשלה");
    }
  };

  const openPopup = (item) => {
    setPopupItem(item);
    const limit = getMaxPurchasable(item);
    setPopupQuantity(limit > 0 ? 1 : 0);
    setPopupImageIndex(0);
  };

  const closePopup = () => {
    setPopupItem(null);
    setPopupImageIndex(0);
  };

  const goToPreviousImage = () => {
    if (!popupItem) {
      return;
    }
    const gallery = resolveGallery(popupItem);
    if (gallery.length <= 1) {
      return;
    }
    setPopupImageIndex((current) => (current - 1 + gallery.length) % gallery.length);
  };

  const goToNextImage = () => {
    if (!popupItem) {
      return;
    }
    const gallery = resolveGallery(popupItem);
    if (gallery.length <= 1) {
      return;
    }
    setPopupImageIndex((current) => (current + 1) % gallery.length);
  };

  const popupMax = popupItem ? getMaxPurchasable(popupItem) : MAX_PER_ITEM;
  const popupGallery = popupItem ? resolveGallery(popupItem) : [];
  const popupImageSrc = popupGallery[popupImageIndex] || null;

  return (
    <main className="page">
      <section className="surface stack">
        <div className="stack">
          <h1>ספריית המוצרים</h1>
          <p className="form-helper">הקישו על כל כרטיס כדי לצפות בו או להוסיף אותו לעגלה מיד.</p>
        </div>

        <SearchBar items={items} setFilteredItems={setFilteredItems} />

        <div className="media-grid">
          {filteredItems.map((item) => {
            const gallery = resolveGallery(item);
            const coverImage = gallery[0] || null;
            return (
              <article
                key={item.id}
                className="media-card"
              >
                <button
                  className="media-thumb"
                  onClick={() => openPopup(item)}
                  aria-label={`תצוגה מקדימה של ${item.itemName}`}
                >
                  {coverImage ? (
                    <img src={coverImage} alt={`תמונה של ${item.itemName}`} />
                  ) : (
                    <div className="media-placeholder">
                      <p>{item.itemName}</p>
                    </div>
                  )}
                </button>
                <div className="stack">
                  <div>
                    <h3>{item.itemName}</h3>
                    <p className="form-helper text-center">מחיר: ₪{Number(item.itemPriceILS).toFixed(2)}</p>
                  </div>
                  <button onClick={() => {
                    addToCart(item);
                    openPopup(item);
                  }}>הוספה לעגלה</button>
                </div>
              </article>
            );
          })}
        </div>
      </section>

      <div className="nav-grid">
        <button onClick={() => navigate("/cart")}>לעגלה</button>
        <button className="btn-ghost" onClick={() => navigate("/")}>חזרה לבית</button>
      </div>

      {popupItem && (
        <div className="media-overlay" role="dialog" aria-modal="true">
          <div className="media-modal stack">
            <h2>{popupItem.itemName}</h2>
            <p className="form-helper text-center">מחיר: ₪{Number(popupItem.itemPriceILS).toFixed(2)}</p>
            <label className="stack" style={{ textAlign: "right" }}>
              <span className="form-helper">בחרו כמות (עד {popupMax || 0} יחידות)</span>
              <input
                type="number"
                min="1"
                max={popupMax}
                value={popupQuantity}
                disabled={popupMax === 0}
                onChange={(event) => setPopupQuantity(clampQuantity(popupItem, event.target.value))}
              />
            </label>
            <div className="media-gallery">
              {popupImageSrc ? (
                <img
                  src={popupImageSrc}
                  alt={`תמונה ${popupImageIndex + 1} של ${popupItem.itemName}`}
                  className="media-gallery-main"
                />
              ) : (
                <div className="media-placeholder">
                  <p>{popupItem.itemName}</p>
                </div>
              )}
              {popupGallery.length > 1 && (
                <>
                  <button
                    type="button"
                    className="media-gallery-nav prev"
                    onClick={goToPreviousImage}
                    aria-label="תמונה קודמת"
                  >
                    ›
                  </button>
                  <button
                    type="button"
                    className="media-gallery-nav next"
                    onClick={goToNextImage}
                    aria-label="תמונה הבאה"
                  >
                    ‹
                  </button>
                  <div className="media-thumb-strip">
                    {popupGallery.map((src, index) => (
                      <button
                        type="button"
                        key={`${popupItem.id}-thumb-${index}`}
                        className={`media-thumb-dot ${index === popupImageIndex ? "active" : ""}`}
                        onClick={() => setPopupImageIndex(index)}
                        aria-label={`בחירת תמונה ${index + 1}`}
                      >
                        <img src={src} alt={`תמונה ${index + 1}`} />
                      </button>
                    ))}
                  </div>
                </>
              )}
            </div>
            <div className="home-primary-actions">
              <button
                onClick={() => {
                  addToCart(popupItem, popupQuantity);
                  closePopup();
                }}
                disabled={popupMax === 0}
              >
                הוספה לעגלה
              </button>
              <button className="btn-ghost" onClick={closePopup}>סגור</button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}

export default Media;