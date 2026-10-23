// QA del sigilo (diseno-v3.md §7) + migración de guardado v1 + caché del service worker:
// node qa/sigilo.mjs (con `npx vite preview --port 4173` en marcha)
import puppeteer from 'puppeteer-core';
const URL='http://localhost:4173/?debug=1&noelite';
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
const res=[]; const ok=(n,c,i='')=>{res.push(`${c?'PASS':'FAIL'} ${n} ${i}`);console.log(`${c?'PASS':'FAIL'} ${n} ${i}`);};
const b=await puppeteer.launch({executablePath:'/usr/bin/google-chrome',headless:'new',args:['--no-sandbox','--use-gl=swiftshader','--enable-unsafe-swiftshader','--window-size=390,844']});
const errs=[];
async function page(){
  const ctx=await b.createBrowserContext(); const p=await ctx.newPage();
  await p.setViewport({width:390,height:844,isMobile:true,hasTouch:true});
  p.on('pageerror',e=>errs.push(e.message)); p.on('console',m=>{if(m.type()==='error')errs.push(m.text())});
  await p.goto(URL); await p.waitForFunction(()=>window.gengi,{timeout:20000});
  await p.evaluate(()=>gengi.reset()).catch(()=>{}); await sleep(700); await p.waitForFunction(()=>window.gengi);
  return p;
}
let p=await page(); const E=(f,...a)=>p.evaluate(f,...a);
const setup=`
window.T=48;window.__wrap=a=>Math.atan2(Math.sin(a),Math.cos(a));
window.__calm=()=>{const s=gengi.raid();gengi.god(true);gengi.clearEnemies();s.snap.stream=null;s.snap.spawnTimer=-1e9;gengi.move(0,0);gengi.aim(null);
  if(!window.__hooked){window.__hooked=true;window.__pins=new Map();s.events.on('update',()=>{s.idleT=0;for(const [e,pos] of window.__pins){if(!e.dead){e.body.reset(pos.x,pos.y);if(pos.f!==undefined&&e.state==='idle'){e.facing=pos.f;e.turnT=1e9;e.pauseT=0;e.turnTo=null;}}}});}
  window.__pins.clear();};
window.__gt=()=>gengi.raid().snap.elapsed;
window.__waitGame=sec=>new Promise(r=>{const t0=__gt();const f=()=>{if(__gt()-t0>=sec)r();else setTimeout(f,30)};f();});
window.__open=(r=6)=>{const s=gengi.raid();let o=null;for(let k=r;k>=2&&!o;k--)o=s.openSpot(k);s.player.setPosition(o.x,o.y);s.vel.set(0,0);s.player.body.reset(o.x,o.y);return o;};
/** Enemigo quieto (fijado) en (dx,dy) casillas del jugador mirando a 'f' rad (no gira al azar). */
window.__dummy=(type,dx,dy,f,hp)=>{const s=gengi.raid();const T=48;const x=s.player.x+dx*T,y=s.player.y+dy*T;const e=s.spawnAt(type,x,y);e.state='idle';e.meter=0;e.facing=f;e.turnT=1e9;e.wander.set(0,0);if(hp){e.hp=e.maxHp=hp;}window.__pins.set(e,{x,y,f});return s.enemies.list.indexOf(e);};
`;
await E(()=>gengi.start()); await sleep(1500); await E(setup); await E(()=>__calm());
const T=48;

// ---------- 1. Pasos: velocidad y ruido por tramo del joystick ----------
{const r=await E(async()=>{const s=gengi.raid();__calm();__open(7);const out={};
  for(const [n,m] of [['sigilo',0.3],['andar',0.6],['correr',1]]){gengi.move(m,0);await __waitGame(0.6);out[n]={tier:s.moveTier,v:Math.hypot(s.vel.x,s.vel.y),noise:s.noiseTiles,ring:s.noiseRing?.visible&&Math.round(s.noiseRing.displayWidth)};gengi.move(0,0);await __waitGame(0.4);__open(7);}
  gengi.move(0,0);await __waitGame(0.5);out.quieto={tier:s.moveTier,noise:s.noiseTiles};
  const torso=s.snap.loadout.torso;s.snap.loadout.torso={uid:'qa-ch',def:'chaleco',rarity:'comun',qty:1};gengi.move(1,0);await __waitGame(0.5);out.chaleco=s.noiseTiles;gengi.move(0,0);s.snap.loadout.torso=torso;
  return out;});
 const max=r.correr.v;
 ok('S1 tres pasos: sigilo <40 %, andar 40-85 %, correr >85 %', r.sigilo.tier==='sigilo'&&r.andar.tier==='andar'&&r.correr.tier==='correr', JSON.stringify([r.sigilo.tier,r.andar.tier,r.correr.tier]));
 ok('S1 velocidades 35 % / 70 % / 100 %', Math.abs(r.sigilo.v/max-0.35)<0.04&&Math.abs(r.andar.v/max-0.7)<0.05, `sig=${(r.sigilo.v/max).toFixed(2)} and=${(r.andar.v/max).toFixed(2)}`);
 ok('S1 ruido 1 / 3 / 6 casillas, quieto 0, anillo visible', r.sigilo.noise===1&&r.andar.noise===3&&r.correr.noise===6&&r.quieto.noise===0&&r.sigilo.ring>0&&r.correr.ring>r.sigilo.ring, JSON.stringify({s:r.sigilo.noise,a:r.andar.noise,c:r.correr.noise,q:r.quieto.noise,ring:[r.sigilo.ring,r.correr.ring]}));
 ok('S1 chaleco militar +1 casilla', r.chaleco===7, `correr+chaleco=${r.chaleco}`);}

// ---------- 2. Acercarse en sigilo por la espalda no lo alerta; aparece "Ejecutar" ----------
{const r=await E(async()=>{const s=gengi.raid();__calm();__open(8);
  const i=__dummy('errante',3.2,0,0); const e=s.enemies.list[i]; // mira al este; el jugador está al oeste (detrás)
  gengi.move(0.3,0);let t0=__gt();let maxMeter=0;
  while(__gt()-t0<6&&!s.execTarget){maxMeter=Math.max(maxMeter,e.meter);await new Promise(r=>setTimeout(r,30));}
  gengi.move(0,0);await __waitGame(0.6);
  const out={state:e.state,meter:e.meter,maxMeter,exec:s.execTarget===e,dist:Math.round(Math.hypot(e.x-s.player.x,e.y-s.player.y)),label:s.hud.swap.label.text,icon:s.hud.swap.icon.texture.key};
  return out;});
 ok('S2 sigilo detrás de un enemigo de espaldas: no se entera', r.state==='idle'&&r.maxMeter===0, JSON.stringify(r));
 ok('S2 detrás y a alcance: el botón de cambio pasa a "Ejecutar" (arte v3)', r.exec&&r.label==='Ejecutar'&&r.icon==='ui_ejecutar', `label=${r.label} icon=${r.icon}`);}

// ---------- 3. Correr cerca sí lo alerta (oído, aunque esté de espaldas) ----------
{const r=await E(async()=>{const s=gengi.raid();__calm();__open(8);
  const i=__dummy('errante',4,0,0); const e=s.enemies.list[i]; window.__pins.delete(e); e.turnT=1e9;
  const h0=s.enemies.stealthStats.heard; gengi.move(1,0); await __waitGame(0.3); gengi.move(0,0);
  const st1=e.state; await __waitGame(2.5);
  return {st1,st2:e.state,heard:s.enemies.stealthStats.heard-h0};});
 ok('S3 correr cerca: lo oye de espaldas ("?" → va a mirar) y te descubre', r.st1==='investigate'&&r.heard>0&&(r.st2==='chase'||r.st2==='windup'||r.st2==='attack'||r.st2==='recover'), JSON.stringify(r));}

// ---------- 4. Medidor "?": cerca 0,4 s, lejos 1,2 s; lleno = "!" ----------
{const r=await E(async()=>{const s=gengi.raid();__calm();__open(8);const out={};
  for(const [n,d] of [['cerca',1.4],['lejos',5.6]]){__calm();__open(8);const i=__dummy('errante',d,0,Math.PI);const e=s.enemies.list[i];
    const t0=__gt();let tFull=null,sawQ=false;while(__gt()-t0<2.5){if(e.markBase?.visible)sawQ=true;if(e.state!=='idle'&&tFull===null){tFull=__gt()-t0;break;}await new Promise(r=>setTimeout(r,20));}
    await __waitGame(0.1);out[n]={tFull,sawQ,alert:!!e.markAlert?.visible,state:e.state};}
  return out;});
 ok('S4 cerca se llena rápido (~0,4 s), lejos lento (~1,2 s)', r.cerca.tFull!==null&&r.lejos.tFull!==null&&r.cerca.tFull<0.62&&r.lejos.tFull>0.85&&r.lejos.tFull<1.6, JSON.stringify({cerca:r.cerca.tFull,lejos:r.lejos.tFull}));
 ok('S4 "?" visible mientras se llena y "!" al llenarse (arte v3)', r.lejos.sawQ&&r.lejos.alert&&r.lejos.state!=='idle', JSON.stringify(r.lejos));}

// ---------- 5. Salir de su vista antes de llenarse: sospecha → va al sitio → mira 4 s → rutina ----------
{const r=await E(async()=>{const s=gengi.raid();__calm();const o=__open(8);const i=__dummy('errante',5,0,Math.PI);const e=s.enemies.list[i];window.__pins.delete(e);e.turnT=1e9;
  const seenAt={x:s.player.x,y:s.player.y};await __waitGame(0.45);const m=e.meter;
  // te escondes: lejos y a su espalda (fuera de su oído)
  s.player.setPosition(e.x+T*12,e.y);s.player.body.reset(e.x+T*12,e.y);
  const t0=__gt();let sawInv=false,sawLook=false,minD=1e9,tBack=null;
  while(__gt()-t0<14){if(e.state==='investigate'){sawInv=true;if(e.susPhase==='look')sawLook=true;minD=Math.min(minD,Math.hypot(e.x-seenAt.x,e.y-seenAt.y));}
    if(sawLook&&e.state==='idle'){tBack=__gt()-t0;break;}await new Promise(r=>setTimeout(r,30));}
  return {m,sawInv,sawLook,minD:Math.round(minD),tBack,state:e.state};});
 ok('S5 sale de la vista a medias: sospecha, va al último sitio y vuelve a su rutina', r.m>0.1&&r.m<1&&r.sawInv&&r.sawLook&&r.minD<T*1.6&&r.tBack!==null&&r.tBack>4, JSON.stringify(r));}

// ---------- 6. Giros al azar con pausa visible de 0,4 s ----------
{const r=await E(async()=>{const s=gengi.raid();__calm();__open(8);s.player.setPosition(s.player.x,s.player.y);
  const x=s.player.x+T*9,y=s.player.y;const e=s.spawnAt('errante',x,y);e.turnT=0.1;let pauses=0,lastP=0,f0=e.facing,turned=0,minT=99,maxT=0;
  const t0=__gt();while(__gt()-t0<9){if(e.pauseT>0&&lastP<=0){pauses++;minT=Math.min(minT,e.turnT);maxT=Math.max(maxT,e.turnT);}lastP=e.pauseT;if(Math.abs(__wrap(e.facing-f0))>0.3)turned++;await new Promise(r=>setTimeout(r,20));}
  return {pauses,turned:turned>0,minT,maxT,state:e.state};});
 ok('S6 los quietos giran al azar cada 3-7 s tras una pausa de 0,4 s', r.pauses>=2&&r.turned&&r.minT>=2.9&&r.maxT<=7.1, JSON.stringify(r));}

// ---------- 7. El ataque automático ignora a los desprevenidos ----------
{const r=await E(async()=>{const s=gengi.raid();__calm();__open(8);s.facing=0;
  const i=__dummy('errante',1.1,0,0,500);const e=s.enemies.list[i];const hp0=e.hp;const sk0=s.stats.autoSkippedUnaware;
  await __waitGame(1.5);const pickU=s.pickTarget(400,true,75);const hp1=e.hp;
  s.enemies.becomeAlert(e,false);await __waitGame(1.2);
  return {hp0,hp1,skipped:s.stats.autoSkippedUnaware-sk0,pickU:pickU?1:0,hp2:e.hp,state:e.state};});
 ok('S7 auto-ataque: no golpea ni elige a un desprevenido delante', r.hp1===r.hp0&&r.pickU===0&&r.skipped>0, JSON.stringify(r));
 ok('S7 en cuanto te detecta, el automático sí le ataca', r.hp2<r.hp0, `hp ${r.hp0}→${r.hp2}`);}

// ---------- 8. Ejecutar: x2,5 crítico; muerte silenciosa sin avisar a los vecinos ----------
{const r=await E(async()=>{const s=gengi.raid();__calm();__open(8);
  // daño base: golpes automáticos a un objetivo detectado (el menor = sin crítico)
  const ib=__dummy('errante',1.1,0,Math.PI,5000);const eb=s.enemies.list[ib];s.enemies.becomeAlert(eb,false);s.facing=0;const hits=[];let last=eb.hp;const t0=__gt();
  while(__gt()-t0<4&&hits.length<4){if(eb.hp<last){hits.push(+(last-eb.hp).toFixed(2));last=eb.hp;}await new Promise(r=>setTimeout(r,15));}
  const base=Math.min(...hits);
  __calm();__open(8);
  // muñeco de mucha vida para medir el x2,5
  const id=__dummy('errante',1.1,0,0,5000);const ed=s.enemies.list[id];await __waitGame(0.3);while(s.attackT>0)await __waitGame(0.05);const ex=s.execTarget===ed;const hpd=ed.hp;
  const okTap=(()=>{const bt=s.hud.swap.bg;const ev={x:bt.x,y:bt.y};return s.hud.swap.contains(ev.x,ev.y);})();
  s.hud.swap.onTap();await __waitGame(0.1);const execDmg=+(hpd-ed.hp).toFixed(2);
  __calm();__open(8);
  // víctima de espaldas + 2 vecinos a 3-4 casillas que miran a otro lado
  const iv=__dummy('errante',1.1,0,0,25);const v=s.enemies.list[iv]; // vida de un Errante al empezar (bate 12×2,5 = 30 lo mata)
  const n1=s.enemies.list[__dummy('errante',3.5,2.5,0)],n2=s.enemies.list[__dummy('corredor',4,-2.5,0)];
  await __waitGame(0.3);while(s.attackT>0)await __waitGame(0.05);const sk0=s.enemies.stealthStats.silentKills;const exec2=s.execTarget===v;
  const killed=gengi.execute();await __waitGame(1.5);
  return {hits,base,ex,okTap,execDmg,ratio:+(execDmg/base).toFixed(2),exec2,killed,dead:v.dead,silent:s.enemies.stealthStats.silentKills-sk0,n1:n1.state,n2:n2.state,n1m:n1.meter,n2m:n2.meter,crit:s.fx.shown.slice(-3)};});
 ok('S8 Ejecutar hace x2,5 del daño base del arma (bate 12 → 30, sin variación v3.1; crítico garantizado)', r.ex&&Math.abs(r.execDmg-30)<0.05&&r.base>=12*0.72-0.01&&r.base<=12*1.04*1.5+0.01, `base=${r.base} ejecutar=${r.execDmg} ratio=${r.ratio}`);
 ok('S8 Ejecutar mata en silencio: los vecinos no se enteran', r.exec2&&r.killed&&r.dead&&r.silent===1&&r.n1==='idle'&&r.n2==='idle'&&r.n1m===0&&r.n2m===0, JSON.stringify({killed:r.killed,silent:r.silent,n1:r.n1,n2:r.n2}));}

// ---------- 9. Disparo apuntado (joystick derecho) a un desprevenido: x2,5; automático normal ----------
{const r=await E(async()=>{const s=gengi.raid();__calm();__open(8);
  const prev=s.snap.loadout.arma;s.snap.loadout.arma={uid:'qa-pis',def:'pistola',rarity:'comun',qty:1,mag:12};
  s.snap.loadout.mochila.push({uid:'qa-mun',def:'municion',rarity:'comun',qty:60});
  const i=__dummy('errante',4,0,0,5000);const e=s.enemies.list[i];s.facing=0;await __waitGame(0.2);
  const hp0=e.hp;const a=Math.atan2(e.y-s.player.y,e.x-s.player.x);s.attackT=0;s.fireRanged(a,false);await __waitGame(0.6);const dAimed=+(hp0-e.hp).toFixed(2);
  const fired=s.proj.fired.slice(-1)[0];const st=e.state;
  s.enemies.becomeAlert(e,false);const hp1=e.hp;s.attackT=0;s.fireRanged(a,true);await __waitGame(0.6);const dAuto=+(hp1-e.hp).toFixed(2);
  s.snap.loadout.arma=prev;return {dAimed,dAuto,st,fired};});
 ok('S9 disparo apuntado a desprevenido x2,5 (pistola 12 → 30); el normal tira [0,72;1,04] (+crítico)', Math.abs(r.dAimed-30)<0.6 && r.dAuto>=12*0.72-0.01 && r.dAuto<=12*1.04*1.5+0.01, JSON.stringify(r));}

// ---------- 10. Ruido a través de paredes a la mitad ----------
{const r=await E(()=>{const s=gengi.raid();__calm();const T=48;
  // pared fina y alta: enemigo a un lado, ruido al otro (~4 casillas)
  const w=s.walls.find(w=>w.w<=T*1.2&&w.h>=T*4&&!s.walls.some(o=>o!==w&&o.x<w.x+w.w+T*3&&o.x+o.w>w.x-T*3&&o.y<w.y+w.h/2+T&&o.y+o.h>w.y+w.h/2-T));
  if(!w)return {skip:true};
  const cy=w.y+w.h/2,ex=w.x-T*2,nx=w.x+w.w+T*2;__open(8);
  const e=s.spawnAt('errante',ex,cy);e.state='idle';e.turnT=1e9;window.__pins.set(e,{x:ex,y:cy,f:Math.PI});
  const d=(nx-ex)/T;const blocked=!s.enemies.list.length||!window.__lc;
  s.enemies.noise(nx,cy,d*1.6);const st1=e.state;e.state='idle';e.goal=null;
  s.enemies.noise(nx,cy,d*2.3);const st2=e.state;
  return {d:+d.toFixed(2),st1,st2};});
 ok('S10 ruido tras pared: alcance a la mitad (r=1,6·d no llega; r=2,3·d sí)', r.skip||(r.st1==='idle'&&r.st2==='investigate'), JSON.stringify(r));}

// ---------- 11. Cristales y latas del suelo: ruido 5 al pisarlos ----------
{const r=await E(async()=>{const s=gengi.raid();__calm();__open(8);
  const inW=(x,y,pad=24)=>s.walls.some(w=>x>w.x-pad&&x<w.x+w.w+pad&&y>w.y-pad&&y<w.y+w.h+pad);
  const clear=(x0,y0,x1,y1)=>{for(let k=0;k<=30;k++){if(inW(x0+(x1-x0)*k/30,y0+(y1-y0)*k/30))return false;}return true;};
  const d=s.debris.find(d=>clear(d.x-T*3-40,d.y,d.x+30,d.y))||s.debris[0];
  s.player.setPosition(d.x-40,d.y);s.player.body.reset(d.x-40,d.y);s.vel.set(0,0);await __waitGame(0.2);
  const i=__dummy('errante',-3,0,Math.PI);const e=s.enemies.list[i]; // a 3 casillas, de espaldas: con sigilo (1) no oiría
  const n0=s.stats.debrisSteps;gengi.move(0.3,0);await __waitGame(0.9);gengi.move(0,0);
  return {count:s.debris.length,steps:s.stats.debrisSteps-n0,state:e.state,heard:s.enemies.stealthStats.heard,toast:s.hud.msg?.text};});
 ok('S11 cristales/latas por el mapa; pisarlos hace ruido (5) aunque vayas en sigilo', r.count>=40&&r.steps>=1&&r.state!=='idle', JSON.stringify(r));}

// ---------- 12. Conos tenues en el suelo + ajuste para expertos ----------
{const r=await E(async()=>{const s=gengi.raid();__calm();__open(8);__dummy('errante',3,0,Math.PI);await __waitGame(0.3);
  const on=s.conesGfx.commandBuffer.length;s.settings.conosEnemigos=false;await __waitGame(0.2);const off=s.conesGfx.commandBuffer.length;s.settings.conosEnemigos=true;
  return {on,off};});
 ok('S12 conos de visión tenues (por defecto) y se pueden quitar en ajustes', r.on>0&&r.off===0, JSON.stringify(r));}
{const r=await E(async()=>{gengi.hide?.();return true;});void r;}

// ---------- 13. Guardado v1 → versión actual sin perder alijo ni chapas ----------
{const ctx=await b.createBrowserContext();const q=await ctx.newPage();await q.setViewport({width:390,height:844,isMobile:true,hasTouch:true});
 q.on('pageerror',e=>errs.push(e.message));
 await q.goto(URL);await q.waitForFunction(()=>window.gengi,{timeout:20000});
 const v1={saveVersion:1,createdAt:'2026-05-01T10:00:00.000Z',updatedAt:'2026-05-02T10:00:00.000Z',chapas:4321,
  stash:[{uid:'s1',def:'machete',rarity:'reforzado',qty:1},{uid:'s2',def:'vendaje',rarity:'comun',qty:3},{uid:'s3',def:'arco',rarity:'comun',qty:1},{uid:'s4',def:'chaleco',rarity:'comun',qty:1},{uid:'s5',def:'municion',rarity:'comun',qty:24}],
  overflow:[{uid:'o1',def:'botiquin',rarity:'comun',qty:1}],
  loadout:{arma:{uid:'l1',def:'bate',rarity:'comun',qty:1},torso:null,cabeza:null,mochila:[{uid:'m1',def:'vendaje',rarity:'comun',qty:2}],bolsillo:null},
  raidLog:[],activeRaid:null,settings:{prioridad:'debil',rarezaMin:'comun',curarUmbral:40,rapido:'botiquin'}};
 await q.evaluate(d=>{localStorage.setItem('gengi.save',JSON.stringify(d));},v1);
 await q.reload();await q.waitForFunction(()=>window.gengi,{timeout:20000});await sleep(500);
 const r=await q.evaluate(()=>{const d=gengi.saveData();return {v:d.saveVersion,chapas:d.chapas,stash:d.stash.map(i=>i.uid+':'+i.def+':'+i.qty),overflow:d.overflow.map(i=>i.uid),mochila:d.loadout.mochila.map(i=>i.uid),reserva:d.loadout.reserva,seen:d.seenExits,set:d.settings};});
 const want=v1.stash.map(i=>i.uid+':'+i.def+':'+i.qty);
 ok('S13 guardado v1 migra a la versión actual (4)', r.v===4, `saveVersion=${r.v}`);
 ok('S13 sin perder chapas ni objetos del alijo/excedente/equipo', r.chapas===4321&&want.every(w=>r.stash.includes(w))&&r.overflow.includes('o1')&&r.mochila.includes('m1'), JSON.stringify({chapas:r.chapas,stash:r.stash,overflow:r.overflow}));
 ok('S13 ajustes antiguos conservados + nuevo ajuste de conos activado', r.set.prioridad==='debil'&&r.set.curarUmbral===40&&r.set.conosEnemigos===true&&r.reserva===null, JSON.stringify(r.set));
 // service worker: nombre de caché por build y limpieza de cachés viejas
 // página del mismo origen que NO registra el SW (manifest), para que la activación ocurra después de crear las cachés viejas
 await ctx.close();
 const ctx2=await b.createBrowserContext();const q2=await ctx2.newPage();
 await q2.goto(URL.replace('/?debug=1&noelite','/manifest.webmanifest'));
 const sw=await q2.evaluate(async()=>{for(const r of await navigator.serviceWorker.getRegistrations())await r.unregister();
   const t=await (await fetch('sw.js',{cache:'no-store'})).text();const m=t.match(/const CACHE = '([^']+)'/);
   for(const k of await caches.keys())await caches.delete(k);
   await caches.open('gengi-viejo-1');await caches.open('gengi-2b9f-antigua');await caches.open('otra-app');
   const reg=await navigator.serviceWorker.register('sw.js');
   for(let i=0;i<60;i++){if(reg.active)break;await new Promise(r=>setTimeout(r,150));}
   for(let i=0;i<20;i++){const ks=await caches.keys();if(!ks.includes('gengi-viejo-1'))break;await new Promise(r=>setTimeout(r,150));}
   return {name:m&&m[1],keys:await caches.keys(),active:!!reg.active};});
 ok('S14 service worker: caché con nombre automático por build', !!sw.name&&!sw.name.includes('__BUILD_ID__')&&/^gengi-[0-9a-f]{10}-[0-9a-z]+$/.test(sw.name), sw.name);
 ok('S14 al activarse borra las cachés gengi antiguas (y no toca otras)', sw.active&&!sw.keys.includes('gengi-viejo-1')&&!sw.keys.includes('gengi-2b9f-antigua')&&sw.keys.includes('otra-app')&&sw.keys.includes(sw.name), JSON.stringify(sw));
 await ctx2.close();}

ok('sin errores de consola', errs.length===0, errs.slice(0,3).join(' | '));
console.log('\n'+res.join('\n'));
console.log(`\n${res.filter(r=>r.startsWith('PASS')).length}/${res.length} PASS`);
await b.close();
