// QA v3 (diseno-v3.md §1-§6): economía sin arbitraje, refugio, bolsillos, materiales, vendedores, misiones,
// enemigos nuevos con sus reglas de justicia, mutaciones, consumibles nuevos y migraciones v1/v2 → v3.
// node qa/v3.mjs (con `npx vite preview --port 4173` en marcha)
import puppeteer from 'puppeteer-core';
const URL=(process.env.GENGI_BASE||'http://localhost:4173/')+'?debug=1&noelite';
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
window.T=48;
window.__calm=()=>{const s=gengi.raid();gengi.god(true);gengi.clearEnemies();s.snap.stream=null;s.snap.spawnTimer=-1e9;gengi.move(0,0);gengi.aim(null);
  if(!window.__hooked){window.__hooked=true;window.__pins=new Map();s.events.on('update',()=>{s.idleT=0;s.snap.spawnTimer=Math.min(s.snap.spawnTimer,-1e6);for(const [e,pos] of window.__pins){if(!e.dead&&e.body){e.body.reset(pos.x,pos.y);}}});}
  window.__pins.clear();};
window.__gt=()=>gengi.raid().snap.elapsed;
window.__waitGame=sec=>new Promise(r=>{const t0=__gt();const f=()=>{if(__gt()-t0>=sec)r();else setTimeout(f,30)};f();});
window.__open=(r=7)=>{const s=gengi.raid();let o=null;for(let k=r;k>=2&&!o;k--)o=s.openSpot(k);s.player.setPosition(o.x,o.y);s.vel.set(0,0);s.player.body.reset(o.x,o.y);return o;};
window.__resetStats=()=>{const s=gengi.raid();const st=s.enemies.v3.stats;for(const k in st)st[k]=(k.endsWith('Min')?99:0);s.enemies.teleStats.on=0;s.enemies.teleStats.off=0;};
`;

// ================= A. Economía (§6): prueba exhaustiva anti-arbitraje =================
{const r=await E(()=>gengi.econ(80));
 ok('A1 ningún objeto se vende por más del 40 % de su precio de compra más bajo (todas tiendas, rep 1-4, rarezas, cantidades, stock real con rasgos)', r.nBad===0&&r.worstRatio<=0.4, `combos=${r.checked} stock=${r.stockSeen} peor=${r.worstRatio} malos=${r.nBad} ${r.bad.slice(0,3).join('; ')}`);
 ok('A1 ninguna receta usa algo comprable (no hay bucle comprar→fabricar→vender)', r.craftLoops.length===0, JSON.stringify(r.craftLoops));}
{const r=await E(()=>{const d=gengi.state();const out={};
  gengi.chapas(100000);
  const st=gengi.state().vendors;out.vendors=Object.keys(st);
  // comprar y revender lo mismo: siempre pierdes
  let loss=[];for(const v of ['doc','chispas','hierro']){for(let i=0;i<gengi.state().vendors[v].stock.length&&i<4;i++){const c0=gengi.state().chapas;const b=gengi.op('buyStock',v,i);if(!b.ok)continue;const c1=gengi.state().chapas;const st=gengi.state().stash;const it=st[st.length-1];let best=0;for(const w of ['doc','chispas','hierro']){const before=gengi.state().chapas;const s2=gengi.op('sellTo',w,it.uid);if(s2.ok){best=gengi.state().chapas-before;break;}}loss.push({v,id:it.def,paid:c0-c1,got:best});}}
  out.loss=loss;
  // reputación: subir XP baja precios y amplía stock
  const p1=gengi.state().vendors.doc.stock.length;gengi.repXp('doc',1700);gengi.missions('doc',2);const s4=gengi.state().vendors.doc;out.docStock=[p1,s4.stock.length];out.rep4Level=s4.stockLevel;
  gengi.repXp('chispas',1700);gengi.missions('chispas',2);out.chispasMil=gengi.state().vendors.chispas.stock.filter(e=>e.rarity==='militar').map(e=>e.traits?.length??0);
  return out;});
 ok('A2 comprar y revender siempre pierde chapas (los 3 vendedores)', r.loss.length>=6&&r.loss.every(x=>x.got<x.paid&&x.got<=0.4*x.paid+1), JSON.stringify(r.loss.slice(0,6)));
 ok('A2 reputación 4: stock de Doc más amplio (antídoto/estimulante) y renovado al subir', r.docStock[1]>r.docStock[0]&&r.rep4Level===4, JSON.stringify(r.docStock));
 ok('A2 Chispas rep. 4: arma Militar con rasgo extra', r.chispasMil.some(n=>n>=3), JSON.stringify(r.chispasMil));}

// ================= B. Refugio: estaciones, alijo, bolsillo, fabricación =================
{const r=await E(()=>{const out={};const lv=()=>gengi.state().refugio.levels;
  gengi.give('mat_chatarra','comun',20);gengi.give('mat_chatarra','comun',20);gengi.give('mat_tela','comun',20);gengi.give('mat_tela','comun',20);gengi.give('mat_componentes','comun',20);gengi.give('mat_componentes','comun',20);gengi.give('mat_componentes','comun',20);gengi.give('mat_combustible','comun',20);gengi.give('mat_muestra','comun',10);gengi.chapas(20000);
  out.blocked=gengi.op('upgrade','alijo');
  out.gen2=gengi.op('upgrade','generador');out.alijo2=gengi.op('upgrade','alijo');out.alijo3blocked=gengi.op('upgrade','alijo');
  out.gen3=gengi.op('upgrade','generador');out.alijo3=gengi.op('upgrade','alijo');out.alijoMax=gengi.op('upgrade','alijo');
  out.bol2=gengi.op('upgrade','bolsillo');out.bol3=gengi.op('upgrade','bolsillo');
  out.stash=gengi.op('stashSlots');out.pocket=gengi.op('pocketSlots');
  out.enf=[gengi.op('upgrade','enfermeria'),gengi.op('upgrade','enfermeria')];out.tal=[gengi.op('upgrade','taller'),gengi.op('upgrade','taller')];out.rad=[gengi.op('upgrade','radio'),gengi.op('upgrade','radio')];
  out.levels=lv();
  // fabricar: 3 raids, cola máx 2 por estación
  out.c1=gengi.op('craft','vendajes');out.c2=gengi.op('craft','adrenalina');out.c3=gengi.op('craft','botiquin');
  const v0=gengi.state().stash.filter(i=>i.def==='vendaje').reduce((s,i)=>s+i.qty,0);
  out.after2=gengi.endRaids(2);out.after3=gengi.endRaids(1);
  out.vend=gengi.state().stash.filter(i=>i.def==='vendaje').reduce((s,i)=>s+i.qty,0)-v0;
  out.adr=gengi.state().stash.some(i=>i.def==='adrenalina');
  // rasgo extra del Taller 3
  gengi.give('pistola','reforzado',1);const it=gengi.state().stash.find(i=>i.def==='pistola'&&i.rarity==='reforzado');
  out.trait=gengi.op('addTrait',it?.uid?gengi.state().stash.find(i=>i.uid===it.uid):null);
  return out;});
 ok('B1 Generador manda: sin él no sube nada a nivel 2', !r.blocked.ok&&/Generador/.test(r.blocked.msg), r.blocked.msg);
 ok('B1 6 estaciones × 3 niveles', r.gen2.ok&&r.gen3.ok&&r.alijo3.ok&&!r.alijoMax.ok&&['alijo','bolsillo','generador','enfermeria','taller','radio'].every(k=>r.levels[k]===3)&&Object.keys(r.levels).length>=6, JSON.stringify(r.levels)); // v4.0: + Gimnasio y Pizarra (qa/levels.mjs)
 ok('B1 Alijo 30→70, Bolsillo 1→4', r.stash===70&&r.pocket===4, `alijo=${r.stash} bolsillo=${r.pocket}`);
 ok('B2 fabricar tarda 3 raids y la cola es de 2 por estación', r.c1.ok&&r.c2.ok&&!r.c3.ok&&r.after2.length===0&&r.after3.length===2&&r.vend===2&&r.adr, JSON.stringify({c3:r.c3.msg,after2:r.after2,after3:r.after3,vend:r.vend}));}

// ================= C. Raid: bolsillos ×4, mochila de espalda, materiales, alcantarillas, radio =================
{await E(()=>{gengi.give('mochila_grande','comun',1);gengi.equipFromStash('mochila_grande');});
 await E(()=>gengi.start()); await sleep(1500); await E(setup); await E(()=>__calm());
 const r=await E(async()=>{const s=gengi.raid();const v=gengi.v3();const out={pocketSlots:v.pocketSlots,backpack:v.backpack,mats:v.mats,trunks:v.trunks,sewers:v.sewers,toast:s.hud?.lastToast??null,seen:s.seenExitList?.()};
  const matConts=s.snap.containers.filter(c=>c.items.some(i=>i.def.startsWith('mat_'))).length;out.matConts=matConts;
  for(const id of ['vendaje','bengala','municion','antidoto','granada'])gengi.give(id,'comun',1);
  const lo=s.snap.loadout;for(const id of ['vendaje','bengala','antidoto','granada','municion']){const it=lo.mochila.find(i=>i.def===id);if(it)s.invToPocket(it.uid);}
  out.pockets=[lo.bolsillo?.def,...(lo.bolsilloExtra??[]).map(i=>i.def)];
  // la bengala del bolsillo extra cuenta para la salida de bengala
  out.flare=s.extraction.ctx?.hasFlare?.()??null;
  // quitarse la mochila grande con más cosas de las que caben: se bloquea
  for(let i=0;i<14;i++)gengi.give('mat_chatarra','comun',20);
  const full=lo.mochila.length;s.invUnequip('espalda');out.unequipBlocked=!!lo.espalda;out.full=full;
  return out;});
 ok('C1 bolsillo seguro de 4 casillas en la raid (Bolsillo nivel 3)', r.pocketSlots===4&&r.pockets.filter(Boolean).length===4, JSON.stringify(r.pockets));
 ok('C1 mochila grande: +8 casillas', r.backpack>=16, `casillas=${r.backpack}`);
 ok('C1 no te puedes quitar una mochila llena', r.unequipBlocked&&r.full>8, `mochila=${r.full}`);
 ok('C2 materiales en contenedores y maleteros de coche', r.mats>20&&r.trunks>0&&r.matConts>10, JSON.stringify({mats:r.mats,trunks:r.trunks,conts:r.matConts}));
 ok('C2 14 alcantarillas por mapa', r.sewers===14, `n=${r.sewers}`);
 ok('C3 Radio nivel 2: una salida activa ya descubierta al empezar', (r.seen??[]).length>=1, JSON.stringify(r.seen));}

// ================= D. Enemigos nuevos: reglas de justicia =================
// D1 Escupidor: solo escupe si está en pantalla Y dentro de tu cono
{const r=await E(async()=>{const s=gengi.raid();__calm();__open(8);__resetStats();const out={};
  // de espaldas (mirando al sur, escupidor al norte, en pantalla) → no escupe
  const i=gengi.raid().spawnAt('escupidor',s.player.x,s.player.y-5*T);s.enemies.becomeAlert(i,false);window.__pins.set(i,{x:i.x,y:i.y});
  const fz=()=>{gengi.face(90);};s.events.on('update',fz);
  await __waitGame(4);out.behind={spits:s.enemies.v3.stats.spits,aborts:s.enemies.v3.stats.spitAborts,windups:s.enemies.v3.stats.spitWindups};
  s.events.off('update',fz);const fw=()=>{gengi.face(-90);};s.events.on('update',fw);
  await __waitGame(4);s.events.off('update',fw);
  out.front={spits:s.enemies.v3.stats.spits,off:s.enemies.v3.stats.spitsOff,hits:s.enemies.v3.stats.ballHits};
  out.ballDepth=s.enemies.v3.balls[0]?.img.depth??null;
  return out;});
 ok('D1 Escupidor fuera de tu cono: no escupe', r.behind.spits===0, JSON.stringify(r.behind));
 ok('D1 Escupidor dentro del cono: escupe, nunca fuera de pantalla', r.front.spits>0&&r.front.off===0, JSON.stringify(r.front));}
// D2 Acechador: borde rojo 0,8 s y revelado 0,6 s antes de golpear, siempre
{const r=await E(async()=>{const s=gengi.raid();__calm();__open(8);__resetStats();
  const e=s.spawnAt('acechador',s.player.x+6*T,s.player.y);s.enemies.becomeAlert(e,false);
  let maxRed=0;const t0=__gt();let seenInvisible=false;
  while(__gt()-t0<14){maxRed=Math.max(maxRed,s.hud.lastVignette.maxRed);if(e.state==='chase'&&e.rig.c.alpha<0.5)seenInvisible=true;gengi.face(((__gt()*90)%360));await new Promise(r=>setTimeout(r,25));}
  return {st:{...s.enemies.v3.stats},maxRed,seenInvisible};});
 ok('D2 Acechador ataca (emboscadas)', r.st.ambushes>0, JSON.stringify({a:r.st.ambushes,h:r.st.ambushHits}));
 ok('D2 Acechador: siempre borde rojo ≥0,8 s y visible ≥0,6 s antes del golpe', r.st.ambushNoPulse===0&&r.st.ambushNoReveal===0&&r.st.pulseMin>=0.79&&r.st.revealMin>=0.59, JSON.stringify({pulse:r.st.pulseMin,reveal:r.st.revealMin,noP:r.st.ambushNoPulse,noR:r.st.ambushNoReveal}));
 ok('D2 Acechador: casi invisible mientras acecha; latido fuerte en el borde', r.seenInvisible&&r.maxRed>1, JSON.stringify({inv:r.seenInvisible,maxRed:r.maxRed}));}
// D3 Bruto: blindado de frente ×0,3
{const r=await E(async()=>{const s=gengi.raid();__calm();__open(8);
  const e=s.spawnAt('bruto',s.player.x+3*T,s.player.y);e.facing=Math.PI;e.hp=e.maxHp=1000;window.__pins.set(e,{x:e.x,y:e.y});
  const h0=e.hp;s.dealDamage(e,20,0,'qa',false,0);const front=h0-e.hp;
  e.facing=0;e.state='idle';const h1=e.hp;s.dealDamage(e,20,0,'qa',false,0);const back=h1-e.hp;
  return {front,back};});
 ok('D3 Bruto: de frente recibe ×0,3, por detrás daño completo', Math.abs(r.front/r.back-0.3)<0.05, JSON.stringify(r));}
{const r=await E(async()=>{const s=gengi.raid();__calm();__open(8);__resetStats();
  const e=s.spawnAt('bruto',s.player.x+5*T,s.player.y);s.enemies.becomeAlert(e,false);
  const t0=__gt();while(__gt()-t0<14){gengi.face(0);await new Promise(r=>setTimeout(r,40));}
  return {st:s.enemies.v3.stats,tele:s.enemies.teleStats};});
 ok('D3 Bruto: golpes/cargas con aviso, nunca fuera de pantalla', r.st.slams+r.st.charges>0&&r.tele.off===0, JSON.stringify({s:r.st.slams,c:r.st.charges,tele:r.tele}));}
// D4 Reptante: agarre 2 s, inmunidad 4 s, mientras te agarra los demás hacen la mitad
{const r=await E(async()=>{const s=gengi.raid();__calm();__open(8);__resetStats();gengi.god(false);s.snap.player.hp=100;
  const __D=gengi.cfg31.DAMAGE.enemy,__bk={...__D};Object.assign(__D,{minFrac:1,maxFrac:1,critChance:0});
  gengi.reptante(1.2,0);const t0=__gt();let grabbedAt=null,releasedAt=null;
  while(__gt()-t0<6){const g=s.enemies.v3.grab;if(g&&grabbedAt===null){grabbedAt=__gt();
      // otro golpe mientras te agarra: mitad
      const h=s.snap.player.hp;s.damagePlayer(20,'Errante');window.__half=h-s.snap.player.hp;s.snap.player.hp=100;}
    if(!g&&grabbedAt!==null&&releasedAt===null){releasedAt=__gt();window.__imm=s.enemies.v3.grabImm;}await new Promise(r=>setTimeout(r,20));}
  const h=s.snap.player.hp;s.damagePlayer(20,'Errante');const full=h-s.snap.player.hp;s.snap.player.hp=100;Object.assign(__D,__bk);
  const imm=window.__imm;
  // con inmunidad, un Reptante al lado no agarra (se pone justo tras soltarte)
  s.enemies.v3.grabImm=4;gengi.reptante(-1.2,0);await __waitGame(3.2);
  const st=s.enemies.v3.stats;gengi.god(true);
  return {grabs:st.grabs,dur:releasedAt&&grabbedAt?releasedAt-grabbedAt:null,half:window.__half,full,imm,during:st.grabsDuringImm,warn:st.grabWarnMin,halved:st.grabHalved};});
 ok('D4 Reptante: aviso de burbujas ≥1 s, agarra ~2 s', r.grabs>=1&&r.dur>1.6&&r.dur<2.5&&r.warn>=0.95, JSON.stringify(r));
 ok('D4 mientras te agarra, el resto hace la mitad', r.half>0&&Math.abs(r.half/r.full-0.5)<0.06, `mitad=${r.half?.toFixed?.(2)} normal=${r.full?.toFixed?.(2)}`);
 ok('D4 4 s de inmunidad a agarres tras soltarte', Math.abs(r.imm-4)<0.1&&r.during===0&&r.grabs===1, JSON.stringify({imm:r.imm,grabs:r.grabs,during:r.during}));}
// D5 Enjambre: mancha oscura + borde que vibra antes de morder
{const r=await E(async()=>{const s=gengi.raid();__calm();__open(8);__resetStats();
  const n=gengi.swarm(0,-11);for(const e of s.enemies.list)s.enemies.becomeAlert(e,false);let edge=0,patch=false;const t0=__gt();
  while(__gt()-t0<10){edge=Math.max(edge,s.hud.lastVignette.swarm);if(s.enemies.v3['patches']?.size)patch=true;gengi.face(180);await new Promise(r=>setTimeout(r,30));}
  return {n,st:s.enemies.v3.stats,edge,patch,tele:s.enemies.teleStats};});
 ok('D5 Enjambre de 8-12 bichos', r.n>=8&&r.n<=12, `n=${r.n}`);
 ok('D5 Enjambre: mancha + borde que vibra antes de morder, ningún mordisco sin aviso', r.st.bites>0&&r.st.bitesNoCue===0&&r.edge>0&&r.patch, JSON.stringify({b:r.st.bites,noCue:r.st.bitesNoCue,cue:r.st.cueMin,edge:r.edge,patch:r.patch}));}
// D6 Chillón: grito con aviso en pantalla, atrae y trae horda
{const r=await E(async()=>{const s=gengi.raid();__calm();__open(8);__resetStats();
  const e=s.spawnAt('chillon',s.player.x,s.player.y-6*T);s.enemies.becomeAlert(e,false);
  const t0=__gt();while(__gt()-t0<8&&!s.enemies.v3.stats.screams){gengi.face(-90);await new Promise(r=>setTimeout(r,30));}
  const v=gengi.v3();return {st:s.enemies.v3.stats,horde:v.screamsSpawned,localMult:v.localMult,screams:v.screams};});
 ok('D6 Chillón: grita con 1,2 s de aviso en pantalla, trae horda y +60 % de aparición local', r.st.screams>0&&r.st.screamsOff===0&&r.horde>=4&&r.localMult>1.5&&r.screams>0, JSON.stringify({sc:r.st.screams,off:r.st.screamsOff,horde:r.horde,mult:r.localMult}));}
// D7 Mezcla larga con todos los tipos: ningún aviso fuera de pantalla
{const r=await E(async()=>{const s=gengi.raid();__calm();__open(8);__resetStats();gengi.minute(9);
  for(const [t,dx,dy] of [['escupidor',6,0],['chillon',-7,2],['acechador',0,6],['bruto',-5,-4],['errante',4,4],['corredor',-6,-6]]){const e=s.spawnAt(t,s.player.x+dx*T,s.player.y+dy*T);s.enemies.becomeAlert(e,false);}
  gengi.swarm(-12,0);gengi.reptante(3,3);
  const t0=__gt();let k=0;while(__gt()-t0<30){k++;const a=(k*0.07);gengi.move(Math.cos(a)*0.8,Math.sin(a)*0.8);if(k%40===0)gengi.face(Math.random()*360);await new Promise(r=>setTimeout(r,40));}
  gengi.move(0,0);return {st:s.enemies.v3.stats,tele:s.enemies.teleStats,types:gengi.v3().types};});
 ok('D7 mezcla de todos durante 30 s: 0 avisos fuera de pantalla', r.tele.off===0&&r.st.spitsOff===0&&r.st.screamsOff===0&&r.st.bitesNoCue===0&&r.st.ambushNoPulse===0&&r.st.ambushNoReveal===0&&r.st.grabsDuringImm===0, JSON.stringify({tele:r.tele,st:r.st}));}

// ================= E. Mutaciones =================
{const r=await E(async()=>{const s=gengi.raid();__calm();__open(8);gengi.minute(12);const out={};
  const mk=(m)=>{const e=s.spawnAt('errante',s.player.x+6*T,s.player.y);const hp=e.maxHp,sp=e.speedK;s.enemies.mutate(e,m);return {e,hp,sp};};
  const b=mk('blindado');out.blind=b.e.maxHp/b.hp;out.aura=!!b.e.rig.aura;
  const v=mk('veloz');out.veloz=v.e.speedK;
  const r=mk('regenerador');r.e.hp=r.e.maxHp*0.5;r.e.lastHitAt=__gt();const h0=r.e.hp;await __waitGame(4.5);out.regen=r.e.hp>h0;
  const x=mk('volatil');x.e.hp=1;s.dealDamage(x.e,50,0,'qa',false,0);out.volatil=s.enemies.list.includes(x.e)&&x.e.state==='swell'||x.e.swelling||false;out.volState=x.e.state;
  out.excluded=s.enemies.mutate(s.spawnAt('enjambre',s.player.x+9*T,s.player.y),'veloz');
  // ritmo natural desde el minuto 10
  gengi.clearEnemies();for(let i=0;i<60;i++)s.spawnAt('errante',s.player.x+(8+Math.random()*4)*T,s.player.y+(Math.random()-0.5)*8*T);
  out.natural=s.enemies.list.filter(e=>e.mut).length;out.kinds=[...new Set(s.enemies.list.filter(e=>e.mut).map(e=>e.mut))];
  out.toast=s.warnedMut;gengi.clearEnemies();return out;});
 ok('E1 Blindado +60 % vida, Veloz +40 % velocidad, con aura', Math.abs(r.blind-1.6)<0.01&&Math.abs(r.veloz-1.4)<0.01&&r.aura, JSON.stringify({b:r.blind,v:r.veloz,aura:r.aura}));
 ok('E1 Regenerador se cura si no le pegas 3 s; Volátil se hincha y explota al morir', r.regen&&(r.volatil||r.volState==='swell'), JSON.stringify({regen:r.regen,vol:r.volState}));
 ok('E1 Enjambre/Reptante/jefe no mutan', r.excluded===false||r.excluded===undefined, String(r.excluded));
 ok('E2 desde el minuto 10 ~20-35 % de los nuevos salen mutados, de varios tipos, con aviso', r.natural>=6&&r.natural<=30&&r.kinds.length>=3&&r.toast, JSON.stringify({n:r.natural,kinds:r.kinds}));}

// ================= F. Consumibles nuevos =================
{const r=await E(async()=>{const s=gengi.raid();__calm();__open(8);const out={};
  for(const id of ['adrenalina','antidoto','estimulante','granada'])gengi.give(id,'comun',1);
  gengi.useFx('antidoto');s.addStatus('poison',2);out.poisonImmune=!(s.snap.player.poison?.length);
  gengi.move(1,0);await __waitGame(0.6);const v0=Math.hypot(s.vel.x,s.vel.y);gengi.useFx('adrenalina');await __waitGame(0.6);const v1=Math.hypot(s.vel.x,s.vel.y);gengi.move(0,0);out.adr=v1/v0;
  gengi.god(false);s.snap.player.hp=100;const h=100;s.damagePlayer(20,'Errante');out.adrDmg=h-s.snap.player.hp;s.snap.player.hp=100;gengi.god(true);
  gengi.useFx('estimulante');out.estim=s.snap.fx.estim>20;
  __open(8);const e=s.spawnAt('errante',s.player.x+4*T,s.player.y);window.__pins.set(e,{x:e.x,y:e.y});gengi.face(0);const hp0=e.hp;gengi.grenade();await __waitGame(1.4);out.gren=hp0-e.hp;out.grenDead=e.dead;
  const v=gengi.v3();out.grenades=v.grenades;out.track=v.track;return out;});
 ok('F1 Antídoto: inmune al veneno', r.poisonImmune);
 ok('F1 Adrenalina: +25 % velocidad y -30 % daño', Math.abs(r.adr-1.25)<0.06&&r.adrDmg<20*0.75, JSON.stringify({v:r.adr,dmg:r.adrDmg}));
 ok('F1 Estimulante activo 25 s', r.estim);
 ok('F1 Granada: aviso, mecha 1 s y 45 de daño en área (×variación v3.1 0,72-1,04, crítico ×1,5)', r.grenades===1&&(r.gren>=45*0.72-0.5||r.grenDead), JSON.stringify({d:r.gren,dead:r.grenDead}));}

// ================= G. Misiones (registro de la raid) =================
{const r=await E(async()=>{const s=gengi.raid();__calm();__open(8);
  const e=s.spawnAt('errante',s.player.x+1*T,s.player.y);e.hp=1;s.dealDamage(e,5,0,'bate',false,0);
  const t=gengi.v3().track;return t;});
 ok('G1 el registro de la raid cuenta muertes por tipo/arma y daño recibido', r&&r.kills&&Object.keys(r.kills).length>0&&r.dmgTaken>0, JSON.stringify(r));}
{const r=await E(async()=>{const d=gengi.state();const v='doc';const offer=d.vendors[v].offers[0];const a=gengi.op('acceptMission',v,offer);gengi.kill();await new Promise(r=>setTimeout(r,2500));const d2=gengi.state();return {a,active:d2.vendors[v].active,offer,raids:d2.stats.raids};});
 ok('G2 aceptar misión y que siga activa tras una raid', r.a.ok&&r.active===r.offer, JSON.stringify(r));}

// ================= H. Migraciones =================
await p.close(); p=await page();
{await E(()=>gengi.loadLegacy()).catch(()=>{}); await sleep(1500); await p.waitForFunction(()=>window.gengi);
 const r=await E(()=>{const d=gengi.state();return {v:d.saveVersion,chapas:d.chapas,stash:d.stash.map(i=>i.def),ref:d.refugio?.levels,vend:Object.keys(d.vendors||{}),esp:d.loadout.espalda,ex:d.loadout.bolsilloExtra};});
 ok('H1 v1 (prototipo) → v4: conserva chapas y alijo, refugio a nivel 1 y vendedores', r.v>=4&&r.chapas>=77&&r.stash.includes('machete')&&r.ref?.alijo===1&&r.vend.length===3&&(r.esp===null||r.esp?.free===true)&&Array.isArray(r.ex), JSON.stringify(r));}
{await E(()=>gengi.loadV2()).catch(()=>{}); await sleep(1500); await p.waitForFunction(()=>window.gengi);
 const r=await E(()=>{const d=gengi.state();return {v:d.saveVersion,chapas:d.chapas,stash:d.stash.map(i=>i.def+'/'+i.rarity),arma:d.loadout.arma?.def,bol:d.loadout.bolsillo?.def,seen:d.seenExits,log:d.raidLog.length,raids:d.stats.raids,ref:d.refugio?.levels,vend:Object.keys(d.vendors||{})};});
 ok('H2 v2 → v4: conserva todo (chapas, alijo, equipo, bolsillo, salidas vistas, historial, estadísticas)', r.v>=4&&r.chapas>=345&&r.stash.includes('pistola/militar')&&r.arma==='machete'&&r.bol==='botiquin'&&r.seen.m1?.length===2&&r.log===1&&r.raids===7&&r.ref?.bolsillo===1&&r.vend.length===3, JSON.stringify(r));}

ok('Z sin errores de página', errs.length===0, errs.slice(0,5).join(' | '));
await b.close();
const f=res.filter(x=>x.startsWith('FAIL')).length;console.log(`\n${res.length-f}/${res.length} PASS`);process.exit(f?1:0);
