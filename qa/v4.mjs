// QA v4 (base): mochilas (§1), mapas por datos + rareza Reliquia (§5) y El Arrabal por franjas con Zona Helada (§4):
// las 3 variantes (salidas alcanzables, la guarida no tapa salidas, nada dentro de paredes, distancias inicio→nieve/helipuerto),
// helipuerto con Tarjeta, guarida, enemigos ×1,3 en la nieve, migración 4→5.
// node qa/v4.mjs [url]   (por defecto http://localhost:4176/ con un build de la v4)
import puppeteer from 'puppeteer-core';
const BASE=process.argv[2]||'http://localhost:4176/';
const URL=BASE+'?debug=1';
const NSEED=+(process.env.NSEED||60);
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
const res=[]; const ok=(n,c,i='')=>{res.push(`${c?'PASS':'FAIL'} ${n} ${i}`);console.log(`${c?'PASS':'FAIL'} ${n} ${i}`);};
const info=(n,i)=>{res.push(`INFO ${n} ${i}`);console.log(`INFO ${n} ${i}`);};
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
window.__calm=()=>{const s=gengi.raid();gengi.god(true);gengi.clearEnemies();s.snap.stream=null;s.snap.spawnTimer=-1e9;gengi.move(0,0);gengi.aim(null);gengi.cfg31.ELITE.chance=0;
  if(!window.__hooked||window.__hookedScene!==s){window.__hooked=true;window.__hookedScene=s;s.events.on('update',()=>{s.idleT=0;s.snap.spawnTimer=Math.min(s.snap.spawnTimer,-1e6);});}};
window.__gt=()=>gengi.raid().snap.elapsed;
window.__waitGame=sec=>new Promise(r=>{const t0=__gt();const f=()=>{if(__gt()-t0>=sec)r();else setTimeout(f,20)};f();});
window.__tp=(x,y)=>{const s=gengi.raid();s.player.setPosition(x,y);s.vel.set(0,0);s.player.body.reset(x,y);};
`;
async function endRaid(){ await E(()=>{const s=gengi.raid();if(s&&!s.ended)s.host.endRaid('extraido',{exit:s.snap.exits[0]});}); await sleep(500); await E(()=>document.querySelectorAll('.overlay button, .card button').forEach(b=>{if(/Volver|Continuar|Refugio/i.test(b.textContent))b.click();})); await sleep(300); }
async function newRaid(seed=null){ await endRaid(); await E(sd=>{gengi.seedNext(sd);gengi.start();},seed); await sleep(1600); await p.waitForFunction(()=>gengi.raid()&&gengi.raid().hud,{timeout:20000}); await E(setup); await E(()=>{const s=gengi.raid();window.__pre={lair:s.enemies.list.filter(e=>e.lair&&e.alive!==false).map(e=>({tint:e.baseTint?.toString(16),type:e.def.type}))};}); await E(()=>__calm()); }

// ======================= A. Trazado: las 3 variantes nevadas =======================
const L=await E(n=>gengi.layoutCheck(n,false),NSEED);
for(const [id,a] of Object.entries(L)){
  ok(`A1 ${id}: todas las salidas (3 + helipuerto) alcanzables desde cada inicio`, a.exitFail===0&&a.spawnsChecked===a.raids*4, `raids ${a.raids} inicios ${a.spawnsChecked} fallos ${a.exitFail}`);
  ok(`A2 ${id}: la guarida nunca tapa una salida (se llega a todas sin cruzarla; ≥ 8 casillas)`, a.lairBlock===0&&a.lairMinTiles>=8, `bloqueos ${a.lairBlock} dist. mín. ${a.lairMinTiles.toFixed(1)}`);
  ok(`A3 ${id}: nada dentro de paredes ni fuera del mapa (inicio, contenedores, guarida, élite, portales, Trapero)`, a.bad===0, `${a.bad} ${a.badSample.join(' | ')} (Trapero en ${a.trapero})`);
  ok(`A4 ${id}: todos los contenedores alcanzables`, a.unreachableContainers===0, String(a.unreachableContainers));
  info(`A5 ${id} distancias (casillas)`, `inicio→nieve ${JSON.stringify(a.snow)} · inicio→helipuerto (camino) ${JSON.stringify(a.heli)}`);
}
{const v=Object.values(L);const sa=v.map(a=>a.snow.avg),ha=v.map(a=>a.heli.avg);
 const sp=Math.max(...sa)-Math.min(...sa), hp=(Math.max(...ha)-Math.min(...ha))/Math.min(...ha);
 ok('A6 distancias parecidas en las 3 variantes (nieve ±6 casillas, helipuerto ±15 %)', sp<=6&&hp<=0.15&&v.every(a=>a.snow.min>=22), `nieve medias ${sa.join('/')} · heli medias ${ha.join('/')} (±${(hp*100).toFixed(0)} %)`);}
{const S=await E(n=>gengi.layoutCheck(n,true),Math.max(20,NSEED>>1));
 const v=Object.values(S);
 ok('A7 variación de estrés (puertas con candado 35 %, interiores variables, contenedores movidos): salidas alcanzables y nada en paredes', v.every(a=>a.exitFail===0&&a.lairBlock===0&&a.bad===0), JSON.stringify(Object.fromEntries(Object.entries(S).map(([k,a])=>[k,{exitFail:a.exitFail,lairBlock:a.lairBlock,bad:a.bad,unreach:a.unreachableContainers}]))));}

// ======================= B. Mochilas (§1) =======================
{const r=await E(()=>{const V=gengi.v4();const lo=(bag,items=[])=>({arma:null,torso:null,cabeza:null,reserva:null,bolsillo:null,bolsilloExtra:[],espalda:bag?V.makeItem(bag,'comun'):null,mochila:items});
  const slots=Object.fromEntries([null,'rinonera','mochila_escolar','mochila_media','mochila_grande','mochila_anomala'].map(b=>[b??'ninguna',V.backpackSlots(lo(b))]));
  const rar=Object.fromEntries(['rinonera','mochila_escolar','mochila_media','mochila_grande','mochila_anomala'].map(b=>[b,V.makeItem(b,'reforzado').rarity]));
  const quick=Object.fromEntries([null,'mochila_escolar','mochila_media','mochila_grande','mochila_anomala'].map(b=>[b??'ninguna',V.quickSlots(lo(b))]));
  const use=V.useTimeMult(lo('mochila_grande'));
  const heavy=n=>Array.from({length:n},()=>V.makeItem('botiquin','comun',1));
  const wSmall=V.itemWeight(V.makeItem('vendaje','comun',1)),wMed=V.itemWeight(V.makeItem('botiquin','comun',1)),wArmor=V.itemWeight(V.makeItem('tablas','comun',1)),wStack=V.itemWeight(V.makeItem('mat_chatarra','comun',10));
  const w10=V.totalWeight(lo(null,heavy(10))),wAn=V.totalWeight(lo('mochila_anomala',heavy(10)));
  const sp=V.speedMult(lo(null,heavy(10))),spMax=V.speedMult(lo(null,heavy(40)));
  const n12=V.loadNoiseTiles(lo(null,heavy(12))),n13=V.loadNoiseTiles(lo(null,heavy(13))),n21=V.loadNoiseTiles(lo(null,heavy(21)));
  const free=V.freeItem('mochila_escolar');
  return {slots,rar,quick,use,wSmall,wMed,wArmor,wStack,w10,wAn,sp,spMax,n12,n13,n21,freeSell:V.canSell(free),freeW:V.totalWeight({...lo(null),espalda:free})};});
 ok('B1 casillas: bolsillos 6 · riñonera 8 · escolar 12 · senderismo 16 · táctica 20 · anómala 26', JSON.stringify(r.slots)==='{"ninguna":6,"rinonera":8,"mochila_escolar":12,"mochila_media":16,"mochila_grande":20,"mochila_anomala":26}', JSON.stringify(r.slots));
 ok('B2 rareza fija (Chatarra/Común/Reforzado/Militar/Anomalía)', JSON.stringify(Object.values(r.rar))==='["chatarra","comun","reforzado","militar","anomalia"]', JSON.stringify(r.rar));
 ok('B3 +1 consumible rápido con senderismo y táctica; táctica −15 % de tiempo de uso', r.quick.ninguna===1&&r.quick.mochila_escolar===1&&r.quick.mochila_media===2&&r.quick.mochila_grande===2&&r.quick.mochila_anomala===1&&Math.abs(r.use-0.85)<1e-9, JSON.stringify({q:r.quick,use:r.use}));
 ok('B4 peso del botín por tamaño (pequeño 0,3 · mediano 1, por unidad; las armaduras, su peso) y la anómala: el contenido pesa un 20 % menos (+1 la mochila)', Math.abs(r.wSmall-0.3)<1e-9&&Math.abs(r.wMed-1)<1e-9&&Math.abs(r.wArmor-3)<1e-9&&Math.abs(r.wStack-3)<1e-9&&Math.abs(r.w10-10)<1e-9&&Math.abs(r.wAn-9)<1e-9, JSON.stringify({s:r.wSmall,m:r.wMed,armor:r.wArmor,chatarra10:r.wStack,w10:r.w10,anomala:r.wAn}));
 ok('B5 lentitud −2 % por punto de peso, máx. −40 %', Math.abs(r.sp-0.8)<1e-9&&Math.abs(r.spMax-0.6)<1e-9, `${r.sp} ${r.spMax}`);
 ok('B6 ruido por carga: 12 → +0, 13 → +1, 21 → +2 casillas', r.n12===0&&r.n13===1&&r.n21===2, `${r.n12}/${r.n13}/${r.n21}`);
 ok('B7 la escolar gratuita no se puede vender y pesa 1', r.freeSell===false&&Math.abs(r.freeW-1)<1e-9, JSON.stringify({sell:r.freeSell,w:r.freeW}));}
{const r=await E(()=>{const V=gengi.v4();const ids=s=>s.filter(e=>/rinonera|mochila/.test(e.id)).map(e=>`${e.id}:${e.rarity}`);
  const lv1=ids(V.genStock('hierro',1)),lv4=ids(V.genStock('hierro',4));
  const rec=V.recipes.filter(x=>/^bag_/.test(x.id)).map(x=>`${x.out}@${x.station}${x.level}`);
  const price={r:V.buyPrice('rinonera','chatarra',1,1),m:V.buyPrice('mochila_media','reforzado',1,1),g:V.buyPrice('mochila_grande','militar',1,1),a:V.buyPrice('mochila_anomala','anomalia',1,1)};
  const rng=V.seededRng(5);let bags=0,cards=0;const N=20000;for(let i=0;i<N;i++){const it=V.rollItem(rng,0.3);if(V.cfg.BAGS[it.def])bags++;if(it.def==='tarjeta_helipuerto')cards++;}
  return {lv1,lv4,rec,price,bagShare:bags/N,cards};});
 ok('B8 Hierro vende riñonera y senderismo (rep. 1) y táctica (rep. 4), con su rareza', r.lv1.includes('rinonera:chatarra')&&r.lv1.includes('mochila_media:reforzado')&&!r.lv1.some(x=>/grande/.test(x))&&r.lv4.includes('mochila_grande:militar'), JSON.stringify({lv1:r.lv1,lv4:r.lv4}));
 ok('B9 el Taller fabrica riñonera (1), senderismo (2), táctica y anómala (3)', JSON.stringify(r.rec)==='["rinonera@taller1","mochila_media@taller2","mochila_grande@taller3","mochila_anomala@taller3"]', JSON.stringify(r.rec));
 ok('B10 precios fijos (no dependen de la rareza): 45 / 160 / 420 / 1400', r.price.r===45&&r.price.m===160&&r.price.g===420&&r.price.a===1400, JSON.stringify(r.price));
 ok('B11 las mochilas salen como botín (y la Tarjeta no sale en cajas normales)', r.bagShare>0.004&&r.bagShare<0.05&&r.cards===0, `mochilas ${(r.bagShare*100).toFixed(1)} %`);}

// ======================= C. Partida: mochila gratuita, quick2, quitar mochila, ruido de carga =======================
await E(()=>{gengi.chapas(5000);});
await newRaid();
{const r=await E(()=>{const s=gengi.raid();const lo=s.snap.loadout;return {bag:lo.espalda?.def,free:!!lo.espalda?.free,slots:gengi.v4().backpackSlots(lo),q2:s.hud.quick2.bg.visible};});
 ok('C1 sin mochila propia se entra con la escolar gratuita (12 casillas) y sin 2.º consumible rápido', r.bag==='mochila_escolar'&&r.free&&r.slots===12&&!r.q2, JSON.stringify(r));}
{const r=await E(async()=>{const s=gengi.raid();__calm();const lo=s.snap.loadout;gengi.give('mochila_grande','militar');gengi.give('vendaje','comun',3);gengi.give('botiquin','comun',1);
  const bag=lo.mochila.find(i=>i.def==='mochila_grande');s.invEquip(bag.uid);await __waitGame(0.2);
  const q2=s.hud.quick2.bg.visible,lbl1=s.hud.quick.label.text,lbl2=s.hud.quick2.label.text;const freeGone=!lo.mochila.some(i=>i.def==='mochila_escolar');
  s.snap.player.hp=40;s.player.setData?.('hp',40);const before=(id)=>lo.mochila.filter(i=>i.def===id).reduce((a,i)=>a+i.qty,0);
  const b0=before('botiquin'),v0=before('vendaje');s.hud.quick2.onTap();await __waitGame(0.2);
  const used2=(before('botiquin')<b0)||(before('vendaje')<v0)||s.applying;
  return {bag:lo.espalda?.def,q2,lbl1,lbl2,freeGone,used2,slots:gengi.v4().backpackSlots(lo)};});
 ok('C2 con la táctica: 20 casillas, botón del 2.º consumible (el otro curativo) y la escolar gratuita se descarta', r.bag==='mochila_grande'&&r.slots===20&&r.q2&&r.lbl1!==r.lbl2&&r.freeGone&&r.used2, JSON.stringify(r));}
{const r=await E(async()=>{const s=gengi.raid();__calm();const lo=s.snap.loadout;
  for(let i=0;i<12;i++)gengi.give('tablas','comun',1);const n=lo.mochila.length;s.invUnequip('espalda');const blocked=lo.espalda?.def==='mochila_grande';
  lo.mochila=lo.mochila.filter(i=>i.def!=='tablas');s.invUnequip('espalda');const off=!lo.espalda&&lo.mochila.some(i=>i.def==='mochila_grande');
  return {n,blocked,off,slots:gengi.v4().backpackSlots(lo)};});
 ok('C3 quitarse la mochila llena no se puede; vacía, va a los bolsillos (6 casillas)', r.blocked&&r.off&&r.slots===6, JSON.stringify(r));}
{const r=await E(async()=>{const s=gengi.raid();__calm();const lo=s.snap.loadout;const bag=lo.mochila.find(i=>i.def==='mochila_grande');s.invEquip(bag.uid);
  lo.torso=null;lo.mochila=lo.mochila.filter(i=>i.def!=='tablas');const w0=gengi.v4().totalWeight(lo);
  const move=async()=>{s.moveTier='andar';gengi.move(1,0);await __waitGame(0.3);const n=s.footNoise();gengi.move(0,0);return n;};
  const n0=await move();const add=Math.ceil(13-w0)+0;for(let i=0;i<add;i++)lo.mochila.push({uid:'qa-t'+i,def:'botiquin',rarity:'comun',qty:1});
  const w1=gengi.v4().totalWeight(lo);const n1=await move();for(let i=0;i<8;i++)lo.mochila.push({uid:'qa-u'+i,def:'botiquin',rarity:'comun',qty:1});const w2=gengi.v4().totalWeight(lo);const n2=await move();
  lo.mochila=lo.mochila.filter(i=>!/^qa-/.test(i.uid));return {w0,n0,w1,n1,w2,n2};});
 ok('C4 ir cargado hace ruido al andar: +1 casilla por encima de 12 de peso, +2 por encima de 20', r.n1===r.n0+1&&r.n2===r.n0+2&&r.w1>12&&r.w2>20, JSON.stringify(r));}
{const r=await E(()=>{const s=gengi.raid();return {mult:gengi.v4().useTimeMult(s.snap.loadout)};});
 ok('C5 la táctica acelera los consumibles un 15 %', Math.abs(r.mult-0.85)<1e-9, JSON.stringify(r));}

// ======================= D. Variantes nevadas en partida =======================
const variantsSeen=[];
for(let k=0;k<3;k++){
  const seed=await E(k=>gengi.snowSeed(k,1000+k*31),k);
  await newRaid(seed);
  const r=await E(async()=>{const s=gengi.raid();__calm();const m=s.map;const T=48;
    const heli=s.snap.exits.find(e=>e.type==='helipuerto');
    const lairE=window.__pre.lair;
    const snowTiles=s.children.list.filter(c=>(c.displayTexture??c.texture)?.key==='v4/suelo_nieve').length;
    const sr=m.regions.find(g=>g.id===m.snow.region).rects;const inSnow=(x,y)=>sr.some(r=>x>=r.x&&x<r.x+r.w&&y>=r.y&&y<r.y+r.h);
    // distancia inicio→nieve (recta)
    let d=1e9;for(const r of sr){const dx=Math.max(r.x-s.snap.player.x,0,s.snap.player.x-(r.x+r.w)),dy=Math.max(r.y-s.snap.player.y,0,s.snap.player.y-(r.y+r.h));d=Math.min(d,Math.hypot(dx,dy));}
    // enemigos ×1,3: un errante dentro de la nieve (centro de la guarida desplazado) frente a uno fuera, en el mismo minuto
    const c=sr[0];let pin=null;for(let i=0;i<60&&!pin;i++){const x=c.x+c.w*(0.3+0.4*Math.random()),y=c.y+c.h*(0.3+0.4*Math.random());if(s.snowy(x,y))pin={x,y};}
    const SE=gengi.cfg42?.SNOW_ENEMIES;if(SE)SE.enabled=false;const eIn=s.spawnAt('errante',pin.x,pin.y,undefined,false),eOut=s.spawnAt('errante',s.player.x+T*3,s.player.y,undefined,false);if(SE)SE.enabled=true;
    const ratio=eIn.maxHp/eOut.maxHp,dratio=eIn.dmg/eOut.dmg;
    // contenedores de la nieve: rarezas de equipo Común/Reforzado/Militar
    const snowConts=s.snap.containers.filter(x=>x.kind!=='elite'&&s.snowy(x.x,x.y));const rar=new Set();for(const x of snowConts)for(const it of x.items)if(gengi.defs().weapons[it.def]||/chaleco|casco|ropa/.test(it.def))rar.add(it.rarity);
    const lairBox=s.snap.containers.find(x=>x.kind==='elite'&&Math.hypot(x.x-m.snow.lair.cx,x.y-m.snow.lair.cy)<T*2);
    const zoneNames=s.children.list.filter(c=>c.type==='Text'&&/CABAÑAS|BOSQUE NEVADO|PLAZA HELADA|HOSPITAL HELADO|COMISARÍA HELADA|RADAR MILITAR|INVERNADERO|BLOQUE HELADO|APARCAMIENTO NEVADO|PRESA HELADA/.test(c.text)).map(c=>c.text);
    // aviso al entrar en la nieve
    __tp(pin.x,pin.y);await __waitGame(0.5);const toast=s.hud.msg.text;
    return {variant:m.variant,heli:heli?{loc:heli.loc,unlocked:heli.unlocked}:null,exits:s.snap.exits.map(e=>e.type),lair:lairE.length,lairTint:lairE[0]?.tint,lairType:lairE[0]?.type,snowTiles,snowDist:d/T,ratio,dratio,rar:[...rar],nSnowConts:snowConts.length,lairItems:lairBox?.items.map(i=>`${i.def}:${i.rarity}`),zoneNames,toast,spawnInSnow:inSnow(s.snap.player.x,s.snap.player.y)};});
  variantsSeen.push(r.variant);
  ok(`D1 ${r.variant}: helipuerto (salida extra, cerrada) + 2 salidas normales`, r.heli&&r.heli.loc===3&&!r.heli.unlocked&&r.exits.length===3&&r.exits.filter(t=>t!=='helipuerto').length===2, JSON.stringify({heli:r.heli,exits:r.exits}));
  ok(`D2 ${r.variant}: suelo nevado y nombres «nevados»; guarida con su guardián helado (v4.2: La Matriarca) y su botín`, r.snowTiles>0&&r.zoneNames.length>=2&&r.lair===1&&(r.lairTint==='9fd8ff'||r.lairType==='matriarca')&&r.lairItems&&r.lairItems.length>=3&&r.lairItems.some(x=>/:(militar|anomalia)$/.test(x)), JSON.stringify({tiles:r.snowTiles,names:r.zoneNames.slice(0,4),lair:r.lair,type:r.lairType,items:r.lairItems}));
  ok(`D3 ${r.variant}: enemigos de la nieve ×1,3 de vida y daño`, Math.abs(r.ratio-1.3)<0.01&&Math.abs(r.dratio-1.3)<0.01, `vida ×${r.ratio.toFixed(3)} daño ×${r.dratio.toFixed(3)}`);
  ok(`D4 ${r.variant}: botín de la nieve solo Común/Reforzado/Militar; aviso «Zona Helada» al entrar`, r.rar.every(x=>['comun','reforzado','militar'].includes(x))&&/Zona Helada/.test(r.toast), JSON.stringify({rar:r.rar,n:r.nSnowConts,toast:r.toast}));
  info(`D5 ${r.variant} inicio→nieve`, `${r.snowDist.toFixed(1)} casillas`);
}
ok('D6 se han jugado las 3 variantes', new Set(variantsSeen).size===3, variantsSeen.join(', '));

// ======================= E. Helipuerto con Tarjeta =======================
{const r=await E(async()=>{const s=gengi.raid();__calm();const ex=s.snap.exits.find(e=>e.type==='helipuerto');
  __tp(ex.x,ex.y);await __waitGame(0.3);const t0=s.lastExt?.text,a0=s.lastExt?.action?.label??null;
  gengi.give('tarjeta_helipuerto');await __waitGame(0.2);const a1=s.lastExt?.action?.label??null;
  const nl0=s.noiseLog.length;
  s.lastExt.action.run();const card=s.snap.loadout.mochila.some(i=>i.def==='tarjeta_helipuerto');await __waitGame(0.2);const t1=s.lastExt?.text;
  // te alejas: el helicóptero llega igual
  __tp(ex.x-48*12,ex.y+48*12);s.snap.elapsed+=20;await __waitGame(0.3);const midOpen=ex.unlocked;s.snap.elapsed+=11;await __waitGame(0.3);const open=ex.unlocked;
  __tp(ex.x,ex.y);await __waitGame(0.3);const t2=s.lastExt?.text;
  const noises=s.noiseLog.slice(nl0).filter(n=>n.r>=15&&Math.hypot(n.x-ex.x,n.y-ex.y)<5).length;
  return {t0,a0,a1,card,t1,midOpen,open,t2,noises};});
 ok('E1 helipuerto sin Tarjeta: no se puede; con Tarjeta: «Usar tarjeta» (se gasta)', /Tarjeta/.test(r.t0)&&r.a0===null&&r.a1==='Usar tarjeta'&&!r.card, JSON.stringify(r));
 ok('E2 el helicóptero tarda 30 s (aunque te alejes), hace ruido de 15 casillas y luego se extrae', /helicóptero llega/.test(r.t1)&&!r.midOpen&&r.open&&/Extrayendo/.test(r.t2)&&r.noises>=2, JSON.stringify({t1:r.t1,mid:r.midOpen,open:r.open,t2:r.t2,noises:r.noises}));
 const seen=await E(()=>gengi.seenExits());
 ok('E3 el helipuerto no se guarda como salida vista (cambia de sitio)', !(seen['arrabal-v4']??[]).includes(3), JSON.stringify(seen));}
{const r=await E(async()=>{const s=gengi.raid();for(let i=0;i<80&&!s.ended;i++)await new Promise(r=>setTimeout(r,250));return {ended:s.ended};});
 const log=await E(()=>gengi.state().raidLog?.[0]);
 ok('E4 extracción por el helipuerto', r.ended&&/extra/.test(JSON.stringify(log??{})), JSON.stringify({ended:r.ended,log:log&&{result:log.result,exit:log.exit}}));}

// ======================= F. Mapas por datos y Reliquia =======================
{const r=await E(()=>{const V=gengi.v4();const M=V.cfg.MAPS.map(m=>({id:m.id,lv:[m.nivelMin,m.nivelMax],dif:m.dificultad,rar:m.rarezas,boss:m.rarezaJefe,xp:m.xpMult,gen:m.generador}));const s=gengi.raid();return {M,cur:s?.mapDef?.id,saveId:s?.map?.id};});
 const want=[['arrabal',[1,9],1,['chatarra','militar'],'anomalia'],['via_muerta',[5,25],1.8,['comun','anomalia']],['crater',[15,40],3,['reforzado','reliquia']],['colmena',[30,null],5,['militar','reliquia']]];
 ok('F1 4 mapas por datos (niveles, dificultad, rarezas); el 1 es El Arrabal y se guarda como arrabal-v4', want.every((w,i)=>r.M[i].id===w[0]&&JSON.stringify(r.M[i].lv)===JSON.stringify(w[1])&&r.M[i].dif===w[2]&&JSON.stringify(r.M[i].rar)===JSON.stringify(w[3]))&&r.M[0].boss==='anomalia'&&r.M[0].gen==='arrabal', JSON.stringify(r.M));}

// ======================= G. Migración 4 → 5 =======================
await endRaid();
await E(()=>gengi.loadV4old(false)).catch(()=>{}); await sleep(1500); await p.waitForFunction(()=>window.gengi,{timeout:20000});
{const d=await E(()=>gengi.state());
 ok('G1 guardado v4 → 5 (→ 6): mochila escolar gratuita, salidas vistas copiadas a arrabal-v4 (sin helipuerto)', d.saveVersion>=5&&d.loadout.espalda?.def==='mochila_escolar'&&d.loadout.espalda.free&&JSON.stringify(d.seenExits['arrabal-v4'])==='[0,2]', JSON.stringify({v:d.saveVersion,bag:d.loadout.espalda,seen:d.seenExits}));}
await E(()=>gengi.loadV4old(true)).catch(()=>{}); await sleep(2500); await p.waitForFunction(()=>window.gengi,{timeout:20000});
{let r=null;try{await p.waitForFunction(()=>gengi.raid()&&gengi.raid().hud,{timeout:15000});r=await E(()=>{const s=gengi.raid();return {mapId:s.snap.mapId,bag:s.snap.loadout.espalda?.def,exits:s.snap.exits.map(e=>e.loc+':'+e.type),hp:s.snap.player.hp,inWall:false};});}catch(e){r={err:String(e)};}
 ok('G2 raid activa del mapa viejo: se repuebla en El Arrabal con la mochila gratuita', r&&r.mapId==='arrabal-v4'&&r.bag==='mochila_escolar', JSON.stringify(r));}

const real=errs.filter(e=>!/favicon|404/.test(e));
ok('Z sin errores de página', real.length===0, real.slice(0,5).join(' | '));
await b.close();
const fails=res.filter(x=>x.startsWith('FAIL')).length;
console.log(`${res.filter(x=>x.startsWith('PASS')).length} PASS, ${fails} FAIL`);
process.exit(fails?1:0);
