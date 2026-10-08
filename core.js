/* Pure calculations shared by the interface and checks. No network requests. */
(function (root) {
  'use strict';
  const money = n => new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 }).format(n);
  const number = (n, digits = 2) => new Intl.NumberFormat('id-ID', { minimumFractionDigits: digits, maximumFractionDigits: digits }).format(n);
  const percent = n => number(n) + '%';
  const date = s => new Intl.DateTimeFormat('id-ID', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' }).format(new Date(s));
  const days = (a, b) => Math.round((new Date(b) - new Date(a)) / 86400000);
  const escape = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const compact = n => n >= 1e12 ? 'Rp' + number(n / 1e12, 2) + ' T' : n >= 1e9 ? 'Rp' + number(n / 1e9, 2) + ' M' : n >= 1e6 ? 'Rp' + number(n / 1e6, 1) + ' jt' : money(n);
  function fundReturn(fund, months) {
    const h = fund.history; const start = h[Math.max(0, h.length - 1 - months)];
    return (h[h.length - 1].nav / start.nav - 1) * 100;
  }
  function maxDrawdown(history) {
    let peak = -Infinity, worst = 0;
    history.forEach(p => { peak = Math.max(peak, p.nav); worst = Math.min(worst, (p.nav / peak - 1) * 100); });
    return worst;
  }
  function quota(bond, reservations) {
    return Math.max(0, bond.quota - reservations.filter(r => r.bondId === bond.id && r.status === 'active').reduce((s, r) => s + r.nominal, 0));
  }
  function quotaStatus(bond, reservations) {
    const q = quota(bond, reservations);
    return q === 0 ? { label: 'Habis', tone: 'neutral' } : q <= bond.lowQuota ? { label: 'Terbatas', tone: 'amber' } : { label: 'Tersedia', tone: 'green' };
  }
  function fundRate(fund, data) {
    return (fund.currency || 'IDR') === 'USD' ? data.fxUSDIDR : 1;
  }
  const localMoney = (n, currency = 'IDR') => currency === 'USD' ? 'USD ' + number(n, 2) : money(n);
  const idrValue = (amount, currency, data) => amount * (currency === 'USD' ? data.fxUSDIDR : 1);
  function balances(client, data) {
    const cash = client.cash || {}, deposits = client.deposits || {};
    return { cashIDR: Number(cash.IDR) || 0, cashUSD: Number(cash.USD) || 0,
      depositIDR: Number(deposits.IDR) || 0, depositUSD: Number(deposits.USD) || 0,
      cashValue: (Number(cash.IDR) || 0) + (Number(cash.USD) || 0) * data.fxUSDIDR,
      depositValue: (Number(deposits.IDR) || 0) + (Number(deposits.USD) || 0) * data.fxUSDIDR };
  }
  function fundInvestment(fund, budget, inputCurrency, data) {
    const rate = data.fxUSDIDR, currency = fund.currency || 'IDR', nav = fund.history.at(-1).nav;
    if (!['USD', 'IDR'].includes(inputCurrency) || !(budget > 0) || !Number.isFinite(rate) || rate <= 0 || !(nav > 0)) return null;
    const localAmount = inputCurrency === currency ? budget : inputCurrency === 'USD' ? budget * rate : budget / rate;
    return { currency, inputCurrency, budget, localAmount, units: localAmount / nav, nav, idrValue: currency === 'USD' ? localAmount * rate : localAmount, rate, meetsMinimum: localAmount >= fund.minimum };
  }
  function holdingValue(h, data) {
    if (h.type === 'bond') { const b = data.bonds.find(p => p.id === h.productId); return b ? idrValue(h.nominal * b.price / 100, b.currency, data) : 0; }
    const f = data.funds.find(p => p.id === h.productId); return f ? h.units * f.history[f.history.length - 1].nav * fundRate(f, data) : 0;
  }
  function portfolio(client, data) {
    const liquid = balances(client, data);
    const bonds = client.holdings.filter(h => h.type === 'bond').reduce((s, h) => s + holdingValue(h, data), 0);
    const funds = client.holdings.filter(h => h.type === 'fund').reduce((s, h) => s + holdingValue(h, data), 0);
    const usdHoldings = client.holdings.reduce((s,h) => { const p = h.type === 'bond' ? data.bonds.find(x=>x.id===h.productId) : data.funds.find(x=>x.id===h.productId); return s + (p?.currency === 'USD' ? holdingValue(h,data) : 0); },0);
    const cash = liquid.cashValue, deposits = liquid.depositValue, total = bonds + funds + cash + deposits;
    const usd = usdHoldings + (liquid.cashUSD + liquid.depositUSD) * data.fxUSDIDR;
    return { bonds, funds, cash, deposits, total, usd, idr: total-usd };
  }
  function reserveError(bond, amount, available) {
    if (!Number.isFinite(amount) || amount <= 0) return 'Masukkan nominal yang valid.';
    if (amount < bond.minimum) return 'Minimum nominal ' + localMoney(bond.minimum,bond.currency) + '.';
    if (Math.abs(amount/bond.minimum-Math.round(amount/bond.minimum))>1e-8) return 'Gunakan kelipatan ' + localMoney(bond.minimum,bond.currency) + '.';
    if (amount > available) return 'Nominal melebihi sisa kuota tersedia.';
    return '';
  }
  function accrued(bond, asOf, nominal) {
    const elapsed = Math.max(0, days(bond.previousCoupon, asOf));
    const period = days(bond.previousCoupon, bond.nextCoupon);
    return nominal * bond.coupon / 100 / 2 * Math.min(1, elapsed / period);
  }
  function bondSimulation(bond, nominal, asOf) {
    const cleanCost = nominal * bond.price / 100;
    const interest = accrued(bond, asOf, nominal);
    return { cleanCost, accrued: interest, totalCost: cleanCost + interest, annualCoupon: nominal * bond.coupon / 100, couponPayment: nominal * bond.coupon / 100 / 2 };
  }
  function growth(principal, annual, years) {
    if (!(principal > 0) || !Number.isFinite(annual) || annual <= -100 || !(years > 0)) return null;
    return principal * Math.pow(1 + annual / 100, years);
  }
  function csv(rows) {
    return '\uFEFF' + rows.map(row => row.map(v => {
      let s = String(v ?? '');
      if (typeof v === 'string' && /^[=+@\-\t\r]/.test(s)) s = "'" + s;
      return '"' + s.replace(/"/g, '""') + '"';
    }).join(',')).join('\r\n');
  }
  function dailyMovers(products,kind,direction,asOf){
    return products.map(product=>{const current=kind==='bond'?product.price:product.history?.at(-1)?.nav,previous=kind==='bond'?product.previousPrice:product.previousNav;
      const observationDate=kind==='bond'?product.priceUpdated?.slice(0,10):product.updated;
      if(!Number.isFinite(current)||!Number.isFinite(previous)||current<=0||previous<=0||observationDate!==asOf||!product.previousDate||days(product.previousDate,asOf)!==1)return null;
      return {product,current,previous,change:(current/previous-1)*100};
    }).filter(m=>m&&(direction==='gain'?m.change>0:m.change<0)).sort((a,b)=>(direction==='gain'?b.change-a.change:a.change-b.change)||a.product.id.localeCompare(b.product.id)).slice(0,3);
  }
  function migrateSbnState(state,data){
    if(!state||typeof state!=='object')return state;
    const allowed=new Set([...data.bonds,...data.funds].map(p=>p.id)),bonds=new Set(data.bonds.map(p=>p.id));
    const retired=/\bBD0[45]\b|Nusantara Demo A|Energi Demo B|PT Nusantara|PT Energi Raya|korporasi|corporate bonds?/i;
    const mentions=value=>retired.test(JSON.stringify(value)||'');
    const affected=new Set();
    if(Array.isArray(state.clients))state.clients.forEach(c=>{
      if(c.risk==='Konservatif')c.risk='Conservative';
      const seed=data.clients.find(x=>x.id===c.id);
      if(!state.saaDemoV3&&c.id==='CL01'&&c.holdings?.length===3&&c.holdings[0]?.productId==='BD01'&&c.holdings[0]?.nominal===1500000000&&c.holdings[1]?.productId==='RD02'&&c.holdings[1]?.units===380000&&c.holdings[2]?.productId==='RD01'&&c.holdings[2]?.units===160000)c.holdings=JSON.parse(JSON.stringify(seed.holdings));
      if(!state.saaDemoV3&&c.id==='CL04'&&c.risk==='Moderat'&&c.holdings?.some(h=>h.productId==='BD06'&&h.nominal===1200000000))c.risk='Very Conservative';
      if(!state.balancesV2){if(!c.cash)c.cash={...(seed?.cash||{IDR:0,USD:0})};if(!c.deposits)c.deposits={...(seed?.deposits||{IDR:0,USD:0})};}
      if(!c.cash)c.cash={IDR:0,USD:0};if(!c.deposits)c.deposits={IDR:0,USD:0};
      if(Array.isArray(c.holdings)){if(c.holdings.some(h=>!allowed.has(h.productId)))affected.add(c.id);c.holdings=c.holdings.filter(h=>allowed.has(h.productId));}
      if(Array.isArray(c.notes))c.notes=c.notes.filter(n=>!mentions(n));
    });
    if(Array.isArray(state.reservations))state.reservations=state.reservations.filter(r=>bonds.has(r.bondId));
    if(Array.isArray(state.tasks))state.tasks=state.tasks.filter(t=>!mentions(t));
    if(Array.isArray(state.threads))state.threads=state.threads.filter(t=>(!t.productId||allowed.has(t.productId))&&!mentions({...t,comments:[]})).map(t=>({...t,comments:Array.isArray(t.comments)?t.comments.filter(c=>!mentions(c)):t.comments}));
    if(Array.isArray(state.rebalancePlans))state.rebalancePlans=state.rebalancePlans.filter(p=>!affected.has(p.clientId)&&!mentions(p));
    if(state.advisoryChats&&typeof state.advisoryChats==='object')for(const id of Object.keys(state.advisoryChats))if(affected.has(id)||mentions(state.advisoryChats[id]))delete state.advisoryChats[id];
    if(!state.saaDemoV3){state.rebalancePlans=(state.rebalancePlans||[]).filter(p=>p.rows?.length===3);state.advisoryChats={};}
    state.saaDemoV3=true;state.balancesV2=true;state.catalogScope='sovereign-only';return state;
  }
  const api = { migrateSbnState, dailyMovers, money, localMoney, idrValue, balances, number, percent, date, days, escape, compact, fundReturn, maxDrawdown, quota, quotaStatus, fundRate, fundInvestment, holdingValue, portfolio, reserveError, accrued, bondSimulation, growth, csv };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  root.CindyCore = api;
})(typeof window !== 'undefined' ? window : globalThis);
