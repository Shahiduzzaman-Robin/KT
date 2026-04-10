import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import api from '../utils/api';
import CustomSelect from '../components/CustomSelect';
import LedgerManager from '../components/LedgerManager';
import UserSessionBadge from '../components/UserSessionBadge';
import AppSidebar from '../components/AppSidebar';

function LedgersPage() {
  const [ledgers, setLedgers] = useState([]);
  const [search, setSearch] = useState('');
  const [type, setType] = useState('');
  const [loading, setLoading] = useState(false);

  async function loadLedgers() {
    setLoading(true);
    try {
      const { data } = await api.get('/ledgers', {
        params: {
          limit: 5000,
          search: search.trim() || undefined,
          type: type || undefined,
        },
      });
      setLedgers(data || []);
    } catch (error) {
      console.error(error);
      alert('Failed to load ledgers');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    const timer = setTimeout(() => {
      loadLedgers();
    }, 180);
    return () => clearTimeout(timer);
  }, [search, type]);

  const groupedStats = useMemo(() => {
    return ledgers.reduce(
      (acc, item) => {
        acc.total += 1;
        acc[item.type] = (acc[item.type] || 0) + 1;
        return acc;
      },
      { total: 0, customer: 0, supplier: 0, employee: 0, other: 0 }
    );
  }, [ledgers]);

  return (
    <div className="relative min-h-screen overflow-x-hidden bg-[#f4faff] px-4 py-6 md:px-8">
      <div className="pointer-events-none absolute inset-0 -z-10 overflow-hidden">
        <div className="absolute -top-32 right-[-8%] h-96 w-96 rounded-full bg-[#84f8c8]/25 blur-[110px]" />
        <div className="absolute bottom-[-18%] left-[-8%] h-80 w-80 rounded-full bg-[#d9f2ff] blur-[100px]" />
      </div>

      <div className="mx-auto flex max-w-[1700px] gap-5 px-0 md:px-0">
        <AppSidebar />

        <main className="min-w-0 flex-1 space-y-5">
        <header className="relative z-20 rounded-3xl bg-white/90 p-5 shadow-[0_12px_40px_rgba(0,31,42,0.06)] backdrop-blur">
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="mr-auto [font-family:Manrope,ui-sans-serif,system-ui] text-3xl font-bold tracking-tight text-[#001f2a] md:text-4xl">All Ledgers</h1>
            <UserSessionBadge />
            <Link className="rounded-xl bg-[#e6f6ff] px-4 py-2 text-sm font-semibold text-[#3d4a43] transition hover:bg-[#d9f2ff]" to="/">
              Back to Dashboard
            </Link>
          </div>
          <p className="mt-1 text-[#3d4a43]">Browse every ledger with phone, address, and type.</p>
        </header>

        <section className="rounded-3xl bg-[#e6f6ff] p-5">
          <div className="grid gap-2 md:grid-cols-[1fr_220px_auto]">
            <input
              className="w-full rounded-xl border border-transparent bg-white px-3 py-2 text-[#001f2a] outline-none transition focus:shadow-[0_0_0_2px_rgba(0,108,77,0.2)]"
              placeholder="Search ledger name..."
              value={search}
              onChange={(event) => setSearch(event.target.value)}
            />
            <CustomSelect
              value={type}
              onChange={setType}
              options={[
                { value: '', label: 'All Types' },
                { value: 'customer', label: 'Customer' },
                { value: 'supplier', label: 'Supplier' },
                { value: 'employee', label: 'Employee' },
                { value: 'other', label: 'Other' },
              ]}
              buttonClassName="!rounded-xl !border-transparent !bg-white"
            />
            <button className="rounded-xl bg-gradient-to-br from-[#00694b] to-[#008560] px-4 py-2 text-sm font-semibold text-white transition hover:opacity-95" type="button" onClick={loadLedgers}>
              Refresh
            </button>
          </div>

          <div className="mt-4 grid gap-2 text-sm md:grid-cols-5">
            <p className="rounded-xl bg-white px-3 py-2 text-[#3d4a43]">Total: <span className="font-semibold text-[#001f2a]">{groupedStats.total}</span></p>
            <p className="rounded-xl bg-white px-3 py-2 text-[#3d4a43]">Customer: <span className="font-semibold text-[#001f2a]">{groupedStats.customer}</span></p>
            <p className="rounded-xl bg-white px-3 py-2 text-[#3d4a43]">Supplier: <span className="font-semibold text-[#001f2a]">{groupedStats.supplier}</span></p>
            <p className="rounded-xl bg-white px-3 py-2 text-[#3d4a43]">Employee: <span className="font-semibold text-[#001f2a]">{groupedStats.employee}</span></p>
            <p className="rounded-xl bg-white px-3 py-2 text-[#3d4a43]">Other: <span className="font-semibold text-[#001f2a]">{groupedStats.other}</span></p>
          </div>
        </section>

        <LedgerManager />

        <section className="rounded-3xl bg-white p-5 shadow-[0_12px_40px_rgba(0,31,42,0.06)]">
          {loading ? <p className="text-sm text-[#3d4a43]">Loading ledgers...</p> : null}
          <div className="overflow-x-auto">
            <table className="w-full min-w-[860px] text-sm text-[#001f2a]">
              <thead className="text-[11px] uppercase tracking-[0.16em] text-[#3d4a43]">
                <tr>
                  <th className="rounded-l-xl bg-[#e6f6ff] px-4 py-3 text-left">Name</th>
                  <th className="bg-[#e6f6ff] px-4 py-3 text-left">Type</th>
                  <th className="bg-[#e6f6ff] px-4 py-3 text-left">Phone</th>
                  <th className="bg-[#e6f6ff] px-4 py-3 text-left">Address</th>
                  <th className="rounded-r-xl bg-[#e6f6ff] px-4 py-3 text-left">Notes</th>
                </tr>
              </thead>
              <tbody>
                {ledgers.map((ledger, index) => (
                  <tr key={ledger._id} className={`${index % 2 ? 'bg-[#f8fcff]' : 'bg-white'} align-top transition hover:bg-[#eaf7ff]`}>
                    <td className="px-4 py-4 font-semibold text-[#001f2a]"><Link className="underline decoration-transparent transition hover:decoration-current" to={`/ledgers/${ledger._id}`}>{ledger.name}</Link></td>
                    <td className="px-4 py-4">
                      <span className="rounded-full bg-[#d9f2ff] px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.14em] text-[#005139]">
                        {ledger.type}
                      </span>
                    </td>
                    <td className="px-4 py-4 text-[#3d4a43]">{ledger.contact || '-'}</td>
                    <td className="px-4 py-4 text-[#3d4a43]">{ledger.address || '-'}</td>
                    <td className="px-4 py-4 text-[#3d4a43]">{ledger.notes || '-'}</td>
                  </tr>
                ))}
                {!loading && ledgers.length === 0 ? (
                  <tr>
                    <td colSpan="5" className="px-4 py-8 text-center text-slate-500">
                      No ledgers found.
                    </td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>
        </section>
        </main>
      </div>
    </div>
  );
}

export default LedgersPage;
