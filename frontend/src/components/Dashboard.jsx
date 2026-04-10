function formatBDT(value) {
  return `৳ ${Number(value || 0).toLocaleString()}`;
}

function Dashboard({ daily }) {
  const cardData = [
    {
      label: 'Daily Income',
      value: daily.income,
      valueTone: 'text-[#00694b]',
      iconTone: 'bg-[#84f8c8] text-[#005139]',
      chip: '+12%',
      chipTone: 'text-[#00694b] bg-[#d9f8ea]',
    },
    {
      label: 'Daily Outgoing',
      value: daily.outgoing,
      valueTone: 'text-[#001f2a]',
      iconTone: 'bg-[#ffdad6] text-[#93000a]',
      chip: 'Stable',
      chipTone: 'text-slate-500 bg-slate-100',
    },
    {
      label: 'Daily Balance',
      value: daily.balance,
      valueTone: 'text-white',
      iconTone: 'bg-white/20 text-white',
      chip: null,
      chipTone: 'text-white/90 bg-white/20',
      accent: true,
    },
  ];

  return (
    <section aria-label="Performance summary" className="space-y-3">
      <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
        {cardData.map((card) => (
          <div
            key={card.label}
            className={`relative overflow-hidden rounded-2xl p-3 transition-transform duration-200 hover:-translate-y-0.5 ${
              card.accent
                ? 'bg-gradient-to-br from-[#00694b] to-[#008560] shadow-lg shadow-emerald-900/20'
                : 'bg-white'
            }`}
          >
            {card.accent ? <div className="absolute -right-6 -top-6 h-28 w-28 rounded-full bg-white/10 blur-2xl" /> : null}

            <p className={`relative z-10 mt-3 text-[10px] font-semibold uppercase tracking-[0.14em] ${card.accent ? 'text-emerald-100' : 'text-[#3d4a43]'}`}>
              {card.label}
            </p>
            <p className={`relative z-10 mt-1 [font-family:Manrope,ui-sans-serif,system-ui] text-[2.2rem] font-bold tracking-tight ${card.valueTone}`}>
              {formatBDT(card.value)}
            </p>
          </div>
        ))}
      </div>

    </section>
  );
}

export default Dashboard;
