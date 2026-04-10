import { flushSync } from 'react-dom';
import { useEffect, useState } from 'react';
import api from '../utils/api';

function formatBDT(value) {
  return `৳ ${Number(value || 0).toLocaleString()}`;
}

function LedgerAutocomplete({ value, onChange, selectedLedgerId, onSelect, error, excludeGroups = false }) {
  const [suggestions, setSuggestions] = useState([]);
  const [loading, setLoading] = useState(false);
  const [highlightedIndex, setHighlightedIndex] = useState(-1);

  function pickSuggestion(ledger) {
    flushSync(() => {
      onChange(ledger.name);
      onSelect(ledger);
      setSuggestions([]);
      setHighlightedIndex(-1);
    });
  }

  useEffect(() => {
    if (selectedLedgerId) {
      setSuggestions([]);
      setHighlightedIndex(-1);
      return;
    }

    const query = value?.trim();
    if (!query) {
      setSuggestions([]);
      setHighlightedIndex(-1);
      return;
    }

    const timer = setTimeout(async () => {
      try {
        setLoading(true);
        const { data } = await api.get('/ledgers', {
          params: { search: query, limit: 5 },
        });
        const filtered = excludeGroups ? data.filter(l => !l.isGroup) : data;
        setSuggestions(filtered);
        setHighlightedIndex(filtered.length > 0 ? 0 : -1);
      } catch (requestError) {
        console.error('Ledger search failed', requestError);
      } finally {
        setLoading(false);
      }
    }, 180);

    return () => clearTimeout(timer);
  }, [value, selectedLedgerId]);

  return (
    <div className="relative">
      <label className="label">Ledger</label>
      <input
        className={`input ${error ? 'border-red-400 focus:ring-red-300' : ''}`}
        value={value}
        placeholder="Type ledger name e.g. Kamrul"
        role="combobox"
        aria-expanded={suggestions.length > 0}
        aria-controls="ledger-suggestion-list"
        aria-activedescendant={
          highlightedIndex >= 0 && suggestions[highlightedIndex]
            ? `ledger-option-${suggestions[highlightedIndex]._id}`
            : undefined
        }
        onChange={(event) => {
          onChange(event.target.value);
          if (selectedLedgerId) {
            onSelect(null);
          }
        }}
        onKeyDown={(event) => {
          if (event.key === 'ArrowDown') {
            if (!suggestions.length) return;
            event.preventDefault();
            setHighlightedIndex((prev) => (prev + 1) % suggestions.length);
          }

          if (event.key === 'ArrowUp') {
            if (!suggestions.length) return;
            event.preventDefault();
            setHighlightedIndex((prev) => (prev <= 0 ? suggestions.length - 1 : prev - 1));
          }

          if (event.key === 'Enter') {
            if (suggestions.length > 0) {
              event.preventDefault();
              const indexToPick = highlightedIndex >= 0 ? highlightedIndex : 0;
              pickSuggestion(suggestions[indexToPick]);
              return;
            }

            // Prevent premature form submit while autocomplete request is still in flight.
            if (loading && value?.trim() && !selectedLedgerId) {
              event.preventDefault();
            }
          }

          if (event.key === 'Escape') {
            setSuggestions([]);
            setHighlightedIndex(-1);
          }
        }}
      />
      {loading ? <p className="hint">Searching...</p> : null}
      {suggestions.length > 0 ? (
        <ul id="ledger-suggestion-list" className="absolute z-20 mt-2 w-full rounded-xl border border-slate-200 bg-white/95 shadow-xl backdrop-blur">
          {suggestions.map((ledger, index) => (
            <li key={ledger._id}>
              <div
                id={`ledger-option-${ledger._id}`}
                role="option"
                aria-selected={highlightedIndex === index}
                tabIndex={-1}
                className={`grid w-full grid-cols-[1fr_auto] items-start gap-3 px-3 py-2 text-left ${
                  highlightedIndex === index ? 'bg-sky-50' : 'hover:bg-slate-100'
                }`}
                onPointerEnter={() => setHighlightedIndex(index)}
                onMouseEnter={() => setHighlightedIndex(index)}
                onPointerDown={(event) => {
                  event.preventDefault();
                  pickSuggestion(ledger);
                }}
                onMouseDown={(event) => {
                  event.preventDefault();
                  pickSuggestion(ledger);
                }}
                onClick={() => pickSuggestion(ledger)}
              >
                <span className="min-w-0">
                  <span className="block truncate font-medium text-slate-700">{ledger.name}{ledger.isGroup ? ' 📊' : ''}</span>
                  <span className="mt-0.5 block truncate text-xs text-slate-500">
                    Balance: {formatBDT(ledger.currentBalance)}
                    <span className="mx-1">|</span>
                    {ledger.contact || 'No phone'}
                    {ledger.address ? ` | ${ledger.address}` : ''}
                  </span>
                </span>
                <span className="rounded-full bg-slate-200 px-2 py-0.5 text-xs uppercase tracking-wide text-slate-600">
                  {ledger.isGroup ? 'Group' : ledger.type}
                </span>
              </div>
            </li>
          ))}
        </ul>
      ) : null}
      {error ? <p className="error-text">{error}</p> : null}
    </div>
  );
}

export default LedgerAutocomplete;
