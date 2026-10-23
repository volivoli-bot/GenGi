// v3.2: estrés del minuto 12 con semilla fija (Math.random sembrado) para comparar versiones.
// uso: node perf12.mjs <url-base> <etiqueta> [arco=0|1] [perfil=0|1] [elites=0|1] [seed=1234]
import puppeteer from 'puppeteer-core';
import fs from 'fs';
const [,, base='http://localhost:4173/', label='x', bow='0', prof='0', elites='0', seed='1234', knob=''] = process.argv;
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
const b=await puppeteer.launch({executablePath:'/usr/bin/google-chrome',headless:'new',args:['--no-sandbox','--use-gl=swiftshader','--enable-unsafe-swiftshader']});
const p=await b.newPage(); await p.setViewport({width:390,height:844,isMobile:true,hasTouch:true});
const errs=[]; p.on('pageerror',e=>errs.push(e.message));
await p.evaluateOnNewDocument((sd)=>{let a=sd>>>0;Math.random=()=>{a|=0;a=a+0x6D2B79F5|0;let t=Math.imul(a^a>>>15,1|a);t=t+Math.imul(t^t>>>7,61|t)^t;return((t^t>>>14)>>>0)/4294967296;};
  // tiempos de fotograma reales (rAF)
  window.__ft=[];let last=0;const f=(t)=>{if(last)window.__ft.push(t-last);last=t;if(window.__ft.length>20000)window.__ft.shift();requestAnimationFrame(f);};requestAnimationFrame(f);}, +seed);
await p.goto(base+'?debug=1'+(elites==='1'?'':'&noelite')); await p.waitForFunction(()=>window.gengi);
await p.evaluate(()=>{localStorage.clear();}); await p.reload(); await p.waitForFunction(()=>window.gengi);
const E=(f,...a)=>p.evaluate(f,...a);
if(knob) await p.evaluate(knob); await E(()=>gengi.start()); await sleep(1500);
await E((bow)=>{const s=gengi.raid();gengi.god(true);
  if(bow==='1'){const lo=s.snap.loadout;lo.arma={uid:'pf-arco',def:'arco',rarity:'comun',qty:1};lo.mochila=lo.mochila.filter(i=>i.def!=='flechas');lo.mochila.push({uid:'pf-fl',def:'flechas',rarity:'comun',qty:999});s.host.refreshInventory();s.swapT=0;s.applyLoadout?.();}
  gengi.minute(12);gengi.spawn('hinchado',4);gengi.spawn('corredor',8);gengi.spawn('abominacion',1);},bow);
await sleep(3000);
let cdp=null; if(prof==='1'){cdp=await p.createCDPSession();await cdp.send('Profiler.enable');await cdp.send('Profiler.setSamplingInterval',{interval:500});await cdp.send('Profiler.start');}
await E(()=>{window.__ft.length=0;const g=gengi.raid().game;if(!g.__wrapped){g.__wrapped=1;const o=g.loop.callback;window.__stp=[];g.loop.callback=(t,d)=>{const a=performance.now();o(t,d);window.__stp.push(performance.now()-a);};}window.__stp.length=0;window.__lp0=gengi.raid().vision?.lingerStats?.polys??null;});
const samples=[];
for(let i=0;i<20;i++){await sleep(1000);samples.push(await E(()=>{const s=gengi.raid();return {fps:Math.round(s.game.loop.actualFps),en:s.enemies.list.length,objs:s.children.list.length,tw:s.tweens.getTweens?.().length??-1,arrows:s.groundArrows?.length??0}}));}
const ft=await E(()=>window.__ft.slice()); const stp=await E(()=>window.__stp.slice());
let profile=null; if(cdp){profile=(await cdp.send('Profiler.stop')).profile;}
const extra=await E(()=>{const s=gengi.raid();const lp=s.vision?.lingerStats?.polys;return {stains:s.fx?.stains?.length,nums:s.fx?.nums?.length,ghostsMax:s.enemies.ghostsMax??null,maskPolys:lp!=null&&window.__lp0!=null?lp-window.__lp0:null,lingerSamples:s.vision?.lingerStats?.samples};});
const fps=samples.map(s=>s.fps);const avg=fps.reduce((a,b)=>a+b,0)/fps.length;
const ftAvg=ft.reduce((a,b)=>a+b,0)/ft.length; const sorted=[...ft].sort((a,b)=>a-b); const p95=sorted[Math.floor(sorted.length*0.95)];
const res={label,bow,elites,seed,fpsMin:Math.min(...fps),fpsAvg:+avg.toFixed(1),fpsLast:fps.at(-1),realFps:+(1000/ftAvg).toFixed(1),p95ms:+p95.toFixed(1),stepMed:+[...stp].sort((a,b)=>a-b)[Math.floor(stp.length/2)]?.toFixed(1),stepAvg:+(stp.reduce((a,b)=>a+b,0)/stp.length).toFixed(1),frames:ft.length,en:samples.at(-1).en,objs:samples.at(-1).objs,tweens:samples.at(-1).tw,arrows:samples.at(-1).arrows,extra,errs};
console.log(JSON.stringify(res));
if(profile){
  const self=new Map();const byId=new Map(profile.nodes.map(n=>[n.id,n]));const dt=profile.timeDeltas;const cnt=new Map();
  profile.samples.forEach((id,i)=>cnt.set(id,(cnt.get(id)||0)+(dt[i]||0)));
  for(const [id,t] of cnt){const n=byId.get(id);const cf=n.callFrame;const k=`${cf.functionName||'(anon)'} ${cf.url.split('/').pop()}:${cf.lineNumber}:${cf.columnNumber}`;self.set(k,(self.get(k)||0)+t);}
  const tot=[...self.values()].reduce((a,b)=>a+b,0);
  const top=[...self.entries()].sort((a,b)=>b[1]-a[1]).slice(0,40).map(([k,t])=>`${(t/tot*100).toFixed(1)}% ${k}`);
  fs.writeFileSync(`prof_${label}.txt`,top.join('\n'));fs.writeFileSync(`prof_${label}.cpuprofile`,JSON.stringify(profile));
}
await b.close();
