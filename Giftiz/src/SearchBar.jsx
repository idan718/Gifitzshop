import { useState, useEffect } from "react";

function SearchBar({ activeCategoryId, onResults, onReset }) {
  const [query, setQuery] = useState("");

  useEffect(() => {
    const trimmedQuery = query.trim();
    if (!trimmedQuery) {
      onReset();
      return undefined;
    }

    let cancelled = false;
    const controller = new AbortController();

    const runSearch = async () => {
      try {
        const url = new URL("http://localhost:3001/search");
        url.searchParams.set("q", trimmedQuery);
        if (activeCategoryId !== null && activeCategoryId !== undefined) {
          url.searchParams.set("categoryId", activeCategoryId);
        }
        const res = await fetch(url.toString(), { signal: controller.signal });
        if (!res.ok) {
          throw new Error("Search request failed");
        }
        const data = await res.json();
        if (!cancelled) {
          onResults({
            items: Array.isArray(data?.items) ? data.items : [],
            categories: Array.isArray(data?.categories) ? data.categories : []
          });
        }
      } catch (error) {
        if (error.name === "AbortError" || cancelled) {
          return;
        }
        console.error("Search failed", error);
        onResults({ items: [], categories: [] });
      }
    };

    runSearch();

    return () => {
      cancelled = true;
      controller.abort();
    };
  }, [query, activeCategoryId, onResults, onReset]);

  const placeholder = activeCategoryId ? "חיפוש בתוך קטגוריה זו..." : "חיפוש מוצרים או קטגוריות...";

  return (
    <div className="search-bar">
      <input
        type="text"
        placeholder={placeholder}
        value={query}
        onChange={(e) => setQuery(e.target.value)}
      />
    </div>
  );
}

export default SearchBar;
