// Capturas v3.2 (rendimiento): contador de fps con el mínimo 12-15, memoria de visión fundida, topes. 390×844.
// node qa/shots_v3_2.mjs [dir]
import puppeteer from 'puppeteer-core';
const dir=process.argv[2]||'/workspace/gengi/shots';
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
const b=await puppeteer.launch({executablePath:'/usr/bin/google-chrome',headless:'new',args:['--no-sandbox','--use-gl=swiftshader','--enable-unsafe-swiftshader']});
const p=await b.newPage(); await p.setViewport({width:390,height:844,isMobile:true,hasTouch:true,deviceScaleFactor:1});
const errs=[]; p.on('pageerror',e=>errs.push(e.message));
await p.goto('http://localhost:4173/?debug=1&noelite'); await p.waitForFunction(()=>window.gengi);
await p.evaluate(()=>gengi.reset()).catch(()=>{}); await sleep(700); await p.waitForFunction(()=>window.gengi);
const E=(f,...a)=>p.evaluate(f,...a);
const shot=async n=>{await p.screenshot({path:`${dir}/${n}.png`});console.log('ok',n);};
const waitFor=(fn,ms=8000)=>p.waitForFunction(fn,{timeout:ms,polling:20}).catch(()=>console.log('timeout',fn.toString().slice(0,60)));
async function raid(){
  await E(()=>{const s=gengi.raid();if(s&&!s.ended)s.host.endRaid('extraido',{exit:s.snap.exits[0]});}); await sleep(500);
  await E(()=>document.querySelectorAll('button').forEach(b=>{if(/Volver al refugio/.test(b.textContent))b.click();})); await sleep(300);
  await E(()=>gengi.start()); await sleep(2000); await p.waitForFunction(()=>gengi.raid()&&gengi.raid().hud);
  await E(()=>{const s=gengi.raid();gengi.god(true);gengi.clearEnemies();s.snap.stream=null;s.snap.spawnTimer=-1e9;
    window.__pins=new Map();s.events.on('update',()=>{s.idleT=0;s.snap.spawnTimer=Math.min(s.snap.spawnTimer,-1e6);for(const [e,pos] of window.__pins){if(!e.dead&&e.body)e.body.reset(pos.x,pos.y);}});});
}
const calm=()=>E(()=>{const s=gengi.raid();window.__pins.clear();gengi.clearEnemies();gengi.move(0,0);gengi.aim(null);s.hud.toast('',0.01);s.fx.corpses.forEach(c=>c.destroy());s.fx.corpses.length=0;});
const arm=(id,ammo,n=20)=>E(([id,ammo,n])=>{const s=gengi.raid();gengi.give(id,'comun',1);if(ammo)gengi.give(ammo,'comun',n);const it=s.snap.loadout.mochila.find(i=>i.def===id);s.invEquip(it.uid);},[id,ammo,n]);
const spot=r=>E(r=>{const s=gengi.raid();let o=null;for(let k=r;k>=2&&!o;k--)o=s.openSpot(k);s.player.setPosition(o.x,o.y);s.player.body.reset(o.x,o.y);s.vel.set(0,0);return o;},r);
await raid();
// ---- memoria de visión con fantasmas (tope 8) a mitad de giro ----
{await calm();await spot(9);await arm('machete');
 await E(()=>{const s=gengi.raid(),T=48;s.facing=-Math.PI/2;s.viewFacing=-Math.PI/2;
   for(let i=0;i<12;i++){const a=-Math.PI/2-0.9+1.8*i/11;const e=s.spawnAt('errante',s.player.x+Math.cos(a)*(3+i%3)*T,s.player.y+Math.sin(a)*(3+i%3)*T,undefined,false);e.state='idle';e.turnT=1e9;window.__pins.set(e,{x:e.x,y:e.y});}});
 await sleep(900);
 await E(()=>{const s=gengi.raid();s.facing=Math.PI/2;s.viewFacing=Math.PI/2;});await sleep(200);
 const g=await E(()=>gengi.raid().enemies.ghostsNow);console.log('fantasmas',g);
 await shot('v3_2-memoria-fantasmas');}
// ---- contador de fps (también sin ?debug) en el minuto 12+ con hordas ----
await p.goto('http://localhost:4173/?debug=0'); await sleep(800);
await p.evaluate(()=>{localStorage.setItem('gengi.debug','1');}); // la API de depuración hace falta para preparar la escena
await p.goto('http://localhost:4173/?noelite'); await p.waitForFunction(()=>window.gengi);
await raid(); await calm(); await spot(8);
await E(()=>{const s=gengi.raid();s.debug=false;s.hud.fps.setVisible(gengi.cfg32.PERF.showFps);gengi.minute(12.5);window.__pins.clear();s.snap.spawnTimer=0;gengi.spawn('errante',10);gengi.spawn('corredor',4);});
await sleep(6000);
await shot('v3_2-contador-fps');
console.log('texto',await E(()=>gengi.raid().hud.fps.text));
console.log('errores',errs);
await b.close();
