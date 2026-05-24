import { useState, useEffect } from "react";

export default function AutoSuggestInput({
  value,
  onChange,
  suggestionsFetcher,
  placeholder = "",
}) {
  const [suggestions, setSuggestions] = useState([]);
  const [showDropdown, setShowDropdown] = useState(false);

  useEffect(() => {
    const loadSuggestions = async () => {
      try {
        const data = await suggestionsFetcher();
        setSuggestions(data || []);
      } catch (err) {
        console.error("Failed to load suggestions", err);
      }
    };

    loadSuggestions();
  }, [suggestionsFetcher]);

  const filtered = suggestions.filter((item) =>
    item.toLowerCase().includes(value.toLowerCase())
  );

  return (
    <div className="relative">
      <input
        type="text"
        value={value}
        placeholder={placeholder}
        onFocus={() => setShowDropdown(true)}
        onChange={(e) => onChange(e.target.value)}
        className="w-full rounded-lg border border-gray-300 px-3 py-2"
      />

      {showDropdown && filtered.length > 0 && (
        <div className="absolute z-50 mt-1 w-full rounded-lg border bg-white shadow-lg max-h-48 overflow-y-auto">
          {filtered.map((item, index) => (
            <div
              key={index}
              onClick={() => {
                onChange(item);
                setShowDropdown(false);
              }}
              className="cursor-pointer px-3 py-2 hover:bg-gray-100"
            >
              {item}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}