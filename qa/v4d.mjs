// QA v4d (diseno-v4 §7): rangos de mapas, sin tope de experiencia, presión al final (escalado, cazadores, niebla ×2),
// armas a distancia sin disparo automático, flechas compartidas + migración, escopeta, habilidades temporales,
// HUD (munición, curas fijas, arco de habilidades) y niebla v2 (máscara continua, independiente de los fps).
// node qa/v4d.mjs [url]
import puppeteer from 'puppeteer-core';
const BASE=process.argv[2]||process.env.GENGI_BASE||'http://localhost:4178/';
const URL=BASE+'?debug=1';
const SHOTS=process.env.GENGI_SHOTS||'/workspace/gengi/shots';
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
if(!window.Phaser)window.Phaser={Math:{DegToRad:d=>d*Math.PI/180,RadToDeg:r=>r*180/Math.PI,Angle:{Wrap:a=>{a=((a+Math.PI)%(2*Math.PI)+2*Math.PI)%(2*Math.PI)-Math.PI;return a;}}}};
window.__calm=()=>{const s=gengi.raid();gengi.god(true);gengi.clearEnemies();s.snap.stream=null;s.snap.spawnTimer=-1e9;gengi.move(0,0);gengi.aim(null);gengi.cfg31.ELITE.chance=0;s.snap.xp=0;s.snap.xpBy={};
  if(!window.__hooked||window.__hookedScene!==s){window.__hooked=true;window.__hookedScene=s;window.__pins=new Map();s.events.on('update',()=>{s.idleT=0;s.snap.spawnTimer=Math.min(s.snap.spawnTimer,-1e6);for(const [e,pos] of window.__pins){if(!e.dead&&e.body){e.body.reset(pos.x,pos.y);}}if(window.__spin){window.__spin.a+=window.__spin.w*s.game.loop.delta/1000;s.facing=window.__spin.a;}});}
  window.__pins.clear();window.__spin=null;};
window.__gt=()=>gengi.raid().snap.elapsed;
window.__waitGame=sec=>new Promise(r=>{const t0=__gt();const f=()=>{if(__gt()-t0>=sec)r();else setTimeout(f,20)};f();});
window.__open=(r=7)=>{const s=gengi.raid();let o=null;for(let k=r;k>=2&&!o;k--)o=s.openSpot(k);s.player.setPosition(o.x,o.y);s.vel.set(0,0);s.player.body.reset(o.x,o.y);return o;};
window.__dummy=(type,dx,dy,f,hp,state)=>{const s=gengi.raid();const x=s.player.x+dx*T,y=s.player.y+dy*T;const e=s.spawnAt(type,x,y,undefined,false);e.state=state||'idle';e.meter=0;e.facing=f??0;e.turnT=1e9;e.wander?.set(0,0);if(hp){e.hp=e.maxHp=hp;}window.__pins.set(e,{x,y,f});return e;};
window.__arm=(id,ammo,qty)=>{const s=gengi.raid();const lo=s.snap.loadout;lo.mochila=lo.mochila.filter(i=>!['municion','flechas','virotes','cartuchos'].includes(i.def));
  const w=gengi.v4d().items[id].weapon;const it={uid:'qa-'+id+Math.random().toString(36).slice(2,6),def:id,rarity:'comun',qty:1};if(w.mag)it.mag=w.mag;lo.arma=it;
  if(ammo&&qty)lo.mochila.push({uid:'qa-am-'+ammo,def:ammo,rarity:'comun',qty});s.attackT=0;s.swapT=0;s.snap.player.reload=0;s.host.refreshInventory();return it;};
`;
async function endRaid(){ await E(()=>{const s=gengi.raid();if(s&&!s.ended)s.host.endRaid('extraido',{exit:s.snap.exits[0]});}); await sleep(500); await E(()=>document.querySelectorAll('.overlay button, .card button').forEach(b=>{if(/Volver|Continuar|Refugio/i.test(b.textContent))b.click();})); await sleep(300); }
async function newRaid(seed=null){ await endRaid(); await E(sd=>{gengi.seedNext(sd);gengi.start();},seed); await sleep(1600); await p.waitForFunction(()=>gengi.raid()&&gengi.raid().hud,{timeout:20000}); await E(setup); }
async function waitRaid(){ for(let i=0;i<80;i++){await sleep(250);if(await E(()=>!!(window.gengi&&gengi.raid()&&gengi.raid().snap&&gengi.raid().hud)).catch(()=>false))return true;} return false; }

// ---------- M: rangos de mapas y experiencia ----------
{const r=await E(()=>{const V=gengi.v4d();const R=V.cfg.MAP_RANGES;
  const C=gengi.v4b().cfg;const gen=C.mapDef('arrabal').generador;const g=(id,lv)=>C.mapGate({...C.mapDef(id),generador:C.mapDef(id).generador||gen},lv);
  return {maps:V.maps,R,gates:{a1:g('arrabal',1),v4:g('via_muerta',4),v5:g('via_muerta',5),c11:g('crater',11),c12:g('crater',12),a13:g('arrabal',13),c40:g('crater',40),co21:g('colmena',21),co22:g('colmena',22),v23:g('via_muerta',23),co40:g('colmena',40)}};});
 const want={arrabal:[1,12],via_muerta:[5,22],crater:[12,40],colmena:[22,40]};
 const same=r.maps.every(m=>want[m.id]&&want[m.id][0]===m.min&&want[m.id][1]===m.max&&r.R[m.id][0]===m.min&&r.R[m.id][1]===m.max);
 const G=r.gates;
 ok('M1 rangos de mapas (§7): Arrabal 1-12, Vía Muerta 5-22, Cráter 12-40, Colmena 22-40; salen de MAP_RANGES (una línea por mapa)', same&&r.maps.length===4, JSON.stringify(r.maps));
 ok('M2 acceso por nivel (con el mapa ya construido): Vía Muerta desde el 5, Cráter desde el 12, Colmena desde el 22; Arrabal superado al 13; Cráter y Colmena hasta el 40', G.a1==='ok'&&G.v4==='bloqueado'&&G.v5==='ok'&&G.c11==='bloqueado'&&G.c12==='ok'&&G.a13==='superado'&&G.c40==='ok'&&G.co21==='bloqueado'&&G.co22==='ok'&&G.v23==='superado'&&G.co40==='ok', JSON.stringify(G));}
{const r=await E(()=>{const V=gengi.v4d();return {low:V.killXpRaid(100,false,0),high:V.killXpRaid(100,false,9000),wave:V.killXpRaid(100,true,9000),cap:V.cfg.XP4D.removeKillCap};});
 ok('M3 sin tope de experiencia por incursión: 100 de base dan 100 también tras 9.000; las oleadas siguen al 30 %', r.cap&&r.low===100&&r.high===100&&Math.abs(r.wave-30)<1e-9, JSON.stringify(r));}

// ---------- L: presión al final de la incursión ----------
{const r=await E(()=>{const V=gengi.v4d();return [0,5,10,11,12,14].map(m=>+V.scaling(m).stats.toFixed(3));});
 ok('L1 escalado de enemigos: +4 %/min hasta el 10 y +9 %/min después (min 5: ×1,20, min 10: ×1,40, min 12: ×1,58)', JSON.stringify(r)===JSON.stringify([1,1.2,1.4,1.49,1.58,1.76]), JSON.stringify(r));}
await newRaid(5150);
{const r=await E(async()=>{const s=gengi.raid();__calm();__open(8);s.snap.huntersWarned=false;s.snap.elapsed=9.9*60;s.snap.fogT=9.9*60;const w0=s.snap.huntersWarned;
  await __waitGame(0.1);s.snap.elapsed=10*60-0.05;await __waitGame(0.2);const msg=s.hud.msg.text;const n=s.enemies.list.filter(e=>e.hunter).length;
  await __waitGame(0.2);return {w0,warned:s.snap.huntersWarned,msg,hunters:n};});
 ok('L2 en el minuto 10 avisa «⚠ Se acercan cazadores» (sin cazadores todavía)', !r.w0&&r.warned&&/Se acercan cazadores/.test(r.msg)&&r.hunters===0, JSON.stringify(r));}
{const r=await E(async()=>{const s=gengi.raid();__calm();const o=__open(8);s.noise(o.x+T*3,o.y-T*2,5);const nz=s.noiseLog.at(-1);
  s.snap.hunterT=undefined;s.snap.elapsed=11*60+0.5;s.snap.fogT=s.snap.elapsed;await __waitGame(0.15);
  const V=gengi.v4d().raid;const h=V.hunters;const e=s.enemies.list.find(x=>x.hunter);
  const dist=e?Math.hypot(e.x-s.player.x,e.y-s.player.y)/T:0;const t1=s.snap.hunterT;
  s.snap.hunterT=0.05;await __waitGame(0.2);const n2=s.enemies.list.filter(x=>x.hunter).length;
  return {nz,h,dist,t1,n2,stat:s.stats.hunters,log:s.stats.hunterLog.slice(-2)};});
 const h=r.h[0];
 ok('L3 desde el minuto 11 aparece un cazador élite fuera de pantalla que va a tu último ruido; otro a los 60 s', r.h.length===1&&h.elite&&h.goal&&Math.abs(h.goal.x-r.nz.x)<1&&Math.abs(h.goal.y-r.nz.y)<1&&r.dist>=11&&r.t1>58&&r.t1<=60&&r.n2===2&&['corredor','bruto','errante','acechador'].includes(h.type), JSON.stringify({h,dist:+r.dist.toFixed(1),t1:r.t1,n2:r.n2}));}
{const r=await E(async()=>{const s=gengi.raid();__calm();s.snap.elapsed=12*60;s.snap.fogT=12*60;const a0=s.snap.fogT;await __waitGame(1);const r12=(s.snap.fogT-a0)/1;
  s.snap.elapsed=13*60-0.3;s.snap.fogT=13*60-0.3;s.warned13=false;await __waitGame(0.5);s.snap.elapsed=13*60;s.snap.fogT=13*60;const b0=s.snap.fogT,e0=s.snap.elapsed;await __waitGame(1);const r13=(s.snap.fogT-b0)/(s.snap.elapsed-e0);
  const msg=s.hud.msg.text;s.snap.fogT=13*60;s.snap.elapsed=13*60;await __waitGame(0.05);const timer=s.hud.timer.text;
  return {r12:+r12.toFixed(2),r13:+r13.toFixed(2),msg,timer,rate:gengi.v4d().raid.fogRate};});
 ok('L4 desde el minuto 13 la niebla avanza ×2 (reloj de niebla) y el aviso/temporizador lo reflejan (llega hacia el minuto 14)', Math.abs(r.r12-1)<0.08&&Math.abs(r.r13-2)<0.08&&r.rate===2&&/doble de rápido/.test(r.msg)&&/^0:5\d|^1:00/.test(r.timer), JSON.stringify(r));}

// ---------- R: armas a distancia ----------
await newRaid(6161);
{const r=await E(async()=>{const s=gengi.raid();__calm();__open(9);s.facing=-Math.PI/2;__arm('pistola','municion',24);
  const e=__dummy('errante',0,-3,Math.PI/2,500,'chase');await __waitGame(2.0);const shots=s.stats.shots,auto=s.stats.autoShots,hp=e.hp;
  gengi.clearEnemies();window.__pins.clear();
  __arm('machete');const m=__dummy('errante',0,-1.2,Math.PI/2,500,'chase');s.facing=-Math.PI/2;await __waitGame(1.5);
  return {shots,auto,hp,meleeHp:m.hp,autoCfg:gengi.v4d().cfg.RANGED.autoFire};});
 ok('R1 las armas a distancia ya no disparan solas (pistola 2 s con un enemigo delante: 0 disparos); el cuerpo a cuerpo sigue automático', !r.autoCfg&&r.shots===0&&r.auto===0&&r.hp===500&&r.meleeHp<500, JSON.stringify(r));}
{const r=await E(async()=>{const s=gengi.raid();__calm();__open(9);const out={};
  for(const w of ['pistola','arco','ballesta','escopeta']){__arm(w);out[w]=+s.rangedInterval().toFixed(3);}
  // pistola: mantener el joystick → cadencia real
  __arm('pistola','municion',60);s.snap.loadout.arma.mag=12;s.stats.fireLog.length=0;gengi.aim(0,-1);await __waitGame(3.4);gengi.aim(null);
  const t=s.stats.fireLog.filter(f=>f.w==='pistola').map(f=>f.t);const d=t.slice(1).map((x,i)=>x-t[i]).sort((a,b)=>a-b);out.pistolGaps=d.map(x=>+x.toFixed(3));out.med=d[Math.floor(d.length/2)];
  // arco: tras disparar, el siguiente tarda 1,4 s
  __arm('arco','flechas',20);s.fireRanged(-Math.PI/2,false);out.bowWait=+s.attackT.toFixed(3);
  __arm('ballesta','flechas',20);s.fireRanged(-Math.PI/2,false);out.xbowWait=+s.attackT.toFixed(3);
  __arm('escopeta','cartuchos',20);s.fireRanged(-Math.PI/2,false);out.sgWait=+s.attackT.toFixed(3);
  return out;});
 ok('R2 intervalos entre disparos: pistola 0,8 s, arco 1,4 s, ballesta 1,8 s, escopeta 1,2 s (medido manteniendo el joystick con la pistola)', r.pistola===0.8&&r.arco===1.4&&r.ballesta===1.8&&r.escopeta===1.2&&r.med>=0.79&&r.med<=0.86&&r.pistolGaps.length>=2&&r.bowWait===1.4&&r.xbowWait===1.8&&r.sgWait===1.2, JSON.stringify(r));}
{const r=await E(async()=>{const s=gengi.raid();__calm();__open(9);const I=gengi.v4d().items;
  __arm('ballesta','flechas',5);const lo=s.snap.loadout;const ammo0=s.ammoOf(lo.arma).text;
  const e=__dummy('errante',0,-3,Math.PI/2,1000,'chase');s.fireRanged(-Math.PI/2,false);await __waitGame(0.6);
  const left=lo.mochila.filter(i=>i.def==='flechas').reduce((a,i)=>a+i.qty,0);
  const hp=e.hp;
  return {xbowAmmo:I.ballesta.weapon.ammo,bowAmmo:I.arco.weapon.ammo??'flechas',ammo0,left,hit:hp<1000,noVirotesLoot:!gengi.v4d().lootTable.some(t=>t.id==='virotes'),txt:s.noAmmoText()};});
 ok('R3 arco y ballesta comparten las flechas (la ballesta gasta flechas; los virotes ya no salen en el botín)', r.xbowAmmo==='flechas'&&r.ammo0==='5'&&r.left===4&&r.hit&&r.noVirotesLoot&&r.txt==='Sin flechas', JSON.stringify(r));}
{const r=await E(()=>{const V=gengi.v4d();const st=JSON.parse(JSON.stringify(gengi.state()));st.saveVersion=6;
  st.stash.push({uid:'mig-v1',def:'virotes',rarity:'comun',qty:7});st.loadout.mochila.push({uid:'mig-v2',def:'virotes',rarity:'comun',qty:3});
  if(st.activeRaid){st.activeRaid.loadout.mochila.push({uid:'mig-v3',def:'virotes',rarity:'comun',qty:2});st.activeRaid.groundArrows=[{x:1,y:2,id:'virotes',left:30}];}
  const m=V.migrate(st);const s=JSON.stringify(m);
  return {ver:m.saveVersion,vir:(s.match(/"virotes"/g)||[]).length,st:m.stash.find(i=>i.uid==='mig-v1')?.def,lo:m.loadout.mochila.find(i=>i.uid==='mig-v2')?.def,raid:m.activeRaid?m.activeRaid.loadout.mochila.find(i=>i.uid==='mig-v3')?.def:'(sin)',ga:m.activeRaid?.groundArrows?.[0]?.id};});
 ok('R4 migración del guardado 6 → 7: los virotes pasan a flechas (refugio, equipo e incursión en curso)', r.ver===7&&r.vir===0&&r.st==='flechas'&&r.lo==='flechas'&&(r.raid==='flechas'||r.raid==='(sin)'), JSON.stringify(r));}

// ---------- S: escopeta ----------
{const r=await E(()=>{const V=gengi.v4d(),I0=V.items.escopeta,I=I0.weapon,S=V.cfg.SHOTGUN;
  const find=(o,k,d=0)=>{if(!o||typeof o!=='object'||d>4)return null;if(k in o)return o[k];for(const v of Object.values(o)){const f=find(v,k,d+1);if(f)return f;}return null;};
  const bp=find(V.v3,'basePrice');const gear=find(V.v3,'chispasGear');const am=find(V.v3,'chispasAmmo');
  return {I:{w:I0.weight,dmg:I.dmg,range:I.rangeTiles,noise:I.noise,mag:I.mag,ammo:I.ammo,ability:I.ability,icon:I0.icon},S,c:V.items.cartuchos?{icon:V.items.cartuchos.icon,stack:V.items.cartuchos.maxStack}:null,
  loot:V.lootTable.filter(t=>t.id==='escopeta'||t.id==='cartuchos').map(t=>t.id),price:bp?[bp.escopeta,bp.cartuchos]:null,shop:[gear?.includes('escopeta'),!!am?.some(a=>a[0]==='cartuchos'),!am?.some(a=>a[0]==='virotes')],stag:V.stagger.weapon.escopeta};});
 ok('S1 escopeta: peso 4, 6 perdigones × 7, cono 25°, 4,5 casillas, cargador de 4 cartuchos, ruido 9, empuje fuerte; escopeta y cartuchos en el botín y en la tienda de Chispas', r.I.w===4&&r.I.dmg===7&&r.I.mag===4&&r.I.ammo==='cartuchos'&&r.I.ability==='postas'&&r.I.range===4.5&&r.I.noise===9&&r.I.w===4&&r.S.pellets===6&&r.S.coneDeg===25&&r.S.rangeTiles===4.5&&r.S.noiseTiles===9&&r.c&&r.loot.length===2&&r.stag&&r.stag[0]>=100&&r.price&&r.price[0]===170&&r.price[1]===8&&r.shop.every(Boolean), JSON.stringify(r));}
{const r=await E(async()=>{const s=gengi.raid();__calm();__open(9);__arm('escopeta','cartuchos',40);const lo=s.snap.loadout;
  const near=__dummy('errante',0,-2,Math.PI/2,5000,'chase');
  const calls=[];const of=s.proj.fire.bind(s.proj);s.proj.fire=(...a)=>{const pj=of(...a);calls.push({t:s.snap.elapsed,crit:pj.crit,dmg:pj.dmg});return pj;};
  s.stats.pellets.length=0;s.stats.shotgun.length=0;let shots=0;
  for(let i=0;i<30;i++){lo.arma.mag=4;s.attackT=0;s.fireRanged(-Math.PI/2,false);shots++;s.snap.player.reload=0;}
  await __waitGame(0.6);
  // falloff: el blanco a 4 casillas
  gengi.clearEnemies();window.__pins.clear();const far=__dummy('errante',0,-4,Math.PI/2,5000,'chase');for(let i=0;i<10;i++){lo.arma.mag=4;s.fireRanged(-Math.PI/2,false);s.snap.player.reload=0;}await __waitGame(0.6);
  gengi.clearEnemies();window.__pins.clear();const out=__dummy('errante',0,-5.6,Math.PI/2,5000,'chase');const hp0=out.hp;for(let i=0;i<6;i++){lo.arma.mag=4;s.fireRanged(-Math.PI/2,false);s.snap.player.reload=0;}await __waitGame(0.7);
  s.proj.fire=of;
  const G=s.stats.shotgun;const groups={};calls.forEach((c,i)=>{const k=Math.floor(i/6);(groups[k]=groups[k]||[]).push(c);});
  const mixed=Object.values(groups).filter(g=>new Set(g.map(c=>c.crit)).size>1||new Set(g.map(c=>c.dmg)).size>1).length;
  const P=s.stats.pellets;const nearP=P.filter(q=>q.d<=3),farP=P.filter(q=>q.d>3);
  const ratio=(q)=>q.dmg/q.raw;
  return {shots,groups:Object.keys(groups).length,per:Object.values(groups).map(g=>g.length).slice(0,3),mixed,crits:G.filter(g=>g.crit).length,
    cone:G[0].coneDeg,range:G[0].rangeTiles,maxAng:Math.max(...G.flatMap(g=>g.angs.map(Math.abs))),nearN:nearP.length,farN:farP.length,
    nearR:[...new Set(nearP.slice(0,40).map(q=>+ratio(q).toFixed(2)))],farR:[...new Set(farP.slice(0,40).map(q=>+ratio(q).toFixed(2)))],outHit:hp0-out.hp,noise:s.noiseLog.at(-1).r};});
 ok('S2 un disparo = 6 perdigones en un cono de 25° (alcance 4,5 casillas) con UNA tirada de crítico para todos', r.groups===r.shots+16&&r.per.every(n=>n===6)&&r.mixed===0&&r.cone===25&&Math.abs(r.range-4.5)<1e-9&&r.maxAng<=12.5+0.01&&r.crits>0&&r.crits<r.shots, JSON.stringify({groups:r.groups,shots:r.shots,per:r.per,mixed:r.mixed,crits:r.crits,cone:r.cone,range:r.range,maxAng:+r.maxAng.toFixed(2)}));
 ok('S3 a partir de 3 casillas los perdigones hacen el 60 %; más allá de 4,5 no llegan; ruido 9', r.nearN>0&&r.farN>0&&r.nearR.every(x=>x===1)&&r.farR.every(x=>x===0.6)&&r.outHit===0&&r.noise===9, JSON.stringify({nearN:r.nearN,farN:r.farN,nearR:r.nearR,farR:r.farR,outHit:r.outHit,noise:r.noise}));}
{const r=await E(async()=>{const s=gengi.raid();__calm();__open(9);__arm('escopeta','cartuchos',10);const lo=s.snap.loadout,p=s.snap.player;lo.arma.mag=0;s.attackT=0;s.shellIdleT=0;
  const t0=__gt();const mags=[];for(let k=0;k<8;k++){await __waitGame(0.25);mags.push([+(__gt()-t0).toFixed(2),lo.arma.mag]);}
  await __waitGame(1.4);const full=lo.arma.mag,res=lo.mochila.filter(i=>i.def==='cartuchos').reduce((a,i)=>a+i.qty,0);
  // interrumpir: con 1 cartucho dentro y recargando, se puede disparar y corta la recarga
  lo.arma.mag=1;p.reload=0.3;const can=s.readyRanged(0.016);s.fireRanged(-Math.PI/2,false);const after={mag:lo.arma.mag,reload:p.reload};
  return {mags,full,res,can,after};});
 // v4e (Basu): la recarga empieza tras 0,8 s sin apuntar ni disparar → 1.er cartucho a ~1,3 s
 const m0=r.mags.filter(x=>x[0]<1.2),m1=r.mags.find(x=>x[0]>=1.35&&x[0]<1.75);
 ok('S4 recarga cartucho a cartucho (tras 0,8 s de reposo, 0,5 s cada uno) y disparar la interrumpe', m0.length>0&&m0.every(x=>x[1]===0)&&m1&&m1[1]===1&&r.full===4&&r.res===6&&r.can&&r.after.mag===0&&r.after.reload===0, JSON.stringify(r));}

// ---------- A: habilidades temporales del arma ----------
{const r=await E(async()=>{const s=gengi.raid();__calm();__open(9);const out={};const W=gengi.v4d().cfg.WEAPON_BUFFS;
  __arm('pistola','municion',24);await __waitGame(0.1);s.snap.player.cds={};out.pid=s.abilityIds[0];s.useAbility(0);out.p={buff:+s.snap.player.buffs.rafaga.toFixed(2),cd:+s.snap.player.cds.rafaga.toFixed(1),iv:s.rangedInterval()};
  await __waitGame(4.2);out.p.after=s.rangedInterval();out.p.off=!s.buffOn('rafaga');
  __arm('arco','flechas',20);await __waitGame(0.1);s.snap.player.cds={};out.aid=s.abilityIds[0];
  const rate=()=>{let c=0;for(let i=0;i<4000;i++)if(s.rollCrit(10).crit)c++;return c/4000;};out.a={base:rate()};s.useAbility(0);out.a.buff=+s.snap.player.buffs.ojo_halcon.toFixed(2);out.a.cd=+s.snap.player.cds.ojo_halcon.toFixed(1);out.a.on=rate();
  __arm('ballesta','flechas',20);await __waitGame(0.1);s.snap.player.cds={};out.bid=s.abilityIds[0];
  const es=[2,3,4].map(d=>__dummy('errante',0,-d,Math.PI/2,1000,'chase'));s.fireRanged(-Math.PI/2,false);await __waitGame(0.6);out.b={off:es.map(e=>e.hp<1000)};
  es.forEach(e=>{e.hp=1000;});s.useAbility(0);out.b.buff=+s.snap.player.buffs.perforacion.toFixed(2);out.b.cd=+s.snap.player.cds.perforacion.toFixed(1);s.attackT=0;s.fireRanged(-Math.PI/2,false);await __waitGame(0.6);out.b.on=es.map(e=>e.hp<1000);
  gengi.clearEnemies();window.__pins.clear();
  __arm('escopeta','cartuchos',20);await __waitGame(0.1);s.snap.player.cds={};out.sid=s.abilityIds[0];s.useAbility(0);out.s={buff:+s.snap.player.buffs.postas.toFixed(2),cd:+s.snap.player.cds.postas.toFixed(1)};s.fireRanged(-Math.PI/2,false);const g=s.stats.shotgun.at(-1);out.s.cone=g.coneDeg;out.s.range=+g.rangeTiles.toFixed(2);out.s.maxAng=+Math.max(...g.angs.map(Math.abs)).toFixed(2);
  out.W=W;return out;});
 ok('A1 Pistola «Ráfaga»: mitad del intervalo durante 4 s (recarga 20 s)', r.pid==='rafaga'&&r.p.buff>=3.9&&r.p.cd>=19&&r.p.cd<=20&&Math.abs(r.p.iv-0.4)<1e-9&&r.p.off&&Math.abs(r.p.after-0.8)<1e-9, JSON.stringify(r.p));
 ok('A2 Arco «Ojo de halcón»: +50 % de probabilidad de crítico durante 6 s (recarga 22 s)', r.aid==='ojo_halcon'&&r.a.buff>=5.9&&r.a.cd>=20.9&&r.a.cd<=22&&r.a.on-r.a.base>0.42&&r.a.on-r.a.base<0.58, JSON.stringify(r.a));
 ok('A3 Ballesta «Perforación»: la flecha atraviesa hasta 3 enemigos durante 6 s (recarga 22 s)', r.bid==='perforacion'&&r.b.buff>=5.3&&r.b.cd>=20.9&&JSON.stringify(r.b.off)==='[true,false,false]'&&JSON.stringify(r.b.on)==='[true,true,true]', JSON.stringify(r.b));
 ok('A4 Escopeta «Postas concentradas»: cono de 12° y +40 % de alcance durante 5 s (recarga 20 s)', r.sid==='postas'&&r.s.buff>=4.9&&r.s.cd>=19&&Math.abs(r.s.cone-12)<1e-6&&Math.abs(r.s.range-6.3)<0.01&&r.s.maxAng<=6.01, JSON.stringify(r.s));}

// ---------- U: HUD ----------
{const r=await E(async()=>{const s=gengi.raid();__calm();__open(9);const lo=s.snap.loadout;
  gengi.give('casco','comun');gengi.give('chaleco','comun');for(const id of ['casco','chaleco']){const it=lo.mochila.find(i=>i.def===id);if(it)s.invEquip(it.uid);}
  __arm('pistola','municion',24);lo.arma.mag=8;lo.reserva={uid:'qa-res-arco',def:'arco',rarity:'comun',qty:1};lo.mochila.push({uid:'qa-fl',def:'flechas',rarity:'comun',qty:14});
  lo.mochila=lo.mochila.filter(i=>i.def!=='vendaje'&&i.def!=='botiquin');lo.mochila.push({uid:'qa-v',def:'vendaje',rarity:'comun',qty:2},{uid:'qa-b',def:'botiquin',rarity:'comun',qty:1});s.host.refreshInventory();
  await __waitGame(0.3);const V=gengi.v4d().raid;const out={ids:V.abilityIds,hud:V.hud,ammo:V.ammo};
  // arco: solo el número de flechas; pocas → parpadeo rojo
  __arm('arco','flechas',14);await __waitGame(0.2);out.bow=gengi.v4d().raid.hud.ammo.text;
  lo.mochila.find(i=>i.def==='flechas').qty=3;const cols=new Set();for(let k=0;k<10;k++){await __waitGame(0.06);cols.add(s.hud.ammo.style.color);}out.lowCols=[...cols];out.low=s.hud.ammoLow;
  lo.mochila.find(i=>i.def==='flechas').qty=10;await __waitGame(0.2);const cols2=new Set();for(let k=0;k<6;k++){await __waitGame(0.06);cols2.add(s.hud.ammo.style.color);}out.okCols=[...cols2];
  return out;});
 const H=r.hud,A=H.abilities;
 ok('U1 arco de habilidades de izquierda a derecha: arma, casco, chaleco', r.ids[0]==='rafaga'&&r.ids[1]&&r.ids[2]&&A[0].x<A[1].x&&A[1].x<A[2].x&&A.every(a=>a.vis), JSON.stringify({ids:r.ids,xs:A.map(a=>Math.round(a.x))}));
 ok('U2 vendaje y botiquín: dos botones de 44 px apilados a la izquierda del arco, con su número', H.quick.r===22&&H.quick2.r===22&&H.quick.vis&&H.quick2.vis&&Math.abs(H.quick.x-H.quick2.x)<1&&H.quick2.y-H.quick.y>=44&&H.quick.x+22<A[0].x&&H.quick.label==='Vendaje'&&H.quick2.label==='Botiquín'&&H.quick.badge==='2'&&H.quick2.badge==='1', JSON.stringify({q:H.quick,q2:H.quick2,a0:A[0].x}));
 ok('U3 munición junto al joystick derecho: «8 / 24» con cargador, «14» con flechas; número del arma de reserva en el botón de cambio', H.ammo.text==='8 / 24'&&H.ammo.vis&&Math.hypot(H.ammo.x-H.aimRest.x,H.ammo.y-H.aimRest.y)<130&&r.bow==='14'&&H.swap.badge==='14', JSON.stringify({ammo:H.ammo,rest:H.aimRest,bow:r.bow,swap:H.swap.badge}));
 ok('U4 con 3 o menos parpadea en rojo; con más, color normal', r.low&&r.lowCols.some(c=>/^#ff/i.test(c)&&c.toLowerCase()!=='#ffffff')&&r.lowCols.length>=2&&r.okCols.length===1, JSON.stringify({low:r.lowCols,ok:r.okCols}));}
await E(()=>{const s=gengi.raid();s.snap.loadout.reserva=null;s.host.refreshInventory();gengi.clearEnemies();window.__pins.clear();});

// ---------- P: guardado de la incursión ----------
{await E(async()=>{const s=gengi.raid();__calm();s.snap.player.buffs={perforacion:4.5};s.snap.elapsed=11.5*60;s.snap.fogT=11.5*60+3;s.snap.hunterT=33;s.snap.huntersWarned=true;
  const e=s.spawnHunter();window.__hid=e?{x:Math.round(e.x),y:Math.round(e.y)}:null;s.persist();});
 const before=await E(()=>({h:window.__hid,b:gengi.raid().snap.player.buffs,f:gengi.raid().snap.fogT}));
 await p.goto(URL); const resumed=await waitRaid(); await E(setup);
 const r=await E(()=>{const s=gengi.raid();const S=s.snap;return {buffs:S.player.buffs,fogT:S.fogT,hunterT:S.hunterT,warned:S.huntersWarned,hunters:s.enemies.list.filter(e=>e.hunter).length};});
 ok('P1 al reabrir la app se conservan las habilidades activas, el reloj de la niebla, el temporizador de cazadores y los cazadores', resumed&&before.h&&Math.abs((r.buffs?.perforacion??0)-4.5)<0.3&&Math.abs(r.fogT-before.f)<0.6&&Math.abs(r.hunterT-33)<0.6&&r.warned&&r.hunters>=1, JSON.stringify({before,r}));}

// ---------- F: niebla v2 ----------
await E(()=>{const s=gengi.raid();if(s.paused)s.setPaused(false,'usuario');});
await newRaid(7272);
await E(async()=>{const s=gengi.raid();__calm();__open(9);s.snap.loadout.arma={uid:'qa-bate',def:'bate',rarity:'comun',qty:1};s.host.refreshInventory();s.facing=-Math.PI/2;await __waitGame(0.5);});
const simLib=`
window.__fogSim={
  vis:(m,wx,wy)=>{const px=Math.round((wx-m.view.x)*m.w/m.view.w),py=Math.round((wy-m.view.y)*m.h/m.view.h);let a=0,n=0;for(let dy=-1;dy<=1;dy++)for(let dx=-1;dx<=1;dx++){const x=px+dx,y=py+dy;if(x<0||y<0||x>=m.w||y>=m.h)continue;a+=m.a[y*m.w+x];n++;}return n?1-a/n:NaN;},
  run:(V,s,t,dur,dt,fa)=>{let k=0;const n=Math.round(dur/dt);for(let i=0;i<n;i++){t.v+=dt;V.update(s.player.x,s.player.y,fa(t.v),s.wallsVersion,t.v,dt);k++;}return k;},
};`;
await E(simLib);
{const r=await E(async()=>{const s=gengi.raid();const V=s.vision;const F=window.__fogSim;const out={cls:V.constructor.name,info:V.fogInfo(),nearR:V.nearR/T};
  // abre un hueco: ¿todos los rayos a 4 casillas libres?
  s.sys.pause();
  const res={};
  for(const fps of [30,60]){const dt=1/fps;const t={v:1000};V.prevView.x=NaN;
    F.run(V,s,t,1.0,dt,()=>-Math.PI/2); // mirando arriba 1 s
    const P={x:s.player.x,y:s.player.y-4*T};const m0=await V.readMask();const v0=F.vis(m0,P.x,P.y);
    const curve=[];let tt=0;for(let k=0;k<8;k++){F.run(V,s,t,0.1,dt,()=>Math.PI/2);tt+=0.1;const m=await V.readMask();curve.push(+F.vis(m,P.x,P.y).toFixed(3));}
    // duración de la estela: primer instante con visibilidad < 3 %
    res[fps]={v0:+v0.toFixed(3),curve,trail:+(0.1*(curve.findIndex(v=>v<0.03)+1)).toFixed(1)};}
  s.sys.resume();out.res=res;return out;});
 const c30=r.res[30].curve,c60=r.res[60].curve;const maxDiff=Math.max(...c30.map((v,i)=>Math.abs(v-c60[i])));
 ok('F1 niebla v2 activa: una sola máscara, radio siempre visible de 2,5 casillas, opacidad 45 %', r.info.v2&&r.info.layers===1&&r.info.total===0.45&&r.nearR===2.5, JSON.stringify({cls:r.cls,info:r.info,nearR:r.nearR}));
 ok('F2 la estela dura lo mismo a 30 y a 60 fps (se apaga con el tiempo del fotograma, ~0 a los 0,6 s)', r.res[30].v0>0.9&&r.res[60].v0>0.9&&maxDiff<=0.04&&r.res[30].trail===r.res[60].trail&&r.res[30].trail>=0.4&&r.res[30].trail<=0.6&&c30[0]>0.35&&c30[5]<0.03, JSON.stringify({c30,c60,maxDiff:+maxDiff.toFixed(3),t30:r.res[30].trail,t60:r.res[60].trail}));}
{const r=await E(async()=>{const s=gengi.raid();const V=s.vision;const F=window.__fogSim;s.sys.pause();
  const w=Phaser.Math.DegToRad(540);const t={v:2000};V.prevView.x=NaN;const a0=-Math.PI/2;
  F.run(V,s,t,0.5,1/60,()=>a0);const t0=t.v;F.run(V,s,t,1.0,1/60,(tv)=>a0+w*(tv-t0));
  const fa=a0+w*(t.v-t0);const m=await V.readMask();const half=V.half;const R=3*T;
  // perfil por grados detrás del borde de salida del cono (δ = 1..125°; a 140° empieza el borde suave del lado de entrada), edad esperada δ/540 s
  const prof=[];for(let d=1;d<=125;d++){const ang=fa-half-Phaser.Math.DegToRad(d);prof.push(F.vis(m,s.player.x+Math.cos(ang)*R,s.player.y+Math.sin(ang)*R));}
  const tau=V.tau;const exp=prof.map((_,i)=>Math.exp(-((i+1)/540)/tau));
  let ups=0,maxUp=0,maxJump=0,maxErr=0;for(let i=1;i<prof.length;i++){const d=prof[i]-prof[i-1];if(d>0.02)ups++;maxUp=Math.max(maxUp,d);maxJump=Math.max(maxJump,Math.abs(d));}
  for(let i=15;i<prof.length;i++)maxErr=Math.max(maxErr,Math.abs(prof[i]-exp[i]));
  // en el cono, todo visible (sin huecos)
  let coneMin=1;for(let d=-100;d<=100;d+=2){const ang=fa+Phaser.Math.DegToRad(d);coneMin=Math.min(coneMin,F.vis(m,s.player.x+Math.cos(ang)*R,s.player.y+Math.sin(ang)*R));}
  // detrás, dentro del radio de 2,5 casillas: visible
  const back=F.vis(m,s.player.x-Math.cos(fa)*1.2*T,s.player.y-Math.sin(fa)*1.2*T);
  s.sys.resume();
  // giro real: la vista no gira a más de 540°/s
  window.__spin=null;s.facing=s.viewFacing;await __waitGame(0.2);const v0=s.viewFacing;s.facing=v0+Math.PI*0.99;const rates=[];let last=v0,lt=__gt();
  for(let k=0;k<8;k++){await new Promise(r=>requestAnimationFrame(()=>r()));const now=__gt(),vf=s.viewFacing;if(now>lt)rates.push(Math.abs(Phaser.Math.Angle.Wrap(vf-last))/(now-lt));last=vf;lt=now;}
  const maxRate=Phaser.Math.RadToDeg(Math.max(...rates));
  return {p:[0,10,20,40,60,80,100,110,124].map(i=>+prof[i].toFixed(2)),ups,maxUp:+maxUp.toFixed(3),maxJump:+maxJump.toFixed(3),maxErr:+maxErr.toFixed(3),coneMin:+coneMin.toFixed(2),back:+back.toFixed(2),maxRate:+maxRate.toFixed(0)};});
 ok('F3 girando a 540°/s la máscara es continua: la estela baja de forma suave y monótona, sin huecos ni trozos sueltos', r.ups===0&&r.maxJump<=0.06&&r.maxErr<=0.12&&r.coneMin>=0.9&&r.p[0]>0.85&&r.p[8]<0.3, JSON.stringify(r));
 ok('F4 el giro de la vista está limitado a 540°/s y el radio cercano se ve también detrás', r.maxRate<=545&&r.maxRate>=300&&r.back>=0.9, JSON.stringify({maxRate:r.maxRate,back:r.back}));}
{const r=await E(async()=>{const s=gengi.raid();const V=s.vision;const tau=V.tau;
  const g=[0,0.15,0.3,0.45,0.6].map(a=>+s.ghostFade(a).toFixed(3));const exp=[0,0.15,0.3,0.45].map(a=>+Math.exp(-a/tau).toFixed(3));
  // un punto visto hace 0,2 s sigue en la memoria; a los 0,7 s ya no
  s.sys.pause();const F=window.__fogSim;const t={v:3000};F.run(V,s,t,0.5,1/60,()=>-Math.PI/2);const P={x:s.player.x,y:s.player.y-4*T};F.run(V,s,t,0.2,1/60,()=>Math.PI/2);
  const l1=V.lingering(P.x,P.y);F.run(V,s,t,0.5,1/60,()=>Math.PI/2);const l2=V.lingering(P.x,P.y);s.sys.resume();
  // fantasma de un enemigo: su alfa sigue la misma curva
  __calm();const e=__dummy('errante',0,-4,Math.PI/2,1000,'idle');s.facing=-Math.PI/2;s.viewFacing=-Math.PI/2;await __waitGame(0.4);
  s.facing=Math.PI/2;s.viewFacing=Math.PI/2;await __waitGame(0.2);const age=s.snap.elapsed-e.seenAt;const ga=e.rig.ghost??e.rig.ghostA??null;
  return {g,exp,l1,l2,age:+age.toFixed(2),ga,ghostAlpha:gengi.v31?.().cfg?.LINGER?.ghostAlpha??null};});
 ok('F5 siluetas fantasma atadas a la máscara: misma curva exp(−t/τ), 0 a los 0,6 s; memoria de 0,2 s sí, de 0,7 s no', JSON.stringify(r.g.slice(0,4))===JSON.stringify(r.exp)&&r.g[4]===0&&r.l1&&!r.l2, JSON.stringify(r));}
// interruptor: niebla anterior con FOG2.enabled = false
await endRaid(); await E(()=>{gengi.v4d().cfg.FOG2.enabled=false;});
await newRaid(7272);
{const r=await E(async()=>{const s=gengi.raid();__calm();await __waitGame(0.3);return {cls:s.vision.constructor.name,info:s.vision.fogInfo()};});
 ok('F6 interruptor de configuración: FOG2.enabled = false vuelve a la niebla anterior (capas)', !r.info.v2&&r.info.layers>=1, JSON.stringify(r));}
await endRaid(); await E(()=>{gengi.v4d().cfg.FOG2.enabled=true;});

ok('Z sin errores en la página', errs.length===0, errs.slice(0,3).join(' | '));
const pass=res.filter(x=>x.startsWith('PASS')).length, fail=res.length-pass;
console.log(`${pass} PASS, ${fail} FAIL`);
await b.close(); process.exit(fail?1:0);
