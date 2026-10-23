// QA v4c: ventisca y huellas en el guardado, inicio/salidas por la definición del mapa, mapa sin nieve, cinta «Zona superada».
// node qa/v4c.mjs [url]
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
window.__snowK=0;window.__snowPt=()=>{const s=gengi.raid();const L=s.map.snow.lair;const pts=[];const st=T/2;for(let x=L.cx-L.w*0.4;x<=L.cx+L.w*0.4;x+=st)for(let y=L.cy-L.h*0.4;y<=L.cy+L.h*0.4;y+=st){if(!s.snowy(x,y))continue;if(s.walls.some(w=>x>w.x-20&&x<w.x+w.w+20&&y>w.y-20&&y<w.y+w.h+20))continue;pts.push({x,y});}if(!pts.length)return {x:L.cx,y:L.cy};return pts[(window.__snowK++*7919)%pts.length];};
window.__boss=()=>{const s=gengi.raid();const L=s.map.snow.lair;const e=s.spawnAt('matriarca',L.cx,L.cy,undefined,false);e.gx=L.cx;e.gy=L.cy;e.lair=true;return e;};
`;
async function endRaid(){ await E(()=>{const s=gengi.raid();if(s&&!s.ended)s.host.endRaid('extraido',{exit:s.snap.exits[0]});}); await sleep(500); await E(()=>document.querySelectorAll('.overlay button, .card button').forEach(b=>{if(/Volver|Continuar|Refugio/i.test(b.textContent))b.click();})); await sleep(300); }
async function newRaid(seed=null){ await endRaid(); await E(sd=>{gengi.seedNext(sd);gengi.start();},seed); await sleep(1600); await p.waitForFunction(()=>gengi.raid()&&gengi.raid().hud,{timeout:20000}); await E(setup); }
const LV=()=>E(()=>gengi.lv().prog());
async function waitRaid(){ for(let i=0;i<80;i++){await sleep(250);if(await E(()=>!!(window.gengi&&gengi.raid()&&gengi.raid().snap&&gengi.raid().snowR)).catch(()=>false))return true;} return false; }

// ---------- K1-K2: la ventisca y las huellas sobreviven a cerrar la app ----------
await newRaid(4242);
const before=await E(async()=>{const s=gengi.raid();__calm();const S=s.snowR;const pt=__snowPt();__tp(pt.x,pt.y);
  gengi.move(0,1);await __waitGame(1.0);gengi.move(0,0);await __waitGame(0.6);
  S.ventT=0.05;await __waitGame(0.6);s.persist();
  return {ventLeft:S.ventLeft,ventT:S.ventT,warned:S.warned,prints:S.prints.map(p=>[Math.round(p.x),Math.round(p.y),+p.t.toFixed(1)]),R:s.vision.R/T,snap:!!gengi.state().activeRaid?.snowState};});
await p.goto(URL); const resumed=await waitRaid(); await E(setup);
const after=await E(async()=>{const s=gengi.raid();const S=s.snowR;const r0={restored:S.restored,ventLeft:S.ventLeft,cap:S.sightCap(),prints:S.prints.map(p=>[Math.round(p.x),Math.round(p.y),+p.t.toFixed(1)]),imgs:S.prints.filter(p=>p.img).length};
  if(s.paused)s.setPaused(false,'usuario');await __waitGame(0.3);r0.R=s.vision.R/T;r0.ov=!!S.overlay?.visible;return r0;});
ok('K1 la ventisca sigue al reabrir la app (mismo tiempo restante, vista a 4 casillas)', resumed&&before.snap&&before.ventLeft>20&&after.restored&&Math.abs(after.ventLeft-before.ventLeft)<0.5&&after.cap===4&&after.R===4&&after.ov, JSON.stringify({b:before.ventLeft,a:after.ventLeft,cap:after.cap,R:after.R,ov:after.ov}));
ok('K2 las huellas en la nieve siguen al reabrir (mismas posiciones y vida, con su arte)', before.prints.length>0&&after.prints.length===before.prints.length&&after.prints.every((q,i)=>q[0]===before.prints[i][0]&&q[1]===before.prints[i][1]&&Math.abs(q[2]-before.prints[i][2])<=0.3)&&after.imgs===after.prints.length, `${before.prints.length} → ${after.prints.length} · ${JSON.stringify(before.prints.slice(0,2))} → ${JSON.stringify(after.prints.slice(0,2))}`);

// ---------- K3: inicio y salidas a partir de la definición del mapa ----------
await E(()=>{const C=gengi.v4b().cfg;if(!C.MAPS.some(m=>m.id==='qa_mapa2'))C.MAPS.push({...C.MAPS[0],id:'qa_mapa2',saveId:'qa2-v1',nombre:'Mapa QA',layoutSeed:(C.MAPS[0].layoutSeed^0x777)>>>0,zonas:[{id:'qa',nombre:'QA',bioma:'urbano'}]});});
{const r=await E(()=>{const V=gengi.v4b();const lo=JSON.parse(JSON.stringify(gengi.state().loadout));
  const a=V.newRaidSnapshot(4242,lo,0,'qa_mapa2'),m=V.mapForRaid(4242,'qa_mapa2');const ex=V.chooseExits(V.seeded(4242^0x5bd1e995),m);const h=V.helipadExit(m);if(h)ex.push(h);
  const b=V.newRaidSnapshot(4242,lo,0);
  return {def:a.mapDefId,id:a.mapId,exOk:JSON.stringify(a.exits)===JSON.stringify(ex),spOk:m.spawns.some(q=>q.x===a.player.x&&q.y===a.player.y),heliA:a.exits.some(e=>e.type==='helipuerto'),heliB:b.exits.some(e=>e.type==='helipuerto'),defB:b.mapDefId,snow:!!m.snow};});
 ok('K3 inicio y salidas salen del MapDef elegido (no de El Arrabal): ids, salidas y punto de inicio de ese mapa', r.def==='qa_mapa2'&&r.id==='qa2-v1'&&r.exOk&&r.spOk&&!r.heliA&&r.heliB&&r.defB==='arrabal'&&!r.snow, JSON.stringify(r));}

// ---------- K4: en un mapa sin nieve no hay ventisca ni sistemas de nieve ----------
await endRaid();
await E(()=>{gengi.v4b().save.data.mapSel='qa_mapa2';gengi.v4b().save.save();});
await E(()=>{gengi.seedNext(4242);gengi.start();}); await sleep(1600); await p.waitForFunction(()=>gengi.raid()&&gengi.raid().hud,{timeout:20000}); await E(setup);
{const r=await E(async()=>{const s=gengi.raid();__calm();const S=s.snowR;const R0=s.vision.R;S.ventT=0.05;
  gengi.move(1,0);await __waitGame(1.2);gengi.move(0,0);
  return {def:s.snap.mapDefId,snow:!!s.map.snow,active:S.active,plates:S.plates.length,vent:S.stats.ventiscas,left:S.ventLeft,R:s.vision.R===R0,ov:!!S.overlay,prints:S.prints.length,cap:s.sightCapTiles()};});
 ok('K4 mapa sin zona de nieve: sin nieve, sin placas, sin huellas y sin ventisca', r.def==='qa_mapa2'&&!r.snow&&r.active===false&&r.plates===0&&r.vent===0&&r.left===0&&r.R&&!r.ov&&r.prints===0&&r.cap===99, JSON.stringify(r));}
await endRaid();
await E(()=>{const V=gengi.v4b();V.save.data.mapSel='arrabal';V.save.save();const C=V.cfg;C.MAPS.splice(C.MAPS.findIndex(m=>m.id==='qa_mapa2'),1);V.app.hub.render();});

// ---------- K5: cinta «Zona superada» ----------
{await E(()=>gengi.v4b().setLevel(13));await sleep(600);
 const r=await E(async()=>{const a=document.querySelector('.mesa-mapas [data-map=arrabal]'),v=document.querySelector('.mesa-mapas [data-map=via_muerta]');const c=a?.querySelector('img.cinta');
   const sw=await (await fetch('sw.js',{cache:'no-store'})).text();
   return {cinta:!!c,src:c?.getAttribute('src'),w:c?.naturalWidth??0,vis:c?c.getBoundingClientRect().width:0,lock:!!a?.querySelector('img.lock'),plain:/Superado/.test(a?.textContent??''),other:!!v?.querySelector('img.cinta'),pre:sw.includes('art/v4/cinta_superada.svg')};});
 ok('K5 mapa superado: cinta «Zona superada» de Basu sobre la polaroid (sin candado, sin texto plano); solo en ese mapa', r.cinta&&r.src==='art/v4/cinta_superada.svg'&&r.w>0&&r.vis>20&&!r.lock&&!r.plain&&!r.other, JSON.stringify(r));
 ok('K6 la cinta está en la precarga generada del service worker', r.pre, '');
 await E(()=>gengi.v4b().setLevel(1));}

ok('Z sin errores de página', errs.length===0, errs.slice(0,3).join(' | '));
const nf=res.filter(x=>x.startsWith('FAIL')).length;console.log(`${res.length-nf} PASS, ${nf} FAIL`);
await b.close();
process.exit(nf?1:0);
