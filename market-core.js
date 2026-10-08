/* Pure comparison and FX calculations. All supplied observations in this build are fictional. */
(function(root){
 'use strict';
 function series(product,type,period){const h=type==='bond'?product.priceHistory:product.history;return (h||[]).slice(-period-1).map(p=>({date:p.date,value:type==='bond'?p.price:p.nav}));}
 function stats(points,annualPeriods=252){
  if(points.length<2||points.some(p=>!Number.isFinite(p.value)||p.value<=0))return {return:null,volatility:null,drawdown:null,observations:points.length};
  const returns=points.slice(1).map((p,i)=>p.value/points[i].value-1),mean=returns.reduce((s,r)=>s+r,0)/returns.length;
  const variance=returns.length>1?returns.reduce((s,r)=>s+(r-mean)**2,0)/(returns.length-1):null;
  let peak=points[0].value,drawdown=0;points.forEach(p=>{peak=Math.max(peak,p.value);drawdown=Math.min(drawdown,(p.value/peak-1)*100);});
  return {return:(points.at(-1).value/points[0].value-1)*100,volatility:variance===null?null:Math.sqrt(variance*annualPeriods)*100,drawdown,observations:points.length};
 }
 function chartSeries(product,type,period,mode){
  const points=series(product,type,period);if(!points.length)return [];
  if(mode==='daily')return points.slice(1).map((p,i)=>({date:p.date,value:(p.value/points[i].value-1)*100}));
  if(mode==='volatility')return points.map((p,i)=>({date:p.date,value:i<10?null:stats(points.slice(i-10,i+1),252).volatility})).filter(p=>p.value!==null);
  return points.map(p=>({date:p.date,value:mode==='price'||mode==='index'?p.value/points[0].value*100:(p.value/points[0].value-1)*100}));
 }
 function aligned(products,type,period){const seriesByProduct=products.map(p=>series(p,type,period));const dates=seriesByProduct[0]?.map(p=>p.date)||[];return seriesByProduct.every(h=>h.length===dates.length&&h.every((p,i)=>p.date===dates[i]));}
 function convertFx(amount,from,to,previous=false){const f=previous?from?.previous:from?.perUsd,t=previous?to?.previous:to?.perUsd;return Number.isFinite(amount)&&amount>=0&&Number.isFinite(f)&&f>0&&Number.isFinite(t)&&t>0?amount/f*t:null;}
 function fxChange(from,to){const now=convertFx(1,from,to),prev=convertFx(1,from,to,true);return now===null||prev===null?null:(now/prev-1)*100;}
 const api={series,stats,chartSeries,aligned,convertFx,fxChange};root.CindyMarketCore=api;if(typeof module!=='undefined'&&module.exports)module.exports=api;
})(typeof window!=='undefined'?window:globalThis);
