import { flushSync } from 'react-dom';
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
    if (selectedLedgerId) {
      setSuggestions([]);
      setHighlightedIndex(-1);
      return;
    }

    const query = value?.trim();
    if (!query || query.length < 2) {
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
    }, 150);

    return () => clearTimeout(timer);
  }, [value, selectedLedgerId, excludeGroups]);

  return (
    <div className="relative w-full">
      <input
        className={`w-full rounded-lg bg-slate-50 border-none p-3 text-xs font-bold outline-none ring-1 ring-slate-200 focus:ring-2 focus:ring-emerald-500 transition-all ${error ? 'ring-red-400' : ''}`}
        value={value}
        placeholder="Search Ledger..."
        onChange={(event) => {
          onChange(event.target.value);
          if (selectedLedgerId) onSelect(null);
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
          if (event.key === 'Enter' && suggestions.length > 0) {
            event.preventDefault();
            pickSuggestion(suggestions[highlightedIndex >= 0 ? highlightedIndex : 0]);
          }
          if (event.key === 'Escape') {
            setSuggestions([]);
            setHighlightedIndex(-1);
          }
        }}
      />
      {loading && <div className="absolute right-3 top-3"><div className="h-4 w-4 animate-spin rounded-full border-2 border-emerald-500 border-t-transparent" /></div>}
      {suggestions.length > 0 && (
        <ul className="absolute z-[1500] mt-2 w-full overflow-hidden rounded-xl border border-slate-200 bg-white shadow-2xl animate-in fade-in slide-in-from-top-2 duration-200">
          {suggestions.map((ledger, index) => (
            <li 
              key={ledger._id}
              onClick={() => pickSuggestion(ledger)}
              className={`flex items-start justify-between cursor-pointer px-4 py-3 border-b last:border-none border-slate-50 transition-colors ${highlightedIndex === index ? 'bg-emerald-50' : 'hover:bg-slate-50'}`}
            >
              <div className="min-w-0">
                <span className="block truncate text-sm font-bold text-slate-800">{ledger.name}</span>
                <span className="block truncate text-[10px] text-slate-400 font-bold uppercase tracking-widest mt-0.5">
                  {ledger.type} {ledger.balance !== undefined ? `• ${formatBDT(ledger.balance)}` : ''}
                </span>
              </div>
              <span className="ml-2 rounded-md bg-slate-100 px-1.5 py-0.5 text-[9px] font-black uppercase tracking-widest text-slate-500">
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
