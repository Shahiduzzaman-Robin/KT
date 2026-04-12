function formatBDT(value) {
  return `৳ ${Number(value || 0).toLocaleString()}`;
}

function Dashboard({ daily }) {
  const cardData = [
    {
      label: 'Daily Income',
      value: daily.income,
      valueTone: 'text-[#00694b]',
      icon: (
        <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M19 14l-7 7m0 0l-7-7m7 7V3" />
        </svg>
      ),
      iconStyle: 'bg-[#d9f8ea] text-[#00694b]',
    },
    {
      label: 'Daily Outgoing',
      value: daily.outgoing,
      valueTone: 'text-[#ba1a1a]',
      icon: (
        <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 10l7-7m0 0l7 7m-7-7v18" />
        </svg>
      ),
      iconStyle: 'bg-[#ffdad6] text-[#ba1a1a]',
    },
    {
      label: 'Daily Balance',
      value: daily.balance,
      valueTone: 'text-white',
      accent: true,
      icon: (
        <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
        </svg>
      ),
      iconStyle: 'bg-white/20 text-white',
    },
  ];

  return (
    <section aria-label="Performance summary" className="space-y-4">
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {cardData.map((card) => (
          <div
            key={card.label}
            className={`group relative overflow-hidden rounded-[2rem] p-6 transition-all duration-300 hover:scale-[1.01] hover:shadow-2xl hover:shadow-emerald-900/5 ${
              card.accent
                ? 'bg-gradient-to-br from-[#00694b] to-[#01402e] text-white shadow-xl shadow-emerald-900/20'
                : 'bg-white border border-slate-50'
            }`}
          >
            {card.accent ? (
              <div className="absolute -right-10 -top-10 h-32 w-32 rounded-full bg-white/5 blur-3xl opacity-50" />
            ) : null}

            <div className="relative z-10 flex items-center justify-between">
              <div>
                <p className={`text-[10px] font-black uppercase tracking-[0.2em] ${card.accent ? 'text-emerald-200/50' : 'text-slate-400'}`}>
                  {card.label}
                </p>
                <div className="mt-2 flex items-baseline gap-1">
                  <span className={`[font-family:Manrope,ui-sans-serif,system-ui] text-[2.4rem] font-black tracking-tighter tabular-nums leading-none ${card.valueTone}`}>
                    {formatBDT(card.value)}
                  </span>
                </div>
              </div>
              
              <div className={`flex h-12 w-12 items-center justify-center rounded-2xl shadow-inner transition-transform group-hover:rotate-6 ${card.iconStyle}`}>
                {card.icon}
              </div>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}

export default Dashboard;
