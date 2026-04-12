import { useEffect, useState, useCallback } from 'react';
import dayjs from 'dayjs';
import api from '../utils/api';
import AppSidebar from '../components/AppSidebar';
import UserSessionBadge from '../components/UserSessionBadge';
import ActionModal from '../components/ActionModal';
import LedgerAutocomplete from '../components/LedgerAutocomplete';

function LoansPage() {
  const [loans, setLoans] = useState([]);
  const [loading, setLoading] = useState(false);
  const [showAddModal, setShowAddModal] = useState(false);
  const [showReduceModal, setShowReduceModal] = useState(false);
  const [selectedLoan, setSelectedLoan] = useState(null);
  const [statusMessage, setStatusMessage] = useState(null);

  const [newLoan, setNewLoan] = useState({
    borrowerName: '',
    amount: '',
    date: dayjs().format('YYYY-MM-DD'),
    type: 'loan',
    description: '',
    ledgerId: '',
    ledgerInput: ''
  });

  const [reduceAmount, setReduceAmount] = useState({
    amount: '',
    description: '',
    ledgerId: '',
    ledgerInput: ''
  });

  const fetchLoans = useCallback(async () => {
    setLoading(true);
    try {
      const { data } = await api.get('/loans');
      setLoans(data);
    } catch (error) {
      console.error(error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchLoans();
  }, [fetchLoans]);

  const handleAddLoan = async (e) => {
    e.preventDefault();
    if (!newLoan.ledgerId) {
      setStatusMessage({ title: 'Ledger Required', message: 'You must select a ledger to record the outgoing cash.', type: 'warning' });
      return;
    }
    try {
      await api.post('/loans', { ...newLoan, createTransaction: true });
      setShowAddModal(false);
      setNewLoan({
        borrowerName: '',
        amount: '',
        date: dayjs().format('YYYY-MM-DD'),
        type: 'loan',
        description: '',
        ledgerId: '',
        ledgerInput: ''
      });
      fetchLoans();
      setStatusMessage({ title: 'Success', message: 'Loan added successfully', type: 'success' });
    } catch (error) {
      setStatusMessage({ title: 'Error', message: error.response?.data?.message || 'Failed to add loan', type: 'danger' });
    }
  };

  const handleReduceLoan = async (e) => {
    e.preventDefault();
    if (!reduceAmount.ledgerId) {
      setStatusMessage({ title: 'Ledger Required', message: 'You must select a ledger to record the income.', type: 'warning' });
      return;
    }
    try {
      await api.post(`/loans/${selectedLoan._id}/reduce`, { ...reduceAmount, createTransaction: true });
      setShowReduceModal(false);
      setReduceAmount({
        amount: '',
        description: '',
        ledgerId: '',
        ledgerInput: ''
      });
      setSelectedLoan(null);
      fetchLoans();
      setStatusMessage({ title: 'Success', message: 'Loan balance reduced successfully', type: 'success' });
    } catch (error) {
      setStatusMessage({ title: 'Error', message: error.response?.data?.message || 'Failed to reduce loan', type: 'danger' });
    }
  };

  const handleRemoveLoan = async (id) => {
    if (!window.confirm('Are you sure you want to remove this loan record?')) return;
    try {
      await api.delete(`/loans/${id}`);
      fetchLoans();
      setStatusMessage({ title: 'Removed', message: 'Loan record has been deleted', type: 'success' });
    } catch (error) {
      setStatusMessage({ title: 'Error', message: 'Failed to delete loan', type: 'danger' });
    }
  };

  return (
    <div className="relative min-h-screen overflow-x-hidden bg-[#f4faff] text-[#001f2a] [font-family:Inter,ui-sans-serif,system-ui]">
      <div className="mx-auto flex max-w-[1700px] gap-5 px-4 py-5 md:px-6">
        <AppSidebar />
        
        <main className="min-w-0 flex-1 space-y-6">
          <header className="flex flex-wrap items-center justify-between gap-4 rounded-xl bg-white p-6 shadow-sm">
            <div>
              <h1 className="[font-family:Manrope,ui-sans-serif,system-ui] text-3xl font-bold tracking-tight text-[#001f2a]">Loans & Advances</h1>
              <p className="text-sm text-slate-500">Manage company-issued personal loans and tracking balances.</p>
            </div>
            <div className="flex items-center gap-3">
              <UserSessionBadge compact />
            </div>
          </header>

          {/* Integrated Issue New Loan Form */}
          <section className="rounded-xl bg-white p-6 shadow-sm border-t-4 border-[#00694b]">
            <div className="mb-4">
              <h2 className="text-lg font-black text-[#001f2a]">Issue New Loan / Advance</h2>
              <p className="text-xs text-slate-400 font-bold uppercase tracking-widest mt-1">Transaction will be automatically recorded in cash ledger</p>
            </div>
            
            <form onSubmit={handleAddLoan} className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-6 gap-4 items-end">
              <div className="lg:col-span-1">
                <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-1 block">Borrower Name</label>
                <input required className="w-full rounded-lg bg-slate-50 border-none p-3 text-xs font-bold outline-none ring-1 ring-slate-200 focus:ring-2 focus:ring-emerald-500" value={newLoan.borrowerName} onChange={e => setNewLoan({...newLoan, borrowerName: e.target.value})} placeholder="e.g. Joynal Bokhsho" />
              </div>
              <div className="lg:col-span-1">
                <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-1 block">Amount (BDT)</label>
                <input required type="number" className="w-full rounded-lg bg-slate-50 border-none p-3 text-xs font-bold outline-none ring-1 ring-slate-200 focus:ring-2 focus:ring-emerald-500" value={newLoan.amount} onChange={e => setNewLoan({...newLoan, amount: e.target.value})} />
              </div>
              <div className="lg:col-span-1">
                <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-1 block">Type</label>
                <select className="w-full rounded-lg bg-slate-50 border-none p-3 text-xs font-bold outline-none ring-1 ring-slate-200" value={newLoan.type} onChange={e => setNewLoan({...newLoan, type: e.target.value})}>
                  <option value="loan">Loan</option>
                  <option value="advance">Advance</option>
                </select>
              </div>
              <div className="lg:col-span-1">
                <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-1 block">Cash Account / Ledger</label>
                <LedgerAutocomplete 
                  value={newLoan.ledgerInput}
                  selectedLedgerId={newLoan.ledgerId}
                  onChange={val => setNewLoan(prev => ({...prev, ledgerInput: val}))}
                  onSelect={l => setNewLoan(prev => ({...prev, ledgerId: l?._id || ''}))}
                  excludeGroups={true}
                />
              </div>
              <div className="lg:col-span-1 text-center pb-1">
                 <p className="text-[9px] font-black text-emerald-600 uppercase">Automatic Cash Entry</p>
                 <p className="text-[8px] text-slate-400 font-bold">REDUCED FROM DRAWER</p>
              </div>
              <div className="lg:col-span-1">
                <button type="submit" className="w-full rounded-lg bg-[#00694b] py-3 text-xs font-black text-white shadow-lg shadow-emerald-900/10 hover:bg-[#005a40] uppercase tracking-widest transition-transform active:scale-95">Issue Loan</button>
              </div>
            </form>
          </section>

          <div className="grid gap-6 md:grid-cols-3">
            <div className="rounded-xl bg-white p-6 shadow-sm border-l-4 border-emerald-500">
              <p className="text-xs font-black uppercase tracking-widest text-slate-400">Total Active Loans</p>
              <p className="mt-2 text-3xl font-black text-[#001f2a]">{loans.filter(l => l.status === 'active').length}</p>
            </div>
            <div className="rounded-xl bg-white p-6 shadow-sm border-l-4 border-blue-500">
              <p className="text-xs font-black uppercase tracking-widest text-slate-400">Outstanding Balance</p>
              <p className="mt-2 text-3xl font-black text-[#001f2a]">
                ৳ {loans.filter(l => l.status === 'active').reduce((acc, curr) => acc + curr.remainingAmount, 0).toLocaleString()}
              </p>
            </div>
            <div className="rounded-xl bg-white p-6 shadow-sm border-l-4 border-slate-300">
              <p className="text-xs font-black uppercase tracking-widest text-slate-400">Total Issued</p>
              <p className="mt-2 text-3xl font-black text-slate-500">
                ৳ {loans.reduce((acc, curr) => acc + curr.totalAmount, 0).toLocaleString()}
              </p>
            </div>
          </div>

          <section className="overflow-hidden rounded-xl bg-white shadow-sm">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-100">
                    <th className="px-6 py-4 text-[10px] font-black uppercase tracking-widest text-slate-400">Borrower</th>
                    <th className="px-6 py-4 text-[10px] font-black uppercase tracking-widest text-slate-400">Type</th>
                    <th className="px-6 py-4 text-[10px] font-black uppercase tracking-widest text-slate-400">Issued Date</th>
                    <th className="px-6 py-4 text-[10px] font-black uppercase tracking-widest text-slate-400">Principal</th>
                    <th className="px-6 py-4 text-[10px] font-black uppercase tracking-widest text-slate-400">Outstanding</th>
                    <th className="px-6 py-4 text-[10px] font-black uppercase tracking-widest text-slate-400 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50">
                  {loading ? (
                    <tr><td colSpan="6" className="px-6 py-10 text-center text-slate-400">Loading loans...</td></tr>
                  ) : loans.length === 0 ? (
                    <tr><td colSpan="6" className="px-6 py-10 text-center text-slate-400">No loan records found.</td></tr>
                  ) : loans.map(loan => (
                    <tr key={loan._id} className={`group hover:bg-slate-50/50 transition ${loan.status === 'closed' ? 'opacity-60' : ''}`}>
                      <td className="px-6 py-4">
                        <p className="font-bold text-[#001f2a]">{loan.borrowerName}</p>
                        <p className="text-xs text-slate-400">{loan.description || 'No notes'}</p>
                      </td>
                      <td className="px-6 py-4">
                        <span className={`rounded-md px-2 py-1 text-[10px] font-black uppercase tracking-0.1em ${loan.type === 'loan' ? 'bg-blue-100 text-blue-700' : 'bg-purple-100 text-purple-700'}`}>
                          {loan.type}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-sm text-slate-500">{dayjs(loan.date).format('DD MMM YYYY')}</td>
                      <td className="px-6 py-4 font-bold text-slate-600">৳{loan.totalAmount.toLocaleString()}</td>
                      <td className="px-6 py-4">
                        <p className={`font-black ${loan.remainingAmount > 0 ? 'text-[#00694b]' : 'text-slate-400 line-through'}`}>
                          ৳{loan.remainingAmount.toLocaleString()}
                        </p>
                        {loan.status === 'closed' && <span className="text-[10px] font-bold text-emerald-600 uppercase tracking-widest">Closed</span>}
                      </td>
                      <td className="px-6 py-4 text-right">
                        <div className="flex items-center justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                          {loan.status === 'active' && (
                            <button 
                              onClick={() => { setSelectedLoan(loan); setShowReduceModal(true); }}
                              className="rounded-lg bg-emerald-50 px-3 py-1.5 text-xs font-bold text-emerald-700 hover:bg-emerald-100"
                            >
                              Repay
                            </button>
                          )}
                          <button 
                            onClick={() => handleRemoveLoan(loan._id)}
                            className="rounded-lg bg-red-50 px-3 py-1.5 text-xs font-bold text-red-600 hover:bg-red-100"
                          >
                            Remove
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        </main>
      </div>

      {/* Reduce Loan Modal */}
      {showReduceModal && selectedLoan && (
        <div className="fixed inset-0 z-[1200] flex items-center justify-center bg-slate-950/60 p-4 backdrop-blur-md">
          <div className="w-full max-w-lg rounded-2xl bg-white p-8 shadow-2xl animate-in zoom-in duration-200">
            <h2 className="text-2xl font-black text-[#001f2a]">Record Repayment</h2>
            <p className="text-sm text-slate-500 mb-6">Receive payment from <strong>{selectedLoan.borrowerName}</strong>. Current balance: ৳{selectedLoan.remainingAmount.toLocaleString()}</p>
            
            <form onSubmit={handleReduceLoan} className="space-y-4">
              <div>
                <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-1 block">Repayment Amount (BDT)</label>
                <input required type="number" max={selectedLoan.remainingAmount} className="w-full rounded-lg bg-slate-50 border-none p-3 text-sm font-bold outline-none ring-1 ring-slate-200 focus:ring-2 focus:ring-emerald-500" value={reduceAmount.amount} onChange={e => setReduceAmount({...reduceAmount, amount: e.target.value})} />
              </div>
              <div>
                <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-1 block">Source Ledger (Audit trail)</label>
                <LedgerAutocomplete 
                  value={reduceAmount.ledgerInput}
                  selectedLedgerId={reduceAmount.ledgerId}
                  onChange={val => setReduceAmount(prev => ({...prev, ledgerInput: val}))}
                  onSelect={l => setReduceAmount(prev => ({...prev, ledgerId: l?._id || ''}))}
                  excludeGroups={true}
                />
                <p className="mt-1 text-[10px] font-bold text-slate-400">This will automatically increase your cash balance.</p>
              </div>
              <div className="flex gap-3 pt-4">
                <button type="button" onClick={() => setShowReduceModal(false)} className="flex-1 py-3 text-sm font-bold text-slate-400 hover:text-slate-600 uppercase tracking-widest">Cancel</button>
                <button type="submit" className="flex-1 rounded-lg bg-[#00694b] py-3 text-sm font-bold text-white shadow-lg shadow-emerald-900/10 hover:bg-[#005a40] uppercase tracking-widest">Save Repayment</button>
              </div>
            </form>
          </div>
        </div>
      )}

      <ActionModal 
        isOpen={!!statusMessage}
        onClose={() => setStatusMessage(null)}
        onConfirm={() => setStatusMessage(null)}
        title={statusMessage?.title}
        message={statusMessage?.message}
        type={statusMessage?.type}
      />
    </div>
  );
}

export default LoansPage;
