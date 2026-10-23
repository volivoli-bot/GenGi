// QA v4.0 §2-§3: nivel, experiencia, atributos, Gimnasio/Pizarra, interfaz (+3, barra, panel) y anti-retroceso al importar.
// node qa/levels.mjs [url]   (por defecto http://localhost:4177/ con un build de la v4)
import puppeteer from 'puppeteer-core';
import fs from 'fs';
const BASE=process.argv[2]||'http://localhost:4177/';
const URL=BASE+'?debug=1&noelite';
const SHOTS='/workspace/gengi/shots';
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
const res=[]; const ok=(n,c,i='')=>{res.push(`${c?'PASS':'FAIL'} ${n} ${i}`);console.log(`${c?'PASS':'FAIL'} ${n} ${i}`);};
const info=(n,i)=>{res.push(`INFO ${n} ${i}`);console.log(`INFO ${n} ${i}`);};
const b=await puppeteer.launch({executablePath:'/usr/bin/google-chrome',headless:'new',args:['--no-sandbox','--use-gl=swiftshader','--enable-unsafe-swiftshader','--window-size=390,844']});
const errs=[];
const p=await (await b.createBrowserContext()).newPage();
await p.setViewport({width:390,height:844,isMobile:true,hasTouch:true});
p.on('pageerror',e=>errs.push(e.message)); p.on('console',m=>{if(m.type()==='error')errs.push(m.text())});
await p.goto(URL); await p.waitForFunction(()=>window.gengi,{timeout:20000});
await p.evaluate(()=>{localStorage.removeItem('gengi.marcas');gengi.reset();}).catch(()=>{}); await sleep(900); await p.waitForFunction(()=>window.gengi,{timeout:20000});
const E=(f,...a)=>p.evaluate(f,...a);
const setup=`
window.__calm=()=>{const s=gengi.raid();gengi.god(true);gengi.clearEnemies();s.snap.stream=null;s.snap.spawnTimer=-1e9;gengi.move(0,0);gengi.aim(null);
  if(!window.__hooked||window.__hookedScene!==s){window.__hooked=true;window.__hookedScene=s;s.events.on('update',()=>{s.idleT=0;s.snap.spawnTimer=Math.min(s.snap.spawnTimer,-1e6);});}};
`;
async function closeSummary(){ await sleep(400); await E(()=>document.querySelectorAll('.overlay button, .card button').forEach(b=>{if(/Volver|Continuar|Refugio/i.test(b.textContent))b.click();})); await sleep(300); }
async function endRaid(kind='extraido', exitType=null){ const news=await E((k,t)=>{const s=gengi.raid();if(!s||s.ended)return null;const ex=t?s.snap.exits.find(e=>e.type===t)??{...s.snap.exits[0],type:t}:s.snap.exits[0];s.host.endRaid(k,k==='extraido'?{exit:ex}:{cause:'QA'});return [...document.querySelectorAll('.overlay li, .overlay p, .overlay .news, .overlay div')].map(e=>e.textContent).join(' | ');},kind,exitType); await closeSummary(); return news; }
async function newRaid(seed=1234){ await E(sd=>{gengi.seedNext(sd);gengi.start();},seed); await sleep(1600); await p.waitForFunction(()=>gengi.raid()&&gengi.raid().hud,{timeout:20000}); await E(setup); await E(()=>__calm()); await E(()=>{const s=gengi.raid();s.snap.xp=0;s.snap.xpBy={};}); }
const LV=()=>E(()=>gengi.lv().prog());

// ================= L. Curva y tabla (Basu) =================
{const r=await E(()=>{const L=gengi.lv();const o=L.ops;return {c:[1,2,3,4,5,6,7,8,9,10,11].map(o.xpToNext),to5:o.xpForLevel(5),f5to10:o.xpForLevel(10)-o.xpForLevel(5),
  k:['errante','corredor','hinchado','escupidor','chillon','acechador','bruto','reptante','enjambre','abominacion'].map(t=>o.killXp(t,false)),el:o.killXp('bruto',true),boss:o.killXp('x',false,true),ex13:o.extractXp(13.4),
  m:[o.missionXp(0),o.missionXp(1)],death:L.cfg.XP_DEATH,good:40*5.5+2*6*3+15*2+100+o.extractXp(13)};});
 ok('L1 curva: 90,120,…,330 y luego ×1,10 (363, 399); nivel 5 = 540; 5→10 = 1.350', JSON.stringify(r.c)==='[90,120,150,180,210,240,270,300,330,363,399]'&&r.to5===540&&r.f5to10===1350, JSON.stringify(r));
 ok('L2 tabla de muertes (4/5/6/7/7/9/12/8/1/120), élite ×3, jefe 400, extraer 40+8/min, misión 60-150', JSON.stringify(r.k)==='[4,5,6,7,7,9,12,8,1,120]'&&r.el===36&&r.boss===400&&r.ex13===144&&r.m[0]===60&&r.m[1]===150, JSON.stringify({k:r.k,el:r.el,ex:r.ex13,m:r.m}));
 ok('L3 muerte configurable: por defecto pierde la de la incursión + 25 % del progreso', r.death.mode==='raid+progreso'&&r.death.progressLoss===0.25, JSON.stringify(r.death));
 info('L3 referencia «buena incursión» mapa 1 (40 muertes mezcladas, 2 élites, 15 cajas, 1 misión, extraer min 13)', `≈${Math.round(r.good)} exp`);}

// ================= R. Experiencia en la incursión =================
await newRaid();
{const r=await E(async()=>{const s=gengi.raid();const x0=s.snap.xp??0;
  s.spawnAt('errante',s.player.x+200,s.player.y,undefined,false);s.spawnAt('bruto',s.player.x-200,s.player.y,undefined,false);
  const es=s.enemies.list.slice(-2);for(const e of es)s.enemies.kill(e);
  const x1=s.snap.xp;
  return {x0,x1,by:JSON.parse(JSON.stringify(s.snap.xpBy??{}))};});
 ok('R1 matar suma experiencia a la incursión (errante 4 + bruto 12), sin asegurar', r.x1-r.x0===16&&r.by.kills===16, JSON.stringify(r));}
{const c=await E(()=>{const s=gengi.raid();const c=s.snap.containers.filter(c=>!c.opened&&c.items.length&&c.kind!=='cadaver'&&c.kind!=='cerrada').sort((a,b)=>Math.hypot(a.x-s.player.x,a.y-s.player.y)-Math.hypot(b.x-s.player.x,b.y-s.player.y))[0];s.player.setPosition(c.x+30,c.y);s.player.body.reset(c.x+30,c.y);return {id:c.id,xp:s.snap.xp};});
 let opened=false;for(let i=0;i<40&&!opened;i++){await sleep(150);opened=await E(id=>gengi.raid().snap.containers.find(c=>c.id===id).opened,c.id);}
 const x=await E(()=>gengi.raid().snap.xp);
 ok('R2 abrir una caja: +2 (una sola vez)', opened&&x-c.xp===2, `abierta ${opened} +${x-c.xp}`);}
// barra de experiencia y nivel en el HUD
{const r=await E(()=>{const s=gengi.raid();return {lvl:s.hud.lvlText.text,btn:s.hud.lvlBtn.bg.visible};});
 ok('U1 HUD: «Nv 1» y sin «+» sin puntos libres', r.lvl==='Nv 1'&&!r.btn, JSON.stringify(r));}
{const before=await LV();const news=await endRaid('extraido');const after=await LV();
 const st=await E(()=>gengi.state().stats);
 const expected=Math.round(18+40+8*0);
 ok('R3 extraer asegura la de la incursión + 40 + 8/min (×1 en el mapa 1)', after.total-before.total===expected, `${before.total}→${after.total} (esperado +${expected})`);
 ok('R4 el resumen muestra la experiencia', /experiencia/i.test(news??''), (news??'').slice(0,160));}
// subir de nivel: 3 puntos por nivel
{const r=await E(()=>{const L=gengi.lv();const p0=L.prog();const up=L.bank(L.xpToNext(p0.level)-p0.xp+L.xpToNext(p0.level+1));return {up,p:L.prog()};});
 ok('R5 subir 2 niveles da 6 puntos libres', r.up===2&&r.p.level===3&&r.p.free===6, JSON.stringify({up:r.up,lv:r.p.level,free:r.p.free}));}
// muerte
await newRaid();
{const pre=await LV();await E(()=>{const s=gengi.raid();s.gainXp(50,'kills');});
 const news=await endRaid('muerto');const post=await LV();
 const lost=Math.floor(pre.xp*0.25);
 ok('R6 al morir: se pierde la de la incursión y el 25 % del progreso hacia el siguiente nivel (sin bajar de nivel)', post.level===pre.level&&post.xp===pre.xp-lost&&post.total===pre.total-lost, `xp ${pre.xp}→${post.xp} (−${lost}) nivel ${pre.level}→${post.level}`);
 ok('R6 el resumen lo explica', /perdida/i.test(news??''), (news??'').slice(0,200));}
// helipuerto
await newRaid();
{const pre=await LV();const st0=await E(()=>gengi.state().stash.length);
 await E(()=>{gengi.raid().gainXp(100,'kills');});
 const news=await endRaid('extraido','helipuerto');const post=await LV();const st=await E(()=>gengi.state().stash.slice(-2).map(i=>i.rarity));
 const gain=post.total-pre.total;
 ok('R7 helipuerto: ×1,5 de experiencia y 2 objetos Militares al alijo', gain===Math.round((100+40)*1.5)&&st.every(r=>r==='militar'), `+${gain} · ${JSON.stringify(st)} · ${/Suministros/.test(news??'')}`);}

// ================= A. Atributos =================
{const r=await E(()=>{const L=gengi.lv(),o=L.ops;
  // operaciones puras sobre una copia
  const d=JSON.parse(JSON.stringify(gengi.state()));d.prog.free=60;for(const k in d.prog.attrs)d.prog.attrs[k]=0;
  for(let i=0;i<52;i++)o.assignPoint(d,'fuerza');
  const atCap=d.prog.attrs.fuerza,freeAfter=d.prog.free,capMsg=o.assignPoint(d,'fuerza');
  const rs=o.respecPoint(d,'fuerza',1);const afterRs={pts:d.prog.attrs.fuerza,free:d.prog.free};
  d.stats.raids=10;d.prog.cheapRespecAt=-999;const cheap=o.respecCost(d,2);o.respecPoint(d,'fuerza',2);const afterCheap={pts:d.prog.attrs.fuerza,free:d.prog.free};const again=o.respecCost(d,2);
  const k25=o.attrK(d,'agilidad','speed');d.prog.attrs.agilidad=25;const kAg=o.attrK(d,'agilidad','speed');
  // Gimnasio: tope +5 por nivel construido
  const gym0=o.gymSlotsLeft(d,1),gymMsg=o.gymRaise(d,'fuerza',1);const g2=o.gymRaise(d,'fuerza',2);const cap55=o.attrCap(d,'fuerza');const g2b=o.gymRaise(d,'sigilo',2);
  // Pizarra 3: cambio completo gratis por cada 10 niveles
  d.prog.level=23;const fr=o.freeResetsLeft(d,3);const tot=Object.values(d.prog.attrs).reduce((a,b)=>a+b,0)+d.prog.free;o.fullReset(d,3);const tot2=d.prog.free;const fr2=o.freeResetsLeft(d,3);
  return {atCap,freeAfter,capMsg,rs,afterRs,cheap,afterCheap,again,k25,kAg,gym0,gymMsg,g2,cap55,g2b,fr,tot,tot2,fr2};});
 ok('A1 3 puntos por nivel, tope 50 por atributo', r.atCap===50&&r.freeAfter===10&&/Máximo/.test(r.capMsg??''), JSON.stringify({cap:r.atCap,free:r.freeAfter,msg:r.capMsg}));
 ok('A2 quitar un punto: cuesta 2 asignados, devuelve 1', r.rs===null&&r.afterRs.pts===48&&r.afterRs.free===11, JSON.stringify(r.afterRs));
 ok('A3 Pizarra 2: 1 → 1 una vez cada 3 incursiones', r.cheap.cost===1&&r.afterCheap.pts===47&&r.afterCheap.free===12&&r.again.cost===2, JSON.stringify({cheap:r.cheap,after:r.afterCheap,again:r.again}));
 ok('A4 lineal: 25 puntos de Agilidad = +7,5 % de velocidad', Math.abs(r.kAg-0.075)<1e-9&&r.k25===0, String(r.kAg));
 ok('A5 Gimnasio: sin construir no sube topes; nivel 2 → +5 a uno (55) y no a otro', r.gym0===0&&!!r.gymMsg&&r.g2===null&&r.cap55===55&&!!r.g2b, JSON.stringify({g0:r.gym0,g2:r.g2,cap:r.cap55,second:r.g2b}));
 ok('A6 Pizarra 3: nivel 23 → 2 cambios completos gratis; devuelve todos los puntos', r.fr===2&&r.tot2===r.tot&&r.fr2===1, JSON.stringify({fr:r.fr,tot:r.tot,tot2:r.tot2,fr2:r.fr2}));}
// estaciones: requisitos de nivel de personaje
{const r=await E(()=>{const L=gengi.lv();gengi.give('mat_chatarra','comun',40);gengi.give('mat_componentes','comun',40);gengi.give('mat_componentes','comun',40);gengi.give('mat_tela','comun',20);gengi.chapas(30000);
  L.setStation('generador',3);const a=gengi.op('upgrade','gimnasio');const st=gengi.state().prog.level;
  const pz=gengi.op('upgrade','pizarra');
  L.bank(L.ops.xpForLevel(12)-L.ops.xpForLevel(gengi.state().prog.level)-gengi.state().prog.xp+1);
  const b=gengi.op('upgrade','gimnasio');const pz2=gengi.op('upgrade','pizarra');const lv=gengi.state().refugio.levels;return {a,st,pz,b,pz2,lv,plv:gengi.state().prog.level};});
 ok('A7 Gimnasio 2 exige nivel de personaje 12; Pizarra 2, nivel 6', !r.a.ok&&/nivel de personaje 12/.test(r.a.msg??'')&&!r.pz.ok&&/nivel de personaje 6/.test(r.pz.msg??'')&&r.b.ok&&r.pz2.ok&&r.lv.gimnasio===2&&r.lv.pizarra===2, JSON.stringify(r));}
// efectos en la incursión
await newRaid();
{const r=await E(async()=>{const s=gengi.raid(),L=gengi.lv();const at=()=>{for(const k of Object.keys(L.cfg.ATTRS))L.setAttr(k,0);};at();
  const m=()=>{s.moveTier='correr';s.vel.set(200,0);const o= {spd:s.spd(),noise:s.footNoise(),reload:s.att('pulso','reload'),detect:s.detectSlow()};s.vel.set(0,0);return o;};const R0=Math.random;const seedR=()=>{let x=12345;Math.random=()=>((x=(x*1103515245+12345)>>>0)/4294967296);};
  gengi.god(false);s.snap.player.hp=100;seedR();s.damagePlayer(20,'QA',true);Math.random=R0;const d0=100-s.snap.player.hp;
  await new Promise(r=>setTimeout(r,900));const b0=m();for(const k of Object.keys(L.cfg.ATTRS))L.setAttr(k,50);
  s.snap.player.hp=100;seedR();s.damagePlayer(20,'QA',true);Math.random=R0;const d50=100-s.snap.player.hp;gengi.god(true);s.snap.player.hp=100;
  const b50=m();
  // Fuerza: 6 de peso libre
  const lo=s.snap.loadout;const w=gengi.v4().totalWeight(lo);
  return {b0,b50,d0,d50,w,peek:s.att('carronero','peekTiles'),luck:s.att('suerte','loot')};});
 ok('A8 Agilidad 50: +15 % velocidad (con Fuerza 50 la carga actual no frena)', Math.abs(r.b50.spd/r.b0.spd-1.15)<0.02||r.b50.spd>=1.15-1e-9, JSON.stringify({s0:r.b0.spd,s50:r.b50.spd,w:r.w}));
 ok('A9 Resistencia 50: −15 % de daño', Math.abs(r.d50/r.d0-0.85)<0.02, `${r.d0}→${r.d50}`);
 ok('A10 Sigilo 50: −35 % de ruido de pasos y «?» 30 % más lento', Math.abs(r.b50.noise/r.b0.noise-0.65)<0.02&&Math.abs(r.b50.detect-0.3)<1e-9, JSON.stringify({n0:r.b0.noise,n50:r.b50.noise,det:r.b50.detect}));
 ok('A11 Pulso 50: recarga 25 % más rápida; Carroñero 50: 3 casillas; Suerte 50: +20 % botín', Math.abs(r.b50.reload-0.25)<1e-9&&Math.abs(r.peek-3)<1e-9&&Math.abs(r.luck-0.2)<1e-9, JSON.stringify(r));}
{await E(()=>{const s=gengi.raid();const c=s.snap.containers.filter(c=>!c.opened&&c.items.length&&c.kind!=='cadaver').sort((a,b)=>Math.hypot(a.x-s.player.x,a.y-s.player.y)-Math.hypot(b.x-s.player.x,b.y-s.player.y))[0];s.player.setPosition(c.x+48*2,c.y);s.player.body.reset(c.x+48*2,c.y);window.__peekC=c.id;});
 await sleep(700);const r=await E(()=>({shown:gengi.raid().peekShown(),id:window.__peekC}));
 ok('A12 Carroñero: se ve el contenido de una caja cerrada a 2 casillas', r.shown.some(x=>x.id===r.id&&x.text.length>0), JSON.stringify(r.shown.slice(0,3)));}
// +3 y panel (no pausa)
{await E(()=>{gengi.lv().setFree(3);});await sleep(400);
 const r=await E(()=>{const s=gengi.raid();return {btn:s.hud.lvlBtn.bg.visible,x:s.hud.lvlBtn.bg.x,y:s.hud.lvlBtn.bg.y};});
 ok('U2 con puntos libres aparece el «+3» dorado arriba a la izquierda', r.btn&&r.x<140&&r.y<140, JSON.stringify(r));
 // tocarlo (toque real en pantalla)
 const cv=await p.$('canvas');const bb=await cv.boundingBox();const sc=await E(()=>{const s=gengi.raid();return {w:s.scale.width,h:s.scale.height};});
 await p.touchscreen.tap(bb.x+r.x*bb.width/sc.w,bb.y+r.y*bb.height/sc.h);await sleep(500);
 const o=await E(()=>({open:!!document.querySelector('.attr-sheet'),paused:gengi.raid().paused,t:gengi.raid().snap.elapsed}));
 await sleep(500);const t2=await E(()=>gengi.raid().snap.elapsed);
 ok('U3 tocar «+3» abre el panel de atributos y el juego sigue (no pausa)', o.open&&!o.paused&&t2>o.t, JSON.stringify({...o,t2}));
 await E(()=>{for(const k of Object.keys(gengi.lv().cfg.ATTRS))gengi.lv().setAttr(k,0);gengi.lv().setAttr('sigilo',12);gengi.lv().setAttr('pulso',8);gengi.lv().setFree(3);gengi.raid().host.attrs.render();});
 await sleep(200);
 if(fs.existsSync(SHOTS))await p.screenshot({path:SHOTS+'/v4_0-panel-atributos.png'});
 await E(()=>document.querySelector('.attr-sheet [data-attr=agilidad] [data-act=mas]').click());await sleep(200);
 const a=await E(()=>({ag:gengi.state().prog.attrs.agilidad,free:gengi.state().prog.free}));
 ok('U4 «+» en el panel asigna un punto y se guarda', a.ag===1&&a.free===2, JSON.stringify(a));
 await E(()=>gengi.raid().host.attrs.close());await sleep(300);
 if(fs.existsSync(SHOTS))await p.screenshot({path:SHOTS+'/v4_0-barra-xp-mas3.png'});}
// aviso de nivel en la incursión
{const r=await E(async()=>{const s=gengi.raid(),L=gengi.lv();const p=L.prog();s.gainXp(L.xpToNext(p.level)-p.xp+1,'kills');await new Promise(r=>setTimeout(r,600));return {msg:s.hud.msg.text};});
 ok('U5 al juntar la experiencia de un nivel en la incursión: aviso «se asegura al extraer»', /Nivel \d+.*extraer/.test(r.msg), r.msg);}
await endRaid('extraido');
// refugio: Pizarra con el panel
{await E(()=>{gengi.lv().setFree(3);gengi.lv().setStation('pizarra',2);});await sleep(300);
 const r=await E(()=>{[...document.querySelectorAll('.tabs button')].find(b=>/Refugio/.test(b.textContent))?.click();return true;});await sleep(300);
 const q=await E(()=>({panel:!!document.querySelector('[data-st=pizarra] .attrs'),gym:!!document.querySelector('[data-st=gimnasio]'),head:document.querySelector('.hub-head .nivel')?.textContent}));
 ok('U6 refugio: la Pizarra muestra el panel, hay Gimnasio y el nivel arriba', q.panel&&q.gym&&/Nv \d+/.test(q.head??''), JSON.stringify(q));
 await E(()=>document.querySelector('[data-st=pizarra]').scrollIntoView());await sleep(200);
 if(fs.existsSync(SHOTS))await p.screenshot({path:SHOTS+'/v4_0-pizarra-refugio.png'});}
// misión: experiencia de personaje (asegurada en el acto)
{const r=await E(()=>{const L=gengi.lv(),d=L.data();const vs=d.vendors.doc;vs.offers=[...new Set([...(vs.offers||[]),'doc_tela'])];vs.active=null;
  const acc=gengi.op('acceptMission','doc','doc_tela');gengi.give('mat_tela','comun',6);const t0=L.prog().total;const del=gengi.op('deliverMission','doc');return {acc,del,gain:L.prog().total-t0};});
 ok('M1 misión de vendedor: +60-150 de experiencia (asegurada) y se avisa', r.del?.ok&&r.gain>=60&&r.gain<=150&&/exp/.test(r.del.msg??''), JSON.stringify(r));}

// ================= S. Guardado: migración 5→6 y anti-retroceso =================
{const r=await E(()=>{const d=JSON.parse(JSON.stringify(gengi.state()));d.saveVersion=5;delete d.prog;delete d.profileId;delete d.rev;d.createdAt='2026-03-03T10:00:00.000Z';
  const a=gengi.importStr(JSON.stringify(d));const pid1=a.profileId;const b=JSON.parse(JSON.stringify(d));b.stats.raids+=1;const a2=gengi.importStr(JSON.stringify(b));
  return {v:a.saveVersion,prog:a.prog,pid1,pid2:a2.profileId};});
 ok('S1 migración 5→6: nivel 1 sin experiencia y perfil estable a partir de la fecha de creación', r.v===6&&r.prog.level===1&&r.prog.xp===0&&r.pid1===r.pid2&&!!r.pid1, JSON.stringify({v:r.v,lv:r.prog.level,pid:r.pid1}));}
{const r=await E(()=>{const old=gengi.exportStr();
  // juego sigue: una incursión más
  const d=gengi.state();const later=JSON.parse(old);later.stats.raids+=1;later.rev+=5;
  gengi.chapas(10);const cur=gengi.exportStr();
  let refused=null;try{gengi.importStr(old);}catch(e){refused=e.message;}
  let newer=null;try{gengi.importStr(JSON.stringify(later));}catch(e){newer=e.message;}
  const latestA=gengi.exportStr();
  const other=JSON.parse(old);other.profileId='otra-partida';other.stats.raids=0;other.rev=0;let otherE=null;try{gengi.importStr(JSON.stringify(other));}catch(e){otherE=e.message;}
  const afterOther=gengi.state().profileId;
  let back=null;try{gengi.importStr(latestA);}catch(e){back=e.message;}
  let older=null;const o2=JSON.parse(old);try{gengi.importStr(JSON.stringify(o2));}catch(e){older=e.message;}
  return {refused,newer,otherE,afterOther,back,older};});
 ok('S2 importar una copia ANTERIOR de la misma partida: rechazado (no se puede volver atrás)', /anterior/.test(r.refused??''), r.refused);
 ok('S3 importar una copia más reciente de la misma partida: permitido', r.newer===null, String(r.newer));
 ok('S4 importar otra partida distinta: permitido', r.otherE===null&&r.afterOther==='otra-partida', String(r.otherE));
 ok('S5 volver a la primera partida con su copia más reciente: permitido; con la vieja, no', r.back===null&&/anterior/.test(r.older??''), JSON.stringify({back:r.back,older:r.older}));}

ok('Z sin errores de consola', errs.length===0, errs.slice(0,3).join(' | '));
await b.close();
const pass=res.filter(r=>r.startsWith('PASS')).length, fail=res.filter(r=>r.startsWith('FAIL')).length;
console.log(`\n${pass} PASS, ${fail} FAIL`);
process.exit(fail?1:0);
