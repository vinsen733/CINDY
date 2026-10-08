/* Deterministic advisory prototype. Fictional snapshot, no live feed or trade execution. */
(function(root){
  'use strict';
  const buckets=['Kas / Pasar Uang','Pendapatan Tetap','Saham'];
  const models={
    'Very Conservative':[65,35,0],
    Conservative:[40,50,10],
    Moderat:[20,40,40],
    Agresif:[10,30,60]
  };
  const riskRank={'Very Conservative':1,Conservative:2,Konservatif:2,Moderat:3,Agresif:4};
  const normalizedRisk=r=>r==='Konservatif'?'Conservative':r;
  function weights(p,type){
    if(type==='bond'||p.category==='Pendapatan Tetap')return [0,1,0];
    if(p.category==='Pasar Uang')return [1,0,0];
    if(p.category==='Saham')return [0,0,1];
    if(p.category==='Campuran'){
      const shares=[0,0,0];
      (p.allocation||[]).forEach(a=>{const k=/saham/i.test(a.name)?2:/sbn|obligasi|pendapatan tetap/i.test(a.name)?1:0;shares[k]+=a.value/100;});
      return shares;
    }
    return [0,0,0];
  }
  function positions(client,data,core){
    const b=core.balances(client,data),result=[
      {id:'cash-IDR',name:'CASA IDR',currency:'IDR',kind:'cash',value:b.cashIDR,weights:[1,0,0]},
      {id:'cash-USD',name:'CASA USD',currency:'USD',kind:'cash',value:b.cashUSD*data.fxUSDIDR,weights:[1,0,0]},
      {id:'deposit-IDR',name:'Deposito IDR',currency:'IDR',kind:'deposit',value:b.depositIDR,weights:[1,0,0]},
      {id:'deposit-USD',name:'Deposito USD',currency:'USD',kind:'deposit',value:b.depositUSD*data.fxUSDIDR,weights:[1,0,0]}
    ];
    (client.holdings||[]).forEach(h=>{const type=h.type,p=(type==='bond'?data.bonds:data.funds).find(x=>x.id===h.productId);if(p)result.push({id:p.id,name:p.name,kind:type,currency:p.currency||'IDR',value:core.holdingValue(h,data),weights:weights(p,type)});});
    return result.filter(x=>x.value>0);
  }
  function marketView(data){
    const c=data.marketContext||{},fx=c.usdSignal||{},ust=c.ust10,sbn=c.sbn10;
    const bullish=!!fx.bullish;
    return {bullish,label:fx.label||'Belum ada sinyal',change1d:fx.change1d||0,change3m:fx.change3m||0,
      change1y:fx.change1y||0,averageAnnual:fx.averageAnnual||0,
      reasons:[`USD/IDR contoh ${data.fxUSDIDR?.toLocaleString('id-ID')} per USD, perubahan 1 hari ${fx.change1d?.toFixed(2)??'—'}% dan 3 bulan ${fx.change3m?.toFixed(2)??'—'}%.`,
        `Yield UST 10Y contoh ${ust?.yield?.toFixed(2)??'—'}%, perubahan ${ust?Math.round((ust.yield-ust.previous)*100):'—'} bp; yield SBN 10Y ${sbn?.yield?.toFixed(2)??'—'}%.`],
      caution:'Sinyal kurs pendek tidak menjamin tren berikutnya. Kenaikan yield dapat menekan harga obligasi; kurs jual/beli, spread, dan kebutuhan likuiditas perlu diperiksa.'};
  }
  function rebalance(client,data,core,custom){
    const items=positions(client,data,core),values=buckets.map((_,i)=>items.reduce((s,p)=>s+p.value*p.weights[i],0));
    const total=values.reduce((a,b)=>a+b,0),risk=normalizedRisk(client.risk),targets=(custom||models[risk]||models.Moderat).slice();
    if(targets.length!==3||targets.some(n=>!Number.isFinite(n)||n<0||n>100)||Math.abs(targets.reduce((a,b)=>a+b,0)-100)>.001)return {error:'Total target harus 100%, dengan setiap alokasi antara 0–100%.'};
    const rows=buckets.map((name,i)=>({name,current:values[i],currentPct:total?values[i]/total*100:0,targetPct:targets[i],target:total*targets[i]/100,delta:total*targets[i]/100-values[i]}));
    const liquidity=Math.max(0,Number(client.liquidity)||0),cash=core.balances(client,data),currency=core.portfolio(client,data);
    return {total,rows,turnover:rows.reduce((s,r)=>s+Math.max(0,r.delta),0),liquidity,liquidityGap:Math.max(0,liquidity-cash.cashValue),moneyMarketGap:Math.max(0,liquidity-rows[0].target),custom:!!custom,risk,threshold:2,
      currency:{usd:currency.usd,idr:currency.idr,usdPct:total?currency.usd/total*100:0,idrPct:total?currency.idr/total*100:0},snapshot:data.asOf};
  }
  function allowed(p,client,row){
    const rank=riskRank[normalizedRisk(client.risk)]||3,productRank=riskRank[p.risk]||4;
    return productRank<=rank || (row.name==='Saham'&&normalizedRisk(client.risk)==='Conservative'&&p.selective===true&&row.targetPct<=10);
  }
  function recommend(client,data,core,reservations,custom){
    const plan=rebalance(client,data,core,custom);if(plan.error)return plan;
    const view=marketView(data),owned=new Set((client.holdings||[]).map(h=>h.productId)),items=positions(client,data,core),balances=core.balances(client,data);
    const usdLimit=plan.total*.2,usdShortfall=Math.max(0,usdLimit-plan.currency.usd);
    const liquidUSD=Math.max(0,balances.cashUSD*data.fxUSDIDR-Math.max(0,plan.liquidity-balances.cashIDR));
    // Cash can fund another asset bucket only when the cash bucket is above its target.
    // A purchase of a money market fund with existing USD cash does not close a cash-bucket gap.
    let usdBudget=view.bullish&&plan.currency.usdPct<20?usdShortfall:0;
    let usdCashAvailable=Math.min(liquidUSD,Math.max(0,-plan.rows[0].delta));
    const cashFloor=Math.min(plan.liquidity,balances.cashValue);
    const fundingCapacity=plan.rows.reduce((s,r)=>s+(r.delta<0?(r.name===buckets[0]?Math.min(-r.delta,Math.max(0,r.current-cashFloor)):-r.delta):0),0);
    let fundingRemaining=fundingCapacity;
    const groups=plan.rows.filter(r=>r.delta>.01).map(row=>{
      let remaining=row.delta;
      const funds=data.funds.filter(p=>weights(p,'fund')[buckets.indexOf(row.name)]===1);
      const pool=(row.name==='Pendapatan Tetap'?[...data.bonds,...funds]:funds).filter(p=>allowed(p,client,row)&&(!p.coupon||(core.quota(p,reservations)>=p.minimum&&core.days(data.asOf,p.maturity)>0)));
      pool.sort((a,b)=>{
        const usdA=Number(view.bullish&&usdBudget>0&&a.currency==='USD'),usdB=Number(view.bullish&&usdBudget>0&&b.currency==='USD');
        return usdB-usdA||Number(owned.has(b.id))-Number(owned.has(a.id))||(riskRank[a.risk]-riskRank[b.risk])||
          (a.coupon&&b.coupon?a.duration-b.duration:a.coupon?-1:b.coupon?1:a.fee-b.fee)||a.id.localeCompare(b.id);
      });
      const products=[];
      for(const p of pool){
        const bond=!!p.coupon,usd=p.currency==='USD',fx=usd?data.fxUSDIDR:1;
        const limit=Math.min(remaining,usd?usdBudget:remaining,fundingRemaining,bond&&usd?usdShortfall*.6:Infinity);if(limit<=0)continue;
        let amount=0,nominal=null,units=null;
        if(bond){const available=core.quota(p,reservations),step=p.minimum,price=p.price/100;
          nominal=Math.floor(Math.min(limit/(fx*price),available)/step+1e-9)*step;
          amount=nominal*price*fx;if(nominal<step||amount>limit+.01)continue;
        }else{amount=Math.floor(limit);const investment=core.fundInvestment(p,amount,'IDR',data);if(!investment?.meetsMinimum)continue;units=investment.units;}
        const sourceUsd=usd&&row.name!==buckets[0]?Math.min(usdCashAvailable,amount):0,convertIDR=usd?Math.max(0,amount-sourceUsd):0;
        if(usd){usdCashAvailable=Math.max(0,usdCashAvailable-sourceUsd);usdBudget=Math.max(0,usdBudget-amount);}
        const entryMode=usd?'Bertahap; konfirmasi kurs dan kuota':row.name==='Saham'?'Bertahap; evaluasi valuasi dan risiko':'Bertahap; cek harga, yield, dan horizon';
        const reason=usd?`Porsi USD nasabah ${core.number(plan.currency.usdPct,1)}%; IDR ${core.number(plan.currency.idrPct,1)}%. ${view.label} pada snapshot, sehingga produk USD layak ditinjau untuk kekurangan ${row.name}. ${bond?'Kupon '+core.percent(p.coupon)+' dan YTM '+core.percent(p.ytm)+' dalam USD berbeda dari hasil dalam IDR; ':'Kinerja NAB contoh 1Y '+core.percent(core.fundReturn(p,12))+' dalam USD; '}gunakan kas USD sampai ${core.money(sourceUsd)} ekuivalen dan estimasi konversi IDR ${core.money(convertIDR)}. Tinjau kurs, durasi, dan likuiditas.`:
          owned.has(p.id)?`Produk telah dimiliki; tambah secara bertahap sesuai kekurangan ${row.name} pada SAA ${plan.risk}.`:`Kandidat ${row.name} sesuai target SAA ${plan.risk}; pembelian bertahap perlu memperhatikan harga, biaya, likuiditas, dan horizon.`;
        products.push({id:p.id,name:p.name,kind:bond?'bond':'fund',bucket:row.name,amount,nominal,units,currency:p.currency||'IDR',localAmount:amount/fx,fxRate:usd?fx:null,risk:p.risk,minimum:p.minimum,quota:bond?core.quota(p,reservations):null,entryMode,sourceUsd,convertIDR,reason,requiresSuitability:normalizedRisk(client.risk)==='Conservative'&&row.name==='Saham'});
        remaining=Math.max(0,remaining-amount);fundingRemaining=Math.max(0,fundingRemaining-amount);if(remaining<.01||fundingRemaining<.01)break;
      }
      return {name:row.name,needed:row.delta,products,allocated:row.delta-remaining,remaining,reason:!pool.length?'Tidak ada kandidat sesuai profil dan ketersediaan snapshot.':remaining>.01?'Sisa perlu review karena pendanaan yang menjaga likuiditas, kuota, minimum transaksi, batas diversifikasi USD, atau pembulatan nominal.':''};
    });
    const allocated=groups.reduce((s,g)=>s+g.allocated,0),scale=fundingCapacity?allocated/fundingCapacity:0;
    const sourceUsd=groups.flatMap(g=>g.products).reduce((s,p)=>s+p.sourceUsd,0);
    const reductions=plan.rows.filter(r=>r.delta<-.01).flatMap(row=>{
      const i=buckets.indexOf(row.name),capacity=i===0?Math.min(-row.delta,Math.max(0,row.current-cashFloor)):-row.delta,target=capacity*scale;
      if(i!==0)return items.filter(p=>p.weights[i]>0).map(p=>({id:p.id,name:p.name,bucket:row.name,amount:target*(p.value*p.weights[i])/row.current}));
      let remaining=target;const result=[];
      const take=(p,cap)=>{const amount=Math.min(remaining,Math.max(0,cap));if(amount>.01){result.push({id:p.id,name:p.name,bucket:row.name,amount});remaining-=amount;}};
      const cashUSD=items.find(p=>p.id==='cash-USD');if(cashUSD)take(cashUSD,sourceUsd);
      items.filter(p=>p.kind==='fund'&&p.weights[0]>0).forEach(p=>take(p,p.value*p.weights[0]));
      const cashIDR=items.find(p=>p.id==='cash-IDR');if(cashIDR)take(cashIDR,Math.max(0,balances.cashIDR-plan.liquidity));
      items.filter(p=>p.kind==='deposit').forEach(p=>take(p,p.value));
      if(cashUSD)take(cashUSD,Math.max(0,cashUSD.value-sourceUsd-Math.max(0,plan.liquidity-balances.cashIDR)));
      return result;
    });
    return {groups,reductions,allocated,unallocated:groups.reduce((s,g)=>s+g.remaining,0),fundingCapacity,snapshot:data.asOf,market:view,currency:plan.currency,model:plan.risk};
  }
  function explain(client,p,data,core,marketCore){
    const plan=rebalance(client,data,core),row=plan.rows.find(r=>r.name===p.bucket),view=marketView(data),reasons=[
      {label:'Target SAA',text:`${p.bucket}: saat ini ${core.number(row?.currentPct||0,1)}%, target ${core.number(row?.targetPct||0,1)}% untuk profil ${plan.risk}. ${row?.delta>0?'Kekurangan '+core.money(row.delta)+' pada seluruh kelompok.':'Tidak ada kekurangan kelompok; kandidat hanya untuk pembanding.'}`},
      {label:'Mata uang dan timing',text:p.currency==='USD'?`USD saat ini ${core.number(plan.currency.usdPct,1)}% dari portofolio. ${view.label}; USD/IDR 3 bulan ${core.number(view.change3m,2)}%. Tinjau pembelian bertahap dan kurs transaksi.`:`Produk IDR sebagai pembanding; sinyal USD tidak mengubah target SAA tiga kelompok aset.`}
    ];
    const watch=[];let market;
    if(p.kind==='bond'){
      reasons.push({label:'Pendapatan & ketersediaan',text:`Kupon bruto ${core.percent(p.coupon)} p.a. terpisah dari YTM ${core.percent(p.ytm)}. Durasi ${core.number(p.duration,1)} tahun; kuota ${core.localMoney(p.availableQuota,p.currency)}.`});
      const stats=marketCore?.stats(marketCore.series(p,'bond',60),252);if(stats?.volatility!=null)reasons.push({label:'Risiko harga',text:`Volatilitas harga tahunan contoh ${core.percent(stats.volatility)}. Bandingkan grafik di Product Comparison.`});
      const nums=client.horizon.match(/\d+/g)?.map(Number)||[],max=client.horizon.startsWith('>')?Infinity:Math.max(...nums);
      if(nums.length&&core.days(data.asOf,p.maturity)/365.25>max)watch.push('Jatuh tempo melewati horizon yang tercatat; harga jual di pasar sekunder dapat berubah.');
      watch.push(`Periksa spread, pajak, minimum ${core.localMoney(p.minimum,p.currency)}, serta likuiditas dan kuota seri.`);
      market='Kenaikan yield UST/SBN pada skenario dapat menekan harga obligasi. Kurangi risiko timing dengan tenor yang sesuai dan pembelian bertahap.';
    }else{
      reasons.push({label:'NAB & biaya',text:`Kinerja NAB contoh 1 tahun ${core.percent(core.fundReturn(p,12))}; penurunan terbesar dari titik bulanan ${core.percent(core.maxDrawdown(p.history))}; biaya contoh ${core.percent(p.fee)} p.a.; minimum ${core.localMoney(p.minimum,p.currency)}.`});
      watch.push('Kinerja historis tidak menjamin hasil berikutnya; penurunan intrabulan tidak tercakup. Pencairan '+p.redemption+'.');
      if(p.category==='Saham')watch.push('Saham selektif tetap berisiko. Pastikan kesesuaian nasabah dan jangan menganggap porsi SAA sebagai instruksi transaksi.');
      market=p.category==='Pasar Uang'?'Tema likuiditas RPM contoh: periksa jadwal pencairan; reksa dana pasar uang bukan kas instan.':p.category==='Saham'?'Indeks global dalam skenario melemah; masuk bertahap sambil meninjau valuasi dan toleransi risiko.':'Yield naik pada skenario; tinjau durasi dan underlying SBN sebelum menambah reksa dana pendapatan tetap.';
    }
    if(p.currency==='USD')watch.push(`Nilai IDR dapat turun saat USD melemah. Kurs contoh Rp${core.number(data.fxUSDIDR,0)}/USD bukan kurs jual/beli bank.`);
    watch.push(view.caution);return {reasons,watch,market};
  }
  function daily(client,data,core,reservations,date,type='all'){
    const plan=rebalance(client,data,core),view=marketView(data),rank=riskRank[normalizedRisk(client.risk)]||3;
    const products=[...data.bonds.map(p=>({...p,kind:'bond',bucket:'Pendapatan Tetap'})),...data.funds.map(p=>({...p,kind:'fund',bucket:buckets[weights(p,'fund').indexOf(1)]||'Campuran'}))];
    return products.filter(p=>(type==='all'||p.kind===type)&&allowed(p,client,plan.rows.find(r=>r.name===p.bucket)||plan.rows[1])&&(p.kind!=='bond'||(core.quota(p,reservations)>=p.minimum&&core.days(data.asOf,p.maturity)>0)))
      .map(p=>{const row=plan.rows.find(r=>r.name===p.bucket),gap=row?row.targetPct-row.currentPct:0,usd=p.currency==='USD'&&view.bullish&&plan.currency.usdPct<20;
        return {...p,gap,availableQuota:p.kind==='bond'?core.quota(p,reservations):null,priority:gap>2?'Prioritas review':'Alternatif pembanding',reason:gap>2?`Porsi ${p.bucket} kurang ${core.number(gap,1)} poin dari SAA ${plan.risk}.${usd?' USD hanya '+core.number(plan.currency.usdPct,1)+'% dan sinyal kurs contoh menguat.':''}`:`Pembanding ${p.bucket} terhadap SAA; belum menjadi prioritas pembelian.`,score:gap+(usd?5:0)};})
      .sort((a,b)=>b.score-a.score||(a.kind===b.kind?(a.kind==='bond'?a.duration-b.duration:a.fee-b.fee):a.kind==='bond'?-1:1)||a.id.localeCompare(b.id)).slice(0,4);
  }
  function reply(text,client,data,core,reservations,date){
    const q=String(text||'').toLowerCase(),plan=rebalance(client,data,core),view=marketView(data),b=core.balances(client,data),intro=`Konteks ${client.name} · ${plan.risk} · AUM ${core.money(plan.total)} · snapshot ${core.date(data.asOf)}.\n\n`;
    const positionsText=plan.rows.map(r=>`${r.name} ${core.number(r.currentPct,1)}% → SAA ${core.number(r.targetPct,1)}% (${r.delta>=0?'tambah':'kurangi'} ${core.money(Math.abs(r.delta))})`).join('\n');
    const currencyText=`CASA IDR ${core.money(b.cashIDR)}, USD ${core.localMoney(b.cashUSD,'USD')} (≈${core.money(b.cashUSD*data.fxUSDIDR)}); deposito IDR ${core.money(b.depositIDR)}, USD ${core.localMoney(b.depositUSD,'USD')} (≈${core.money(b.depositUSD*data.fxUSDIDR)}). Porsi USD seluruh aset ${core.number(plan.currency.usdPct,1)}%.`;
    const marketText=`${view.label}. ${view.reasons.join(' ')} ${view.caution}`;
    if(/kurs|usd|dolar|indon|indois|timing|pasar|bullish/.test(q)){
      const picks=recommend(client,data,core,reservations).groups.flatMap(g=>g.products).filter(p=>p.currency==='USD').slice(0,2);
      return intro+currencyText+'\n\n'+marketText+'\n\n'+(picks.length?'Kandidat valas untuk ditinjau: '+picks.map(p=>`${p.name} sekitar ${core.money(p.amount)} ekuivalen IDR; ${p.reason}`).join('\n'):'Saat ini tidak ada tambahan USD yang lolos profil, kuota, minimum, dan batas diversifikasi demo.')+'\n\nReturn USD tidak otomatis mengalahkan IDR; nilai IDR berubah bersama kurs. Periksa kurs transaksi dan suitability.';
    }
    if(/rebalanc|alokasi|imbang|saa|optimasi/.test(q)){
      const r=recommend(client,data,core,reservations),picks=r.groups.flatMap(g=>g.products).slice(0,4);
      return intro+'Target SAA otomatis:\n'+positionsText+'\n\n'+marketText+'\n'+currencyText+'\n\nProduk contoh: '+(picks.map(p=>`${p.name} ${core.money(p.amount)} — ${p.entryMode}; ${p.reason}`).join('\n')||'Belum ada kandidat pembelian. Tinjau pengurangan posisi dan kebutuhan likuiditas.')+'\n\nCentang “Optimasi sendiri” di Rebalancing bila ingin mengubah target; simulasi tidak mengeksekusi transaksi.';
    }
    if(/kas|casa|cash|depo|likuid/.test(q))return intro+currencyText+`\nKebutuhan likuiditas tercatat ${core.money(plan.liquidity)}. Pisahkan kas yang dapat dipakai segera dari deposito dan reksa dana yang mempunyai ketentuan pencairan.\n\n`+positionsText;
    if(/kuota|stok|tersedia/.test(q))return intro+'Sisa kuota nominal seri pada browser ini:\n'+data.bonds.map(p=>`${p.name}: ${core.localMoney(core.quota(p,reservations),p.currency)} (${core.quotaStatus(p,reservations).label})`).join('\n')+'\nHarga dan kuota hanyalah snapshot contoh.';
    if(/produk|harian|rekomendasi|pilihan/.test(q)){const picks=daily(client,data,core,reservations,date);return intro+marketText+'\n\nPilihan untuk diskusi:\n'+(picks.map(p=>`${p.name} (${p.currency}) — ${p.reason}`).join('\n')||'Belum ada kandidat yang lolos penyaringan.')+'\nBuka Daily Market atau Rebalancing untuk alasan dan risiko rinci.';}
    if(/risiko|tujuan/.test(q))return intro+`Tujuan: ${client.goal}. Horizon: ${client.horizon}.\n`+positionsText+'\n\n'+view.caution;
    if(/ringkas|portofolio|nasabah/.test(q))return intro+positionsText+'\n\n'+currencyText+`\nTujuan: ${client.goal}. Tinjauan: ${core.date(client.review)}.`;
    return intro+'Saya dapat membahas target SAA, produk dan kuota SBN termasuk INDON/INDOIS, kas/deposito IDR/USD, alasan sinyal kurs, timing bertahap, serta risiko. Coba tanyakan “Mengapa USD dipertimbangkan untuk nasabah ini?” atau “Rebalancing sesuai SAA”. Respons ini berbasis aturan demo.';
  }
  const api={buckets,models,riskRank,weights,positions,marketView,rebalance,recommend,explain,daily,reply};
  root.CindyAdvisory=api;if(typeof module!=='undefined'&&module.exports)module.exports=api;
})(typeof window!=='undefined'?window:globalThis);
