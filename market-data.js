/* Fictional RPM briefing and market observations for the CINDY interactive demo. */
(function(){
 'use strict';
 const asOf='2026-10-07',previousDate='2026-10-06',updated='2026-10-07T09:00:00+07:00',source='Simulasi CINDY · RPM demo';
 const dates=[];let cursor=new Date(asOf+'T00:00:00Z');while(dates.length<91){if(cursor.getUTCDay()!==0&&cursor.getUTCDay()!==6)dates.unshift(cursor.toISOString().slice(0,10));cursor.setUTCDate(cursor.getUTCDate()-1);}
 window.CINDY_DATA.bonds.forEach((b,k)=>{
  const n=dates.length-1,amplitude=[.2,.48,.025,.15,.12,.22,.18][k],trend=[.008,.014,.0004,.006,.004,.003,.002][k];
  b.priceHistory=dates.map((date,i)=>({date,price:Number((b.price+(i-n)*trend+amplitude*(Math.sin(i*.67+k)-Math.sin(n*.67+k))+.4*amplitude*(Math.cos(i*.29)-Math.cos(n*.29))).toFixed(4))}));
  b.priceHistory[n-1].price=b.previousPrice;b.priceHistory[n].price=b.price;
 });
 const ust=[['2Y',3.91,3.88],['5Y',4.03,4.00],['10Y',4.18,4.14],['30Y',4.69,4.65]].map(([tenor,yieldValue,previous])=>({tenor,yield:yieldValue,previous,source,updated}));
 const sbn=[['1Y',5.52,5.50],['2Y',5.66,5.64],['3Y',5.82,5.79],['5Y',6.08,6.04],['10Y',6.43,6.38],['15Y',6.65,6.60],['20Y',6.78,6.73]].map(([tenor,yieldValue,previous])=>({tenor,yield:yieldValue,previous,source,updated}));
 const oil=[{name:'Brent',value:76.4,previous:75.65,unit:'USD/barel'},{name:'WTI',value:72.85,previous:72.2,unit:'USD/barel'}].map(x=>({...x,source,updated}));
 const indices=[['S&P 500',5740,5775,'AS'],['Nasdaq',18150,18310,'AS'],['STOXX 600',510,511.8,'Eropa'],['Nikkei 225',38600,38900,'Jepang'],['Hang Seng',21200,21350,'Hong Kong'],['IHSG',7310,7340,'Indonesia']].map(([name,value,previous,region])=>({name,value,previous,region,source,updated}));
 // Rates are illustrative units of currency per 1 USD, never executable bank quotes.
 const quoteData=[['USD',1,1,'Amerika'],['IDR',15750,15710,'Asia Pasifik'],['EUR',.925,.921,'Eropa'],['GBP',.777,.773,'Eropa'],['JPY',149.2,148.8,'Asia Pasifik'],['CHF',.858,.857,'Eropa'],['CAD',1.365,1.361,'Amerika'],['AUD',1.49,1.482,'Asia Pasifik'],['NZD',1.64,1.628,'Asia Pasifik'],['SGD',1.305,1.302,'Asia Pasifik'],['MYR',4.32,4.31,'Asia Pasifik'],['CNY',7.12,7.10,'Asia Pasifik'],['HKD',7.78,7.779,'Asia Pasifik'],['KRW',1345,1339,'Asia Pasifik'],['THB',33.5,33.39,'Asia Pasifik'],['TWD',32.1,32.01,'Asia Pasifik'],['INR',83.95,83.9,'Asia Pasifik'],['PHP',56.5,56.39,'Asia Pasifik'],['VND',24750,24710,'Asia Pasifik'],['AED',3.6725,3.6725,'Timur Tengah'],['SAR',3.75,3.75,'Timur Tengah'],['QAR',3.64,3.64,'Timur Tengah'],['KWD',.3065,.3064,'Timur Tengah'],['BHD',.376,.376,'Timur Tengah'],['OMR',.3845,.3845,'Timur Tengah'],['ILS',3.78,3.76,'Timur Tengah'],['TRY',34.3,34.2,'Eropa'],['PLN',3.98,3.96,'Eropa'],['CZK',23.35,23.26,'Eropa'],['HUF',370.4,368.8,'Eropa'],['SEK',10.45,10.4,'Eropa'],['NOK',10.7,10.66,'Eropa'],['DKK',6.90,6.87,'Eropa'],['RON',4.6,4.58,'Eropa'],['ISK',137.5,137.2,'Eropa'],['ZAR',17.7,17.6,'Afrika'],['EGP',48.6,48.5,'Afrika'],['NGN',1600,1595,'Afrika'],['KES',129,128.8,'Afrika'],['MAD',9.82,9.8,'Afrika'],['GHS',15.5,15.4,'Afrika'],['TZS',2710,2705,'Afrika'],['UGX',3670,3660,'Afrika'],['BRL',5.45,5.40,'Amerika'],['MXN',19.4,19.3,'Amerika'],['CLP',929,925,'Amerika'],['COP',4180,4160,'Amerika'],['PEN',3.77,3.76,'Amerika'],['ARS',975,973,'Amerika'],['UYU',41.2,41.1,'Amerika'],['CRC',516,515,'Amerika'],['DOP',60.1,60,'Amerika'],['JMD',157,156.8,'Amerika'],['BDT',119.5,119.3,'Asia Pasifik'],['PKR',278,277.8,'Asia Pasifik'],['LKR',295,294.5,'Asia Pasifik'],['NPR',134.3,134.24,'Asia Pasifik'],['BND',1.305,1.302,'Asia Pasifik'],['MOP',8.01,8.008,'Asia Pasifik'],['KHR',4070,4065,'Asia Pasifik'],['LAK',22000,21980,'Asia Pasifik'],['MNT',3450,3440,'Asia Pasifik'],['FJD',2.24,2.23,'Asia Pasifik'],['PGK',3.96,3.955,'Asia Pasifik']];
 const display=new Intl.DisplayNames(['id'],{type:'currency'}),quotes=new Map(quoteData.map(([code,perUsd,previous,region])=>[code,{code,perUsd,previous,region,source,updated}]));
 const supported=typeof Intl.supportedValuesOf==='function'?Intl.supportedValuesOf('currency'):quoteData.map(x=>x[0]);
 const currencies=[...new Set([...supported,...quotes.keys()])].sort().map(code=>({code,name:display.of(code)||code,region:'Lainnya',perUsd:null,previous:null,...(quotes.get(code)||{}),source,updated}));
 window.CINDY_DATA.fxUSDIDR=quotes.get('IDR').perUsd;
 window.CINDY_DATA.fxUpdated=updated;
 // Entire annual path is illustrative. Completed-year changes (2022–2025) drive the historical average.
 const fxAnnual=[{year:2021,rate:14250},{year:2022,rate:15575},{year:2023,rate:15400},{year:2024,rate:16180},{year:2025,rate:15390},{year:2026,rate:15750,partial:true}];
 const fx3m=15420,fx1y=15200,fxNow=quotes.get('IDR').perUsd,fxPrevious=quotes.get('IDR').previous;
 const fxGrowth=(a,b)=>(b/a-1)*100;
 const completed=fxAnnual.filter(p=>!p.partial),yearly=completed.slice(1).map((p,i)=>({...p,change:fxGrowth(completed[i].rate,p.rate)}));
 const fxAverage=yearly.reduce((s,p)=>s+p.change,0)/yearly.length;
 const usdSignal={label:fxNow>fxPrevious&&fxNow>fx3m?'USD menguat · sinyal jangka pendek':'Netral · tinjau ulang',bullish:fxNow>fxPrevious&&fxNow>fx3m,change1d:fxGrowth(fxPrevious,fxNow),change3m:fxGrowth(fx3m,fxNow),change1y:fxGrowth(fx1y,fxNow),fx3m,fx1y,averageAnnual:fxAverage,method:'Rata-rata aritmetis perubahan kurs penutupan tahunan simulasi 2022–2025; 2026 belum setahun penuh.'};
 window.CINDY_DATA.marketContext={usdSignal,fxAnnual,ust10:ust.find(x=>x.tenor==='10Y'),sbn10:sbn.find(x=>x.tenor==='10Y'),source,asOf};
 const briefing=[
  {region:'AS · suku bunga',title:'Skenario demo: yield UST bergerak naik',summary:'Yield UST 10Y pada contoh naik 4 bp. Tinjau sensitivitas harga SBN terhadap perubahan yield global.',implication:'Durasi panjang membutuhkan toleransi fluktuasi yang lebih besar; cek horizon dan rencana pencairan.',risk:'Jika yield kembali turun, arah pergerakan harga dapat berbalik.'},
  {region:'Indonesia · rupiah',title:'Skenario demo: USD/IDR lebih tinggi',summary:'Kurs contoh meningkat dari Rp15.710 ke Rp15.750 per USD. Ini menggambarkan pelemahan rupiah terhadap USD pada snapshot simulasi.',implication:'Konfirmasi kebutuhan valas nasabah. Jangan memakai kurs indikatif untuk menentukan nilai transaksi bank.',risk:'Arah rupiah dipengaruhi banyak faktor; tabel ini bukan proyeksi kurs.'},
  {region:'Global · energi',title:'Skenario demo: minyak dan risiko inflasi',summary:'Harga Brent dan WTI dalam contoh meningkat. Tema briefing: kemungkinan tekanan biaya energi dalam skenario kenaikan harga minyak.',implication:'Pantau asumsi inflasi dan suku bunga saat meninjau strategi SBN serta reksa dana.',risk:'Hubungan minyak dan inflasi tidak selalu satu arah; perlu konteks ekonomi dan kurs.'},
  {region:'Global · ekuitas',title:'Skenario demo: indeks saham melemah',summary:'Indeks dalam snapshot contoh menunjukkan penurunan. Fokus diskusi adalah kemampuan nasabah menghadapi fluktuasi aset campuran dan saham.',implication:'Tinjau diversifikasi dan tujuan investasi sebelum mengubah alokasi nasabah.',risk:'Penurunan harian bukan bukti bahwa tren jangka panjang telah berubah.'}
 ];
 window.CINDY_MARKET={asOf,previousDate,updated,source,editor:'RPM · briefing contoh',ust,sbn,oil,indices,currencies,briefing,fxAnnual,usdSignal};
})();
