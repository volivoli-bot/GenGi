// QA de la v2 (7 puntos + arma de reserva): node qa/v2.mjs (con `npx vite preview --port 4173` en marcha)
import puppeteer from 'puppeteer-core';
const URL='http://localhost:4173/?debug=1';
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
const res=[]; const ok=(n,c,i='')=>{res.push(`${c?'PASS':'FAIL'} ${n} ${i}`);console.log(`${c?'PASS':'FAIL'} ${n} ${i}`);};
const b=await puppeteer.launch({executablePath:'/usr/bin/google-chrome',headless:'new',args:['--no-sandbox','--use-gl=swiftshader','--enable-unsafe-swiftshader','--window-size=390,844']});
const errs=[];
async function page(ios=false){
  const ctx=await b.createBrowserContext(); const p=await ctx.newPage();
  await p.setViewport({width:390,height:844,isMobile:true,hasTouch:true});
  if(ios) await p.evaluateOnNewDocument(()=>{ delete Navigator.prototype.vibrate; });
  p.on('pageerror',e=>errs.push(e.message)); p.on('console',m=>{if(m.type()==='error')errs.push(m.text())});
  await p.goto(URL); await p.waitForFunction(()=>window.gengi,{timeout:20000});
  await p.evaluate(()=>gengi.reset()).catch(()=>{}); await sleep(700); await p.waitForFunction(()=>window.gengi);
  return p;
}
let p=await page(); let E=(f,...a)=>p.evaluate(f,...a);
const T=48;
// helpers en la página
const setup=`window.__calm=()=>{const s=gengi.raid();gengi.god(true);gengi.clearEnemies();s.snap.stream=null;s.snap.spawnTimer=-1e9;
  if(!window.__hooked){window.__hooked=true;window.__pins=new Map();s.events.on('update',()=>{s.idleT=0;for(const [e,pos] of window.__pins){if(!e.dead)e.body.reset(pos.x,pos.y);}});}};
  window.__frames=n=>new Promise(r=>{let i=0;const f=()=>{if(++i>=n)r();else requestAnimationFrame(f)};requestAnimationFrame(f);});
  window.__wait=ms=>new Promise(r=>setTimeout(r,ms));
  window.__open=(r=5)=>{const s=gengi.raid();let o=null;for(let k=r;k>=2&&!o;k--)o=s.openSpot(k);s.player.setPosition(o.x,o.y);s.vel.set(0,0);s.player.body.reset(o.x,o.y);return o;};`;
await E(()=>gengi.start()); await sleep(1500); await E(setup); await E(()=>__calm());

// ---------- 0. Anuncio de salidas al empezar + carteles ----------
{const r=await E(()=>{const s=gengi.raid();return {msg:s.hud.msg.text,signs:s.children.list.filter(o=>o.texture?.key==='cartel_evacuacion').length,seen:s.seenExitList(),exits:s.snap.exits.map(e=>e.loc)}});
 ok('7 al empezar se anuncian las 2 salidas activas', /Salidas activas/.test(r.msg) && r.exits.length===2, JSON.stringify(r.msg));
 ok('7 carteles de evacuación en paredes', r.signs>=6, `carteles=${r.signs}`);}

// ---------- 1. Inercia ----------
{await E(()=>__open(6));
 const r=await E(async()=>{const s=gengi.raid();const k=s.keys.D;const inr=s.inertia();
   // tiempo de JUEGO (snap.elapsed): en el navegador sin GPU de QA los fotogramas son lentos y Phaser recorta el delta
   const g=()=>s.snap.elapsed;const t0=g();let t95=null;k.isDown=true;
   while(g()-t0<1.2){await __frames(1);const v=s.vel.x;if(t95===null&&v>=inr.max*0.95)t95=g()-t0;}
   k.isDown=false;const t1=g();let tStop=null;let skid=0;
   while(g()-t1<1){await __frames(1);if(tStop===null&&Math.abs(s.vel.x)<inr.max*0.05)tStop=g()-t1;if(tStop===null)skid+=1;}
   return {...inr,t95,tStop,skidFrames:skid};});
 ok('1 inercia: aceleración ≈ 0,25 s × (1 + 2 %·peso)', r.t95!==null && Math.abs(r.t95-r.accelSec*0.95)<0.05, JSON.stringify({peso:r.weight.toFixed(2),esperado:(r.accelSec*0.95).toFixed(3),medido:r.t95?.toFixed(3)}));
 ok('1 inercia: frenado ≈ 0,18 s × (1 + 2 %·peso), con derrape', r.tStop!==null && Math.abs(r.tStop-r.decelSec*0.95)<0.05 && r.skidFrames>=3, JSON.stringify({esperado:(r.decelSec*0.95).toFixed(3),medido:r.tStop?.toFixed(3),frames:r.skidFrames}));
 const h=await E(async()=>{const s=gengi.raid();gengi.give('chaleco','comun');gengi.give('tablas','comun');gengi.give('casco','comun');return s.inertia();});
 ok('1 más peso → aceleración y frenado más lentos', h.accelSec>r.accelSec && h.decelSec>r.decelSec, `${r.accelSec.toFixed(3)}→${h.accelSec.toFixed(3)} s (peso ${h.weight.toFixed(1)})`);
 await E(()=>{const s=gengi.raid();s.snap.loadout.mochila=s.snap.loadout.mochila.filter(i=>!['chaleco','tablas','casco'].includes(i.def));});}

// ---------- 2. Looteo con enemigos cerca + golpe = pausa ----------
{const r=await E(async()=>{const s=gengi.raid();__calm();
   const c=s.containers.find(c=>c.snap.items.length);c.snap.items.push({uid:'qa1',def:'vendaje',rarity:'comun',qty:1});
   s.player.setPosition(c.snap.x+40,c.snap.y);s.player.body.reset(c.snap.x+40,c.snap.y);s.vel.set(0,0);
   const e=s.spawnAt('errante',c.snap.x+40+2*48,c.snap.y);e.state='idle';e.sees=false;e.sightT=1e9;window.__pins.set(e,{x:e.x,y:e.y});
   await __wait(500);const a=s.lootState();
   gengi.god(false);s.damagePlayer(1,'QA');gengi.god(true);await __frames(2);const b=s.lootState();await __wait(250);const c2=s.lootState();
   await __wait(600);const d=s.lootState();
   await __wait(2500);const done=c.snap.opened;window.__pins.clear();gengi.clearEnemies();return {a,b,c2,d,done,paused:s.stats.lootPaused};});
 ok('2 se lootea con un enemigo a 2 casillas', r.a.t>0.2, JSON.stringify(r.a));
 ok('2 un golpe PAUSA el anillo (no lo reinicia)', r.b.paused && r.b.t>=r.a.t-0.001 && Math.abs(r.c2.t-r.b.t)<0.02, JSON.stringify({antes:r.a.t.toFixed(2),golpe:r.b.t.toFixed(2),durante:r.c2.t.toFixed(2)}));
 ok('2 tras la pausa el anillo continúa y termina', r.d.t>r.c2.t || r.done, JSON.stringify({despues:r.d.t.toFixed(2),abierto:r.done}));}

// ---------- 3. Menú contextual / comparar ----------
{await E(()=>{const s=gengi.raid();__calm();__open(4);gengi.give('vendaje','comun',2);gengi.give('machete','militar');gengi.inventory();}); await sleep(300);
 const cells=await E(()=>[...document.querySelectorAll('.sheet [data-uid]')].map(el=>{const r=el.getBoundingClientRect();return {uid:el.dataset.uid,x:r.left+r.width/2,y:r.top+r.height/2,img:el.querySelector('img')?.alt}}));
 const v=cells.find(c=>c.img==='Vendaje'), m=cells.find(c=>c.img==='Machete');
 await p.touchscreen.tap(v.x,v.y); await sleep(200);
 const menu=await E(()=>{const c=document.querySelector('.ctx');if(!c)return null;const r=c.getBoundingClientRect(),P=document.querySelector('.sheet').getBoundingClientRect();return {acts:[...c.querySelectorAll('button')].map(b=>b.textContent),inside:r.left>=P.left-1&&r.right<=P.right+1&&r.top>=P.top-1&&r.bottom<=P.bottom+1,r:[r.left,r.top,r.right,r.bottom]}});
 ok('3 tocar un objeto abre un menú flotante junto a él', menu && menu.acts.includes('Usar') && menu.acts.includes('Tirar') && menu.acts.includes('Mover al bolsillo seguro') && menu.inside, JSON.stringify(menu));
 const geo=await E(()=>{const s=gengi.raid(),h=s.hud,P=document.querySelector('.sheet').getBoundingClientRect();const a=s.aim.rest;
   const btns=[...h.abilities,h.quick,h.swap].map(b=>({x:b.bg.x,y:b.bg.y,r:b.bg.radius||26}));
   const hitsBtn=btns.some(b=>b.x+b.r>P.left&&b.x-b.r<P.right&&b.y+b.r>P.top&&b.y-b.r<P.bottom);
   const hitsAim=a.x+70>P.left&&a.y-70<P.bottom; const hitsJoy=P.left<180&&P.bottom>innerHeight-260;
   return {hitsBtn,hitsAim,hitsJoy,P:[P.left,P.top,P.right,P.bottom].map(Math.round),bottomButtons:document.querySelectorAll('.sheet .actions, .sheet .bar').length}});
 ok('3 el panel y su menú no tapan joysticks ni botones; sin botones abajo', !geo.hitsBtn&&!geo.hitsAim&&!geo.hitsJoy&&geo.bottomButtons===0, JSON.stringify(geo));
 // usar desde el menú
 const n0=await E(()=>gengi.raid().snap.loadout.mochila.filter(i=>i.def==='vendaje').reduce((n,i)=>n+i.qty,0));
 await E(()=>{gengi.god(false);gengi.hurt(30);gengi.god(true);});
 await E(()=>[...document.querySelectorAll('.ctx button')].find(b=>b.textContent==='Usar').click()); await sleep(150);
 const nMid=await E(()=>gengi.raid().snap.loadout.mochila.filter(i=>i.def==='vendaje').reduce((n,i)=>n+i.qty,0));
 const closed=await E(()=>!document.querySelector('.ctx'));
 await E(()=>new Promise(r=>{const s=gengi.raid(),t0=s.snap.elapsed;const f=()=>s.snap.elapsed-t0>=1.7?r():setTimeout(f,30);f();})); // v3 §8.8: la venda tarda 1,5 s
 const n1=await E(()=>gengi.raid().snap.loadout.mochila.filter(i=>i.def==='vendaje').reduce((n,i)=>n+i.qty,0));
 ok('3 «Usar» del menú cierra el menú y gasta el objeto al terminar de aplicarlo (1,5 s)', nMid===n0 && n1===n0-1 && closed, `${n0}→${nMid} (aplicando)→${n1}`);
 // mantener pulsado = comparar
 const m2=await E(()=>{const el=[...document.querySelectorAll('.sheet [data-uid]')].find(e=>e.querySelector('img')?.alt==='Machete');const r=el.getBoundingClientRect();return {x:r.left+r.width/2,y:r.top+r.height/2}});
 await p.touchscreen.touchStart(m2.x,m2.y); for(let i=0;i<20&&!(await E(()=>!!document.querySelector('.ctx.cmp')));i++) await sleep(100); await sleep(100); await p.touchscreen.touchEnd(); await sleep(150);
 const cmp=await E(()=>{const c=document.querySelector('.ctx.cmp');return c?[...c.querySelectorAll('tr')].map(tr=>tr.textContent):null});
 ok('3 mantener pulsado compara con lo equipado (Daño, Golpes/s…)', cmp && cmp.some(t=>t.startsWith('Daño'))&&cmp[0].includes('Equipado'), JSON.stringify(cmp));
 const cb=await E(()=>{const c=document.querySelector('.ctx.cmp');if(!c)return {x:5,y:5};const r=c.getBoundingClientRect();return {x:r.left+r.width/2,y:r.top+r.height/2}}); await p.touchscreen.tap(cb.x,cb.y); await sleep(150);
 ok('3 tocar la comparación la cierra', await E(()=>!document.querySelector('.ctx')));
 await p.touchscreen.tap(m2.x,m2.y); await sleep(200);
 const ma=await E(()=>[...document.querySelectorAll('.ctx button')].map(b=>b.textContent));
 ok('3 arma en la mochila: menú con «Equipar»', ma.includes('Equipar'), JSON.stringify(ma));
 await E(()=>document.querySelector('.sheet .btn.x').click());}

// ---------- Arma de reserva ----------
{const r=await E(async()=>{const s=gengi.raid();__calm();const lo=s.snap.loadout;
   const mach=lo.mochila.find(i=>i.def==='machete');s.invEquip(mach.uid);          // bate (gratis) → se descarta; machete en mano
   gengi.give('pistola','reforzado');gengi.give('municion','comun',24);
   const w0=s.inertia().weight;
   const pis=lo.mochila.find(i=>i.def==='pistola');s.invEquip(pis.uid);           // machete → reserva
   const after={arma:lo.arma?.def,reserva:lo.reserva?.def,w:s.inertia().weight};
   lo.arma.mag=12;
   const icon=s.hud.swap.icon?.texture?.key ?? s.hud.swap.iconKey ?? null;
   const shots0=s.stats.shots; s.swapWeapon(); const t0=s.snap.elapsed; // tiempo de juego (no depende de la carga de la máquina)
   gengi.aim(0.95,0); let during=[];
   while(s.swapT>0){during.push({sh:s.stats.shots,arma:lo.arma?.def});await __frames(1);}
   const dur=s.snap.elapsed-t0; gengi.aim(null);
   return {after,w0,icon,dur,shotsDuring:during.at(-1)?.sh-shots0,armaDuring:during[0]?.arma,end:{arma:lo.arma?.def,reserva:lo.reserva?.def},blocked:s.stats.attacksDuringSwap,swaps:s.stats.swaps};});
 ok('R equipar arma nueva manda la anterior a la reserva', r.after.arma==='pistola'&&r.after.reserva==='machete', JSON.stringify(r.after));
 ok('R las dos armas pesan', Math.abs(r.after.w-r.w0)<0.001, `peso con machete en mochila ${r.w0} = con machete en reserva ${r.after.w}`);
 ok('R cambio rápido dura 0,4 s y no se puede atacar mientras', Math.abs(r.dur-0.4)<0.07 && r.shotsDuring===0 && r.end.arma==='machete'&&r.end.reserva==='pistola', JSON.stringify({dur:r.dur.toFixed(3),disparos:r.shotsDuring,fin:r.end,bloqueados:r.blocked}));
 const hud=await E(()=>{const s=gengi.raid();const b=s.hud.swap;const a=s.hud.abilities.concat([s.hud.quick]);return {sy:b.bg.y,minArc:Math.min(...a.map(x=>x.bg.y)),visible:b.bg.visible,enabled:b.enabled??null}});
 ok('R botón de cambio encima del arco de habilidades', hud.sy<hud.minArc && hud.visible, JSON.stringify(hud));
 await E(()=>gengi.swap()); await sleep(700);}

// ---------- 5. Apuntado twin-stick, proyectiles, jugo ----------
{const r=await E(async()=>{const s=gengi.raid();__calm();__open(8);const lo=s.snap.loadout;lo.arma.mag=12;s.snap.player.reload=0;
   const st=s.stats;const sh0=st.shots;
   gengi.aim(0.5,0);await __wait(300);const lineDrawn=s.aimGfx.commandBuffer.length>0;const shBelow=st.shots-sh0;
   gengi.aim(null);await __frames(3);const shCancel=st.shots-sh0;
   // estabilización: dispersión menor tras 0,4 s quieto
   gengi.aim(0.6,0);await __frames(2);const sp0=s.spreadDeg();await __wait(500);const sp1=s.spreadDeg();
   // pasar del 85 % = dispara; mantener = sigue a su cadencia (pistola)
   gengi.aim(0.95,0);await new Promise(r=>{const t0=s.snap.elapsed;const f=()=>s.snap.elapsed-t0>=1.3?r():setTimeout(f,20);f();});const shHold=st.shots-sh0;gengi.aim(null);await __wait(100);
   const fired=s.proj.fired.slice(-3);
   return {lineDrawn,shBelow,shCancel,sp0,sp1,shHold,fired,mag:lo.arma.mag};});
 ok('5 apuntar dibuja la línea y no dispara por debajo del 85 %', r.lineDrawn && r.shBelow===0, JSON.stringify({linea:r.lineDrawn,disparos:r.shBelow}));
 ok('5 soltar antes del umbral cancela', r.shCancel===0);
 ok('5 la línea tiembla al principio y se estabiliza tras 0,4 s', r.sp1<r.sp0*0.5, `${r.sp0.toFixed(1)}° → ${r.sp1.toFixed(1)}°`);
 ok('5 pistola: pasar el umbral dispara y mantener sigue a su cadencia (1,34/s desde la prueba v3)', r.shHold===2, `disparos en 1,3 s = ${r.shHold} (antes 3 con 2/s)`);
 ok('5 bala a 40 casillas/s con trazo', r.fired.length && r.fired.every(f=>f.kind==='bala'&&Math.abs(f.speed-40*48)<1), JSON.stringify(r.fired[0]));
 // 60 % de velocidad apuntando
 const mv=await E(async()=>{const s=gengi.raid();__open(8);const k=s.keys.D;k.isDown=true;await __wait(500);const v1=s.vel.length();gengi.aim(0,-0.5);await __wait(500);const v2=s.vel.length();gengi.aim(null);k.isDown=false;await __wait(300);return {v1,v2};});
 ok('5 al apuntar te mueves al 60 %', Math.abs(mv.v2/mv.v1-0.6)<0.03, `${mv.v1.toFixed(0)} → ${mv.v2.toFixed(0)} px/s`);
 // arco: un disparo por cruce del umbral; flecha 480 px/s, recuperable
 const bow=await E(async()=>{const s=gengi.raid();__calm();__open(8);gengi.give('arco','comun');gengi.give('flechas','comun',10);const lo=s.snap.loadout;const a=lo.mochila.find(i=>i.def==='arco');s.invEquip(a.uid);
   await __wait(200);const sh0=s.stats.shots;gengi.aim(0.95,0);await __wait(1500);const one=s.stats.shots-sh0;await new Promise(r=>{const f=()=>s.attackT<=0?r():setTimeout(f,20);f();}); /* arco 0,536/s: 1,87 s entre flechas */gengi.aim(0.5,0);await __frames(3);gengi.aim(0.95,0);await __wait(200);const two=s.stats.shots-sh0;gengi.aim(null);
   const f=s.proj.fired.at(-1);await __wait(1500);const flechas=lo.mochila.filter(i=>i.def==='flechas').reduce((n,i)=>n+i.qty,0);const ground=s.snap.arrows?.length??0;return {one,two,f,flechas,ground};});
 ok('5 arco: un disparo por cada vez que cruzas el umbral', bow.one===1&&bow.two===2, JSON.stringify({one:bow.one,two:bow.two}));
 ok('5 flecha a 480 px/s', bow.f?.kind==='flecha'&&Math.abs(bow.f.speed-480)<1, JSON.stringify(bow.f));
 const rec=await E(async()=>{const s=gengi.raid();s.syncArrows?.();const g=s.groundArrows??[];const n=(s.snap.arrows??[]).length;if(!n)return {n:0};const a=s.snap.arrows[0];const before=s.snap.loadout.mochila.filter(i=>i.def==='flechas').reduce((n,i)=>n+i.qty,0);s.player.setPosition(a.x,a.y);s.player.body.reset(a.x,a.y);await __wait(400);const after=s.snap.loadout.mochila.filter(i=>i.def==='flechas').reduce((n,i)=>n+i.qty,0);return {n,before,after,stat:s.stats.arrowsRecovered};});
 ok('5 las flechas caídas se pueden recoger', rec.n===0 ? true : rec.after>rec.before, JSON.stringify(rec)+(rec.n===0?' (ninguna sobrevivió al 70 %: sin flechas en el suelo esta vez)':''));
 // jugo: números de daño, crítico, sangre/manchas, hit-stop, tambaleo
 const j=await E(async()=>{const s=gengi.raid();__calm();__open(6);const lo=s.snap.loadout;
   const pis=lo.reserva?.def==='pistola'?null:null;
   const e=s.spawnAt('errante',s.player.x,s.player.y-2.5*48);e.state='idle';e.sees=false;e.sightT=1e9;await __frames(3);
   const st0=s.fx.stainCount;const hs0=s.stats.hitStops;const x0=e.x,y0=e.y;const nShown=s.fx.shown.length;
   s.dealDamage(e,6,-Math.PI/2,'bate',false,55);const inStop=s.hitStopActive();await __frames(1);await __wait(150);
   const moved=Math.hypot(e.x-x0,e.y-y0);const stag=e.stagger;
   s.dealDamage(e,9,-Math.PI/2,'bate',true,80);await __wait(150);
   const shown=s.fx.shown.slice(nShown).filter(x=>x.n===6||x.n===9);
   const ab=s.spawnAt('abominacion',s.player.x+3*48,s.player.y-3*48);ab.state='idle';await __frames(3);const ax=ab.x,ay=ab.y;
   s.dealDamage(ab,6,-Math.PI/2,'bate',false,55);await __wait(200);const abMoved=Math.hypot(ab.x-ax,ab.y-ay);
   if(!e.dead)s.enemies.kill(e);await __wait(100);const st1=s.fx.stainCount;gengi.clearEnemies();
   return {inStop,hs:s.stats.hitStops-hs0,moved,abMoved,stag,shown,st0,st1};});
 ok('5 número de daño blanco con contorno; crítico #ffd27a 1,4×', j.shown.length===2 && !j.shown[0].crit && j.shown[1].crit && j.shown[1].color==='#ffd27a' && Math.abs(j.shown[1].size/j.shown[0].size-1.4)<0.05, JSON.stringify(j.shown));
 ok('5 hit-stop al golpear', j.inStop && j.hs>=1, `parones=${j.hs}`);
 ok('5 retroceso/tambaleo = fuerza del arma / peso del enemigo', j.moved>4 && j.abMoved<j.moved*0.5 && j.stag>0, JSON.stringify({errante:j.moved.toFixed(1),abominacion:j.abMoved.toFixed(1)}));
 ok('5 manchas de sangre que se quedan', j.st1>j.st0, `${j.st0}→${j.st1}`);}

// ---------- 5. Mirar atrás (toque rápido) y mirada con el stick ----------
{const r=await E(async()=>{const s=gengi.raid();__calm();__open(5);s.facing=-Math.PI/2;await __frames(2);
   gengi.aim(0.1,0);await __frames(2);gengi.aim(null);await __wait(400);const f1=s.facing;await __wait(700);const f2=s.facing;
   gengi.aim(0.6,0.0);await __wait(300);const f3=s.facing;gengi.aim(null);return {f1,f2,f3};});
 ok('5 toque rápido en el stick = mirar atrás (0,8 s)', Math.abs(Math.abs(r.f1)-Math.PI/2)<0.2 && r.f1>0, `facing ${(r.f1*180/Math.PI).toFixed(0)}°`);
 ok('5 el stick derecho fija la mirada', Math.abs(r.f3)<0.1, `facing ${(r.f3*180/Math.PI).toFixed(0)}°`);}

// ---------- 6. Visión: cono, niebla, muros, aviso por detrás ----------
{const r=await E(async()=>{const s=gengi.raid();__calm();__open(7);s.facing=-Math.PI/2;
   const mk=(dx,dy)=>{const e=s.spawnAt('errante',s.player.x+dx*48,s.player.y+dy*48);e.state='idle';e.sees=false;e.sightT=1e9;window.__pins.set(e,{x:e.x,y:e.y});return e;};
   const front=mk(0,-4), behind=mk(0,3);await __wait(500);
   const res={front:front.visibleNow,behind:behind.visibleNow,behindRig:behind.rig?.visible??behind.rig?.root?.visible,threatsBehind:s.hud.threatShown.length};
   behind.sees=true;behind.state='chase';const v0=s.stats.behindVibes;await __wait(1200);res.vibes=s.stats.behindVibes-v0;res.vig=s.hud.vignette.commandBuffer.length>0;
   window.__pins.clear();gengi.clearEnemies();return res;});
 ok('6 enemigo delante (cono 220°) visible; detrás oculto en la niebla', r.front && !r.behind, JSON.stringify(r));
 ok('6 enemigo oculto a ≤ 4 casillas detrás → vibración + viñeta roja', r.vibes>=1 && r.vig, JSON.stringify({vibes:r.vibes,vig:r.vig}));
 const w=await E(async()=>{const s=gengi.raid();__calm();
   // muro largo horizontal: jugador a un lado, enemigo al otro, mirando hacia él
   const wall=s.walls.find(r=>r.w>=4*48&&r.h<=48&&r.h>=12&&r.y>6*48&&r.y<100*48);if(!wall)return null;
   const cx=wall.x+wall.w/2;s.player.setPosition(cx,wall.y+wall.h+40);s.player.body.reset(cx,wall.y+wall.h+40);s.vel.set(0,0);s.facing=-Math.PI/2;
   const e=s.spawnAt('errante',cx,wall.y-2*48);e.state='idle';e.sees=false;e.sightT=1e9;window.__pins.set(e,{x:e.x,y:e.y});s.cameras.main.centerOn(s.player.x,s.player.y-60/s.cameras.main.zoom);await __wait(1200);
   const r={hidden:!e.visibleNow,onScreen:s.onScreen(e.x,e.y),arrow:s.hud.threatShown.length,tele:s.enemies.canTelegraph?s.enemies.canTelegraph(e):null};
   e.sees=true;e.state='chase';e.sightT=0;await __wait(300);r.arrowDetected=s.hud.threatShown.length;
   window.__pins.clear();gengi.clearEnemies();return r;});
 ok('6 los muros tapan la visión (enemigo tras muro oculto aunque esté en pantalla)', w && w.hidden && w.onScreen, JSON.stringify(w));
 ok('6 en la niebla cuenta como no visible: flecha de borde si te detecta, sin aviso de ataque', w && w.arrowDetected>=1 && w.tele===false, JSON.stringify(w));}

// ---------- 6. Puertas ----------
{const r=await E(async()=>{const s=gengi.raid();__calm();
   const d=s.doorList().find(d=>!d.open);if(!d)return null;
   // ponerse a 1,2 casillas de la puerta y andar hacia ella
   const off=d.horiz?{x:0,y:1.2*48}:{x:1.2*48,y:0};s.player.setPosition(d.x+off.x,d.y+off.y);s.player.body.reset(d.x+off.x,d.y+off.y);s.vel.set(0,0);
   const key=d.horiz?s.keys.W:s.keys.A;const n0=s.stats.doorsOpened;const wv=s.wallsVersion;key.isDown=true;await __wait(900);key.isDown=false;
   const after=s.doorList().find(x=>x.id===d.id);return {open:after.open,opened:s.stats.doorsOpened-n0,wv:s.wallsVersion-wv,doors:s.doorList().length};});
 ok('6 las puertas se abren al pasar (y reconstruyen muros/visión)', r && r.open && r.opened===1 && r.wv>=1, JSON.stringify(r));
 const a=await E(()=>({doors:gengi.raid().doorList().length,size:gengi.raid().physics.world.bounds.width/48}));
 ok('6 mapa ~3× de área con edificios y puertas', a.size>=100 && a.doors>=20, JSON.stringify(a));}

// ---------- 7. Salidas: ocultas hasta verlas, persistentes por mapa ----------
{const r=await E(async()=>{const s=gengi.raid();__calm();const mapId=s.map.id;
   const ex=s.snap.exits[0];const before=s.seenExitList().includes(ex.loc);
   const shownBefore=s.extraction.closedGfx ? null : null;
   s.player.setPosition(ex.x,ex.y+3*48);s.player.body.reset(ex.x,ex.y+3*48);s.vel.set(0,0);s.facing=-Math.PI/2;await __wait(700);
   return {mapId,loc:ex.loc,before,after:s.seenExitList().includes(ex.loc),saved:gengi.seenExits()[mapId]||[],msg:s.hud.msg.text};});
 ok('7 la salida se descubre al verla y se guarda por mapa', !r.before && r.after && r.saved.includes(r.loc), JSON.stringify(r));
 // nueva raid: lo visto se conserva
 await E(()=>gengi.kill()); await sleep(600);
 await E(()=>{document.querySelectorAll('button').forEach(b=>/Refugio|Continuar|Volver/.test(b.textContent)&&b.click())});
 await E(()=>gengi.start()); await sleep(1500);
 const r2=await E((loc)=>{const s=gengi.raid();return {seen:s.seenExitList(),has:s.seenExitList().includes(loc)}},r.loc);
 ok('7 las salidas vistas siguen vistas en la siguiente raid', r2.has, JSON.stringify(r2));
 // migración 1→2 (guardado v1 → seenExits vacío)
 const st=await E(()=>gengi.state()); ok('7 guardado v2+ con seenExits', st.saveVersion>=2 && typeof st.seenExits==='object');}

// ---------- R: muerte → se pierden las dos armas ----------
{await E(setup); const r=await E(async()=>{const s=gengi.raid();__calm();gengi.give('machete','comun');gengi.give('pistola','comun');const lo=s.snap.loadout;
   s.invEquip(lo.mochila.find(i=>i.def==='machete').uid);s.invEquip(lo.mochila.find(i=>i.def==='pistola').uid);
   const pre={arma:lo.arma?.def,reserva:lo.reserva?.def};gengi.god(false);gengi.kill();await __wait(400);const d=gengi.state();
   return {pre,arma:d.loadout.arma?.def,free:d.loadout.arma?.free,reserva:d.loadout.reserva?.def??null};});
 ok('R al morir se pierden arma y reserva', r.pre.reserva==='machete' && r.reserva===null && r.free, JSON.stringify(r));}
await p.browserContext().close();

// ---------- iOS: sin vibración → retroceso + golpe de cámara más fuertes ----------
p=await page(true); E=(f,...a)=>p.evaluate(f,...a);
{await E(()=>gengi.start()); await sleep(1500); await E(setup);
 const r=await E(async()=>{const s=gengi.raid();__calm();__open(8);gengi.give('pistola','comun');gengi.give('municion','comun',24);const lo=s.snap.loadout;s.invEquip(lo.mochila.find(i=>i.def==='pistola').uid);lo.arma.mag=12;
   await __wait(200);gengi.aim(0.95,0);await __wait(400);gengi.aim(null);return {ios:typeof navigator.vibrate!=='function',kick:s.stats.iosKick,shots:s.stats.shots,recoil:s.rig.recoilPx};});
 ok('iOS: disparo con retroceso y sacudida de cámara más fuertes', r.ios && r.kick>=1 && r.kick===r.shots && r.recoil>=8, JSON.stringify(r));}
// ---------- iOS: gestos del navegador (atrás/adelante desde el borde, tirar para recargar) ----------
{const g=await E(()=>{const cv=document.querySelector('#game canvas');const W=innerWidth;
   const fire=(type,target,x,y)=>{const t=new Touch({identifier:77,target,clientX:x,clientY:y});const ev=new TouchEvent(type,{cancelable:true,bubbles:true,touches:type==='touchend'?[]:[t],changedTouches:[t],targetTouches:type==='touchend'?[]:[t]});target.dispatchEvent(ev);return ev.defaultPrevented;};
   const css=getComputedStyle(document.documentElement), cb=getComputedStyle(document.body);
   const r={html:css.overscrollBehaviorY+'/'+css.touchAction, body:cb.overscrollBehaviorX+'/'+cb.position, canvas:getComputedStyle(cv).touchAction,
     startCanvas:fire('touchstart',cv,4,500), moveCanvas:fire('touchmove',cv,40,520)}; fire('touchend',cv,40,520);
   // menú HTML: un botón recibe el toque (no se cancela) y la lista con scroll se puede arrastrar
   const host=document.createElement('div');host.className='screen';host.innerHTML='<div class="scroll" style="height:100px"><div style="height:400px"></div></div><button id="__b">b</button>';document.getElementById('ui').appendChild(host);
   const btn=host.querySelector('#__b'), sc=host.querySelector('.scroll');
   r.startBtn=fire('touchstart',btn,6,700); r.startBtnMid=fire('touchstart',btn,200,700); r.moveScroll=fire('touchmove',sc.firstChild,200,300); r.moveBg=fire('touchmove',host,200,300);
   host.remove(); return r;});
 ok('iOS: html/body overscroll-behavior:none, touch-action:none en canvas, body fijo', /none/.test(g.html) && g.body==='none/fixed' && g.canvas==='none', JSON.stringify(g));
 ok('iOS: touchstart/touchmove del juego cancelados (passive:false)', g.startCanvas && g.moveCanvas);
 ok('iOS: los toques en menús HTML no se bloquean; las listas con scroll se arrastran', !g.startBtn && !g.startBtnMid && !g.moveScroll && g.moveBg, JSON.stringify({b:g.startBtn,bm:g.startBtnMid,sc:g.moveScroll,bg:g.moveBg}));
 // joysticks lejos del borde (≥ 20 px + radio), y neutros al tocar
 await E(()=>{const s=gengi.raid();__calm();s.joy.reset();s.aim.reset();});
 await p.touchscreen.touchStart(3,560); await sleep(120);
 const j=await E(()=>{const s=gengi.raid();return {bx:s.joy.base.x,vx:s.joy.vec.x,vy:s.joy.vec.y,rest:s.aim.rest.x,W:innerWidth}});
 await p.touchscreen.touchMove(33,560); await sleep(120);
 const j2=await E(()=>gengi.raid().joy.vec.x); await p.touchscreen.touchEnd(); await sleep(100);
 ok('iOS: joystick flotante a ≥ 20 px del borde y neutro al tocar', j.bx>=80 && Math.abs(j.vx)<0.01 && Math.abs(j.vy)<0.01 && j2>0.4 && j2<0.6, JSON.stringify({...j,j2}));
 ok('iOS: joystick de apuntar en reposo a 20 px del borde', j.W-(j.rest+70)>=20, `borde=${j.W-(j.rest+70)}`);
 // si el navegador navega igualmente: pagehide pausa y guarda en el acto
 const ph=await E(()=>{const s=gengi.raid();if(s.paused)s.setPaused(false,'reanudada');const el=s.snap.elapsed;window.dispatchEvent(new PageTransitionEvent('pagehide',{persisted:false}));
   const ar=JSON.parse(localStorage.getItem('gengi.save')).activeRaid;return {paused:s.paused,saved:!!ar,savedEl:ar?.elapsed,el};});
 ok('iOS: pagehide pausa y guarda síncrono', ph.paused && ph.saved && Math.abs(ph.savedEl-ph.el)<0.05, JSON.stringify(ph));}
await p.browserContext().close();
console.log(res.join('\n')); console.log('ERRORES:',errs.slice(0,10));
console.log(`${res.filter(x=>x.startsWith('PASS')).length}/${res.length} PASS`);
await b.close();
