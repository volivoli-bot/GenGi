// QA v4.2 Zona Helada (diseno-v4 §4): enemigos de la nieve (Congelado, Lobo mutado, Escarcha) y La Matriarca.
// node qa/v42.mjs [url]
import puppeteer from 'puppeteer-core';
const BASE=process.argv[2]||process.env.GENGI_BASE||'http://localhost:4178/';
const URL=BASE+'?debug=1';
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
const res=[]; const ok=(n,c,i='')=>{res.push(`${c?'PASS':'FAIL'} ${n} ${i}`);console.log(`${c?'PASS':'FAIL'} ${n} ${i}`);};
const b=await puppeteer.launch({executablePath:'/usr/bin/google-chrome',headless:'new',args:['--no-sandbox','--use-gl=swiftshader','--enable-unsafe-swiftshader','--window-size=390,844']});
const errs=[];
const ctx=await b.createBrowserContext(); const p=await ctx.newPage();
await p.setViewport({width:390,height:844,isMobile:true,hasTouch:true});
p.on('pageerror',e=>errs.push(e.message)); p.on('console',m=>{if(m.type()==='error')errs.push(m.text())});
await p.goto(URL); await p.waitForFunction(()=>window.gengi,{timeout:20000});
await p.evaluate(()=>gengi.reset()).catch(()=>{}); await sleep(900); await p.waitForFunction(()=>window.gengi,{timeout:20000});
const E=(f,...a)=>p.evaluate(f,...a);
const setup=`
window.T=48;
window.__calm=()=>{const s=gengi.raid();gengi.god(true);gengi.clearEnemies();s.snap.stream=null;s.snap.spawnTimer=-1e9;gengi.move(0,0);gengi.aim(null);gengi.cfg31.ELITE.chance=0;s.snap.xp=0;s.snap.xpBy={};
  if(!window.__hooked||window.__hookedScene!==s){window.__hooked=true;window.__hookedScene=s;s.events.on('update',()=>{s.idleT=0;s.snap.spawnTimer=Math.min(s.snap.spawnTimer,-1e6);});}};
window.__gt=()=>gengi.raid().snap.elapsed;
window.__waitGame=sec=>new Promise(r=>{const t0=__gt();const f=()=>{if(__gt()-t0>=sec)r();else setTimeout(f,20)};f();});
window.__tp=(x,y)=>{const s=gengi.raid();s.player.setPosition(x,y);s.vel.set(0,0);s.player.body.reset(x,y);};
window.__snowPt=()=>{const s=gengi.raid();const L=s.map.snow.lair;for(let i=0;i<400;i++){const x=L.cx+(Math.random()-0.5)*L.w*0.8,y=L.cy+(Math.random()-0.5)*L.h*0.8;if(s.snowy(x,y)&&!s.openSpot)return {x,y};if(s.snowy(x,y))return {x,y};}return null;};
window.__boss=()=>{const s=gengi.raid();const L=s.map.snow.lair;const e=s.spawnAt('matriarca',L.cx,L.cy,undefined,false);e.gx=L.cx;e.gy=L.cy;e.lair=true;return e;};
`;
async function endRaid(){ await E(()=>{const s=gengi.raid();if(s&&!s.ended)s.host.endRaid('extraido',{exit:s.snap.exits[0]});}); await sleep(500); await E(()=>document.querySelectorAll('.overlay button, .card button').forEach(b=>{if(/Volver|Continuar|Refugio/i.test(b.textContent))b.click();})); await sleep(300); }
async function newRaid(seed=null){ await endRaid(); await E(sd=>{gengi.seedNext(sd);gengi.start();},seed); await sleep(1600); await p.waitForFunction(()=>gengi.raid()&&gengi.raid().hud,{timeout:20000}); await E(setup); }

await newRaid(4242);
await E(()=>{const s=gengi.raid();gengi.god(true);s.snap.stream=null;s.snap.spawnTimer=-1e9;gengi.cfg31.ELITE.chance=0;
  // sin cadáveres en pantalla: los enemigos iniciales se quitan sin matarlos
  for(const e of [...s.enemies.list]){if(e.def.type!=="matriarca")s.enemies.despawn(e);}
  s.events.on('update',()=>{s.idleT=0;s.snap.spawnTimer=Math.min(s.snap.spawnTimer,-1e6);});});
await E(async()=>{const s=gengi.raid();const L=s.map.snow.lair;
  const free=(x,y)=>s.snowy(x,y)&&!s.walls.some(r=>x>r.x-40&&x<r.x+r.w+40&&y>r.y-40&&y<r.y+r.h+40)&&s.snowR.plateAt(x,y)<0;
  let pt=null;for(let i=0;i<6000&&!pt;i++){const x=L.cx+(Math.random()-0.5)*T*50,y=L.cy+(Math.random()-0.5)*T*50;if(Math.hypot(x-L.cx,y-L.cy)<T*16)continue;
    let okk=true;for(let dx=-3;dx<=3&&okk;dx++)for(let dy=-6;dy<=1&&okk;dy++)if(!free(x+dx*T,y+dy*T))okk=false;if(okk)pt={x,y};}
  __tp(pt.x,pt.y);s.facing=-Math.PI/2;s.viewFacing=-Math.PI/2;
  // huellas detrás del jugador
  gengi.move(0,-1);await __waitGame(0.7);gengi.move(0,0);await __waitGame(0.5);const p=s.player;
  s.spawnAt('errante',p.x-T*2.2,p.y-T*2.6,undefined,false);s.spawnAt('escupidor',p.x+T*2.2,p.y-T*2.6,undefined,false);s.spawnAt('corredor',p.x,p.y-T*4.2,undefined,false);
  for(const e of s.enemies.list){if(e.def.type==='matriarca')continue;e.state='idle';e.facing=Math.PI/2;}
  window.__shotT=0;await __waitGame(0.15);});
await sleep(150);await p.screenshot({path:'/workspace/gengi/shots/v4_2-nieve-enemigos.png'});
console.log(JSON.stringify(await E(()=>gengi.raid().enemies.list.filter(e=>e.def.type!=='matriarca').map(e=>e.def.type))));
// ventisca
await E(async()=>{const s=gengi.raid();s.snowR.ventLeft=0;s.snowR.ventT=0.05;await __waitGame(1.5);});
await sleep(150);await p.screenshot({path:'/workspace/gengi/shots/v4b-ventisca.png'});
// placa de hielo
await E(async()=>{const s=gengi.raid();s.snowR.ventLeft=0.01;await __waitGame(0.3);for(const e of [...s.enemies.list])if(e.def.type!=='matriarca')s.enemies.despawn(e);
  const pl=s.snowR.plates[0];__tp(pl.x-pl.w/2-60,pl.y);gengi.move(1,0);await __waitGame(0.5);gengi.move(0,0);await __waitGame(0.2);});
await sleep(150);await p.screenshot({path:'/workspace/gengi/shots/v4b-placa-hielo.png'});
await b.close();
