import { useState, useEffect } from "react";

function SearchBar({ items, setFilteredItems }) {
  const [query, setQuery] = useState("");

  useEffect(() => {
    const trimmedQuery = query.trim();
    if (!trimmedQuery) {
      setFilteredItems(items);
      return undefined;
    }

    let cancelled = false;
    const controller = new AbortController();

    const runSearch = async () => {
      try {
        const res = await fetch(`http://localhost:3001/search?q=${encodeURIComponent(trimmedQuery)}`, {
          signal: controller.signal
        });
        if (!res.ok) {
          throw new Error('Search request failed');
        }
        const data = await res.json();
        if (!cancelled) {
          setFilteredItems(Array.isArray(data) ? data : []);
        }
      } catch (error) {
        if (error.name === "AbortError" || cancelled) {
          return;
        }
        setFilteredItems([]);
      }
    };

    runSearch();

    return () => {
      cancelled = true;
      controller.abort();
    };
  }, [query, items, setFilteredItems]);

  return (
    <div className="search-bar">
      <input
        type="text"
        placeholder="חיפוש מוצרים..."
        value={query}
        onChange={(e) => setQuery(e.target.value)}
      />
    </div>
  );
}

export default SearchBar;
