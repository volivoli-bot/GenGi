// v3.2: banco de pruebas determinista del minuto 12. Math.random sembrado + bucle del juego parado y avanzado a mano
// con dt fijo (16,7 ms, como un móvil a 60 Hz): todas las versiones simulan exactamente lo mismo y se mide el coste
// real de cada fotograma (update + render + gl.finish para incluir el rasterizado).
// uso: node bench12.mjs <url-base> <etiqueta> [frames=600] [arco=0|1] [knob-js]
import puppeteer from 'puppeteer-core';
const [,, base='http://localhost:4173/', label='x', framesArg='600', bow='0', knob=''] = process.argv;
const FR=+framesArg;
const b=await puppeteer.launch({executablePath:'/usr/bin/google-chrome',headless:'new',protocolTimeout:600000,args:['--no-sandbox','--use-gl=swiftshader','--enable-unsafe-swiftshader']});
const p=await b.newPage(); await p.setViewport({width:390,height:844,isMobile:true,hasTouch:true});
const errs=[]; p.on('pageerror',e=>errs.push(e.message));
await p.evaluateOnNewDocument(()=>{let a=1234;Math.random=()=>{a|=0;a=a+0x6D2B79F5|0;let t=Math.imul(a^a>>>15,1|a);t=t+Math.imul(t^t>>>7,61|t)^t;return((t^t>>>14)>>>0)/4294967296;};});
await p.goto(base+'?debug=1&noelite'); await p.waitForFunction(()=>window.gengi);
await p.evaluate(()=>localStorage.clear()); await p.reload(); await p.waitForFunction(()=>window.gengi);
if(knob) await p.evaluate(knob);
await p.evaluate(()=>gengi.start());
await p.waitForFunction(()=>{const s=gengi.raid();return s&&s.snap&&s.enemies;},{polling:'raf'});
const r=await p.evaluate(async({FR,bow})=>{
  const s=gengi.raid(), g=s.game; g.loop.sleep();
  const gl=g.renderer.gl; let t=g.loop.now||performance.now(); const DT=1000/60;
  const step=()=>{t+=DT;g.step(t,DT);};
  for(let i=0;i<30;i++) step();
  gengi.god(true);
  if(bow==='1'){const lo=s.snap.loadout;lo.arma={uid:'pf-arco',def:'arco',rarity:'comun',qty:1};lo.mochila=lo.mochila.filter(i=>i.def!=='flechas');lo.mochila.push({uid:'pf-fl',def:'flechas',rarity:'comun',qty:999});s.host.refreshInventory();s.swapT=0;s.applyLoadout?.();}
  gengi.minute(12);gengi.spawn('hinchado',4);gengi.spawn('corredor',8);gengi.spawn('abominacion',1);
  for(let i=0;i<180;i++) step(); // 3 s de calentamiento (llegan las hordas)
  const ms=[]; const upd=[];
  for(let i=0;i<FR;i++){const a=performance.now();step();const b2=performance.now();gl.finish();const c=performance.now();ms.push(c-a);upd.push(b2-a);if(i%60===59) await new Promise(r=>setTimeout(r,0));}
  const st={en:s.enemies.list.length,objs:s.children.list.length,tweens:s.tweens.getTweens?.().length,ghostFrames:s.enemies.ghostFrames,ghostsMax:s.enemies.ghostsMax??null,lingerRedraws:s.vision?.lingerStats?.redraws,lingerSamples:s.vision?.lingerStats?.samples,arrows:s.groundArrows?.length,stains:s.fx?.stains?.length,kills:s.snap.kills,hp:s.snap.player.hp,elapsed:+s.snap.elapsed.toFixed(1)};
  return {ms,upd,st};
},{FR,bow});
const q=(a,f)=>{const s=[...a].sort((x,y)=>x-y);return s[Math.min(s.length-1,Math.floor(s.length*f))];};
const avg=a=>a.reduce((x,y)=>x+y,0)/a.length;
console.log(JSON.stringify({label,bow,frames:FR,msMed:+q(r.ms,0.5).toFixed(1),msAvg:+avg(r.ms).toFixed(1),msP95:+q(r.ms,0.95).toFixed(1),fpsEq:+(1000/avg(r.ms)).toFixed(1),updMed:+q(r.upd,0.5).toFixed(1),...r.st,errs}));
await b.close();
