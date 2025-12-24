import { useEffect, useId, useMemo, useRef, useState } from "react";

function SearchBar({
  activeCategoryId = null,
  onResults = () => {},
  onReset = () => {},
  onSelectCategory,
  onSelectItem
}) {
  const [query, setQuery] = useState("");
  const [suggestions, setSuggestions] = useState([]);
  const [open, setOpen] = useState(false);
  const [highlightedIndex, setHighlightedIndex] = useState(-1);
  const inputRef = useRef(null);
  const listboxId = useId();

  const trimmedQuery = query.trim();

  const normalizedSuggestions = useMemo(() => {
    if (!Array.isArray(suggestions)) {
      return [];
    }
    return suggestions.filter((s) => s && typeof s.label === "string" && s.label.trim());
  }, [suggestions]);

  const closeSuggestions = () => {
    setOpen(false);
    setHighlightedIndex(-1);
  };

  const openSuggestions = () => {
    if (!trimmedQuery) {
      return;
    }
    if (normalizedSuggestions.length === 0) {
      return;
    }
    setOpen(true);
  };

  const selectSuggestion = (suggestion) => {
    if (!suggestion) {
      return;
    }

    if (suggestion.type === "category" && typeof onSelectCategory === "function") {
      closeSuggestions();
      onSelectCategory(suggestion.id);
      return;
    }

    if (suggestion.type === "item" && typeof onSelectItem === "function") {
      closeSuggestions();
      onSelectItem(suggestion.id);
      return;
    }

    const nextValue = String(suggestion.value ?? suggestion.label ?? "").trim();
    if (!nextValue) {
      return;
    }
    setQuery(nextValue);
    closeSuggestions();
    requestAnimationFrame(() => inputRef.current?.focus?.());
  };

  useEffect(() => {
    if (!trimmedQuery) {
      onReset();
      setSuggestions([]);
      closeSuggestions();
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
          const nextItems = Array.isArray(data?.items) ? data.items : [];
          const nextCategories = Array.isArray(data?.categories) ? data.categories : [];

          onResults({ items: nextItems, categories: nextCategories });

          const nextSuggestions = [];
          for (const category of nextCategories.slice(0, 8)) {
            const label = String(category?.name ?? "").trim();
            if (!label) continue;
            nextSuggestions.push({
              type: "category",
              id: category.id,
              label,
              value: label
            });
          }
          for (const item of nextItems.slice(0, 10)) {
            const label = String(item?.itemName ?? item?.name ?? "").trim();
            if (!label) continue;
            nextSuggestions.push({
              type: "item",
              id: item.id,
              label,
              value: label
            });
          }

          setSuggestions(nextSuggestions);
          setHighlightedIndex(-1);
          setOpen(true);
        }
      } catch (error) {
        if (error.name === "AbortError" || cancelled) {
          return;
        }
        console.error("Search failed", error);
        onResults({ items: [], categories: [] });
        setSuggestions([]);
        closeSuggestions();
      }
    };

    runSearch();

    return () => {
      cancelled = true;
      controller.abort();
    };
  }, [trimmedQuery, query, activeCategoryId, onResults, onReset]);

  const placeholder = activeCategoryId ? "חיפוש בתוך קטגוריה זו..." : "חיפוש מוצרים או קטגוריות...";

  const handleKeyDown = (event) => {
    if (!open || normalizedSuggestions.length === 0) {
      return;
    }

    if (event.key === "ArrowDown") {
      event.preventDefault();
      setHighlightedIndex((prev) => {
        const next = prev + 1;
        return next >= normalizedSuggestions.length ? 0 : next;
      });
      return;
    }

    if (event.key === "ArrowUp") {
      event.preventDefault();
      setHighlightedIndex((prev) => {
        const next = prev - 1;
        return next < 0 ? normalizedSuggestions.length - 1 : next;
      });
      return;
    }

    if (event.key === "Enter") {
      if (highlightedIndex >= 0 && highlightedIndex < normalizedSuggestions.length) {
        event.preventDefault();
        selectSuggestion(normalizedSuggestions[highlightedIndex]);
      }
      return;
    }

    if (event.key === "Escape") {
      closeSuggestions();
    }
  };

  return (
    <div className="search-bar search-autocomplete">
      <input
        type="search"
        placeholder={placeholder}
        value={query}
        aria-label="חיפוש"
        autoComplete="off"
        enterKeyHint="search"
        onChange={(e) => setQuery(e.target.value)}
        onKeyDown={handleKeyDown}
        onFocus={openSuggestions}
        onBlur={() => {
          window.setTimeout(() => {
            closeSuggestions();
          }, 120);
        }}
        ref={inputRef}
        role="combobox"
        aria-autocomplete="list"
        aria-expanded={open}
        aria-controls={listboxId}
      />

      {open && trimmedQuery && normalizedSuggestions.length > 0 ? (
        <div className="search-suggestions" id={listboxId} role="listbox">
          {normalizedSuggestions.map((suggestion, index) => {
            const active = index === highlightedIndex;
            const prefix = suggestion.type === "category" ? "קטגוריה" : "מוצר";
            return (
              <button
                key={`${suggestion.type}-${String(suggestion.id ?? suggestion.label)}-${index}`}
                type="button"
                role="option"
                aria-selected={active}
                className={`search-suggestion${active ? " active" : ""}`}
                onMouseEnter={() => setHighlightedIndex(index)}
                onMouseDown={(e) => {
                  // Prevent input blur before click.
                  e.preventDefault();
                  selectSuggestion(suggestion);
                }}
              >
                <span className="search-suggestion-kind">{prefix}</span>
                <span className="search-suggestion-label">{suggestion.label}</span>
              </button>
            );
          })}
        </div>
      ) : null}
    </div>
  );
}

export default SearchBar;
