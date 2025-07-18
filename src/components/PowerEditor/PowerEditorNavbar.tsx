import React, { useState, useEffect, useRef } from "react";
import { Power } from "../../types/Power";

interface PowerEditorNavbarProps {
  searchQuery: string;
  onSearchChange: (query: string) => void;
  onLoadFile: () => void;
  onWriteFile: () => void;
  onCreatePower: () => void;
  onDeletePower: () => void;
  powers: Power[] | null;
  onSelectPower: (power: Power) => void;
}

const PowerEditorNavbar: React.FC<PowerEditorNavbarProps> = ({
  onLoadFile,
  onWriteFile,
  onCreatePower,
  onDeletePower,
  onSelectPower,
  onSearchChange,
  searchQuery,
  powers,
}) => {
  const [searchResults, setSearchResults] = useState<Power[]>([]);
  const [showDropdown, setShowDropdown] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(-1);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const resultRefs = useRef<(HTMLDivElement | null)[]>([]);

  // Handle click outside to close dropdown
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(event.target as Node) &&
        inputRef.current &&
        !inputRef.current.contains(event.target as Node)
      ) {
        setShowDropdown(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, []);

  // Update search results when query changes
  useEffect(() => {
    if (!powers || searchQuery.trim() === "") {
      setSearchResults([]);
      setSelectedIndex(-1);
      return;
    }

    const query = searchQuery.toLowerCase();
    const results = powers
      .filter(
        (p) =>
          // Search in power_name
          p.power_name?.toLowerCase().includes(query) ||
          // Search in dev_notes
          p.dev_notes?.toLowerCase().includes(query)
      )
      .slice(0, 10); // Limit to 10 results for better UX

    setSearchResults(results);
    setShowDropdown(results.length > 0);
    setSelectedIndex(-1); // Reset selection when results change

    // Reset the refs array to match the new results length
    resultRefs.current = resultRefs.current.slice(0, results.length);
  }, [searchQuery, powers]);

  const handleSearchInputFocus = () => {
    if (searchQuery.trim() !== "" && searchResults.length > 0) {
      setShowDropdown(true);
    }
  };

  const handleSearchResultClick = (power: Power) => {
    // First clear the search input and close dropdown
    onSearchChange("");
    setShowDropdown(false);

    // Then select the power - this ensures the UI updates properly
    // and the power list can expand and scroll to the selected power
    setTimeout(() => {
      onSelectPower(power);
    }, 0);
  };

  // Handle keyboard navigation in search results
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (!showDropdown || searchResults.length === 0) return;

    switch (e.key) {
      case "ArrowDown":
        e.preventDefault();
        setSelectedIndex((prev) => {
          const newIndex = prev < searchResults.length - 1 ? prev + 1 : 0;
          // Scroll the item into view if needed
          resultRefs.current[newIndex]?.scrollIntoView({ block: "nearest" });
          return newIndex;
        });
        break;
      case "ArrowUp":
        e.preventDefault();
        setSelectedIndex((prev) => {
          const newIndex = prev > 0 ? prev - 1 : searchResults.length - 1;
          // Scroll the item into view if needed
          resultRefs.current[newIndex]?.scrollIntoView({ block: "nearest" });
          return newIndex;
        });
        break;
      case "Enter":
        e.preventDefault();
        if (selectedIndex >= 0 && selectedIndex < searchResults.length) {
          handleSearchResultClick(searchResults[selectedIndex]);
        } else if (searchResults.length > 0) {
          // If no item is selected, use the first one
          handleSearchResultClick(searchResults[0]);
        }
        break;
      case "Escape":
        setShowDropdown(false);
        break;
    }
  };

  return (
    <header className="sticky top-0 bg-base-200 p-4 grid grid-cols-6 gap-4 items-center shadow-md z-50">
      <button className="btn btn-primary" onClick={onLoadFile}>
        Load File
      </button>
      <button className="btn btn-primary" onClick={onWriteFile}>
        Write to File
      </button>
      <div className="relative col-span-2">
        <input
          ref={inputRef}
          type="text"
          placeholder="Search powers by name or notes..."
          className="input input-bordered w-full"
          value={searchQuery}
          onChange={(e) => onSearchChange(e.target.value)}
          onFocus={handleSearchInputFocus}
          onKeyDown={handleKeyDown}
        />
        {showDropdown && searchResults.length > 0 && (
          <div
            ref={dropdownRef}
            className="absolute z-50 w-full mt-1 bg-base-100 shadow-lg rounded-md border border-base-300 max-h-80 overflow-y-auto"
          >
            {searchResults.map((power, index) => {
              const query = searchQuery.toLowerCase();
              const matchesDevNotes = power.dev_notes
                ?.toLowerCase()
                .includes(query);
              const isSelected = index === selectedIndex;

              return (
                <div
                  key={power.power_id}
                  ref={(el) => (resultRefs.current[index] = el)}
                  className={`p-2 cursor-pointer flex flex-col border-b border-base-200 last:border-b-0 ${
                    isSelected ? "bg-base-300" : "hover:bg-base-200"
                  }`}
                  onClick={() => handleSearchResultClick(power)}
                >
                  <div className="flex items-center">
                    <span className="text-primary font-medium">
                      {power.power_name}
                    </span>
                    {power.parent_item && (
                      <span className="ml-2 text-xs text-gray-500">
                        ({power.parent_item})
                      </span>
                    )}
                  </div>

                  {/* Show dev_notes if they match the search query */}
                  {matchesDevNotes && power.dev_notes && (
                    <div className="text-xs text-gray-600 mt-1 italic">
                      {power.dev_notes}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
      <button className="btn btn-success" onClick={onCreatePower}>
        Add new Power
      </button>
      <button className="btn btn-warning" onClick={onDeletePower}>
        Delete Power
      </button>
    </header>
  );
};

export default PowerEditorNavbar;
