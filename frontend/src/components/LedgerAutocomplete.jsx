import { useEffect, useState } from 'react';
import dayjs from 'dayjs';
import api from '../utils/api';

function formatBDT(value) {
  return `৳ ${Number(value || 0).toLocaleString()}`;
}

function LedgerAutocomplete({ value, onChange, selectedLedgerId, onSelect, error, excludeGroups = false }) {
  const [suggestions, setSuggestions] = useState([]);
  const [loading, setLoading] = useState(false);
  const [highlightedIndex, setHighlightedIndex] = useState(-1);

  function pickSuggestion(ledger) {
    onChange(ledger.name);
    onSelect(ledger);
    setSuggestions([]);
    setHighlightedIndex(-1);
  }

  useEffect(() => {
    // If a ledger is already locked in, don't show suggestions
    if (selectedLedgerId) {
      setSuggestions([]);
      return;
    }

    const query = value?.trim();
    if (!query || query.length < 1) {
      setSuggestions([]);
      return;
    }

    const timer = setTimeout(async () => {
      try {
        setLoading(true);
        const { data } = await api.get('/ledgers', {
          params: { search: query, limit: 6 },
        });
        const filtered = excludeGroups ? data.filter(l => !l.isGroup) : data;
        setSuggestions(filtered);
        setHighlightedIndex(filtered.length > 0 ? 0 : -1);
      } catch (requestError) {
        console.error('Ledger search failed', requestError);
      } finally {
        setLoading(false);
      }
    }, 150);

    return () => clearTimeout(timer);
  }, [value, selectedLedgerId, excludeGroups]);

  return (
    <div className="relative w-full">
      <div className="relative flex items-center">
        <input
          className={`w-full rounded-lg bg-slate-100 border-2 p-3 text-xs font-bold outline-none transition-all ${
            selectedLedgerId 
              ? 'border-emerald-500 bg-emerald-50 text-emerald-900 pr-10' 
              : error ? 'border-red-400 focus:ring-red-100' : 'border-slate-200 focus:border-emerald-500'
          }`}
          value={value}
          placeholder="Search Ledger Name..."
          onChange={(event) => {
            onChange(event.target.value);
            // If we have a selection and we start typing, clear the selection
            if (selectedLedgerId) onSelect(null);
          }}
          onKeyDown={(event) => {
            if (event.key === 'ArrowDown' && suggestions.length) {
              event.preventDefault();
              setHighlightedIndex((prev) => (prev + 1) % suggestions.length);
            }
            if (event.key === 'ArrowUp' && suggestions.length) {
              event.preventDefault();
              setHighlightedIndex((prev) => (prev <= 0 ? suggestions.length - 1 : prev - 1));
            }
            if (event.key === 'Enter' && suggestions.length > 0) {
              event.preventDefault();
              pickSuggestion(suggestions[highlightedIndex >= 0 ? highlightedIndex : 0]);
            }
            if (event.key === 'Escape') setSuggestions([]);
          }}
        />
        {selectedLedgerId && (
          <div className="absolute right-3 text-emerald-600 animate-in zoom-in duration-300">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
              <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
            </svg>
          </div>
        )}
        {loading && !selectedLedgerId && (
          <div className="absolute right-3">
            <div className="h-4 w-4 animate-spin rounded-full border-2 border-emerald-500 border-t-transparent" />
          </div>
        )}
      </div>

      {suggestions.length > 0 && (
        <ul 
          className="absolute z-[2000] mt-1 w-full overflow-hidden rounded-xl border border-slate-200 bg-white shadow-2xl ring-1 ring-black/5 animate-in fade-in slide-in-from-top-1 duration-200"
          onMouseLeave={() => setHighlightedIndex(-1)}
        >
          {suggestions.map((ledger, index) => (
            <li 
              key={ledger._id}
              onMouseDown={(e) => {
                e.preventDefault(); // CRITICAL: Stop input blur before click registers
                pickSuggestion(ledger);
              }}
              className={`flex items-start justify-between cursor-pointer px-4 py-3 border-b last:border-none border-slate-50 transition-all ${
                highlightedIndex === index ? 'bg-emerald-500 text-white' : 'hover:bg-slate-50'
              }`}
            >
              <div className="min-w-0">
                <span className={`block truncate text-sm font-bold ${highlightedIndex === index ? 'text-white' : 'text-slate-800'}`}>
                  {ledger.name}
                </span>
                <span className={`block truncate text-[10px] font-bold uppercase tracking-widest mt-0.5 ${highlightedIndex === index ? 'text-emerald-100' : 'text-slate-400'}`}>
                  {ledger.type} {ledger.balance !== undefined ? `• ${formatBDT(ledger.balance)}` : ''}
                </span>
              </div>
              <span className={`ml-2 rounded-md px-1.5 py-0.5 text-[9px] font-black uppercase tracking-widest ${
                highlightedIndex === index ? 'bg-white/20 text-white' : 'bg-slate-100 text-slate-500'
              }`}>
                {ledger.isGroup ? 'Group' : 'Ledger'}
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export default LedgerAutocomplete;
