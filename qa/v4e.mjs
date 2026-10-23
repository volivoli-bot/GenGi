// QA v4e: la recarga saca munición también del bolsillo seguro (como las flechas) y el HUD cuenta lo mismo
// que se puede recargar; escopeta: la recarga empieza tras 0,8 s sin apuntar ni disparar (Basu, diseno-v4 §7).
// node qa/v4e.mjs [url]
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
window.__calm=()=>{const s=gengi.raid();/* sin Zona Helada (como sigilo.mjs) */const N=gengi.cfg42,V4=gengi.v4().cfg;N.SNOW_ENEMIES.enabled=false;N.SNOW_RULES.muffle=1;N.SNOW_RULES.prints.enabled=false;N.SNOW_RULES.ventisca.enabled=false;V4.SNOW.enemyMult=1;gengi.god(true);gengi.clearEnemies();s.snap.stream=null;s.snap.spawnTimer=-1e9;gengi.move(0,0);gengi.aim(null);gengi.cfg31.ELITE.chance=0;s.snap.xp=0;s.snap.xpBy={};
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

const head=(id,ammo)=>`const s=gengi.raid();__calm();__open(8);__arm('${id}',null,0);const lo=s.snap.loadout,p=s.snap.player;lo.bolsillo=null;lo.bolsilloExtra=[];s.noAmmoWarned=false;s.shellIdleT=0;s.host.refreshInventory();`;
const hud=()=>`(()=>{const a=gengi.v4d().raid.hud.ammo;return a.text;})()`;

await newRaid(8282);
// ---------- K: munición del bolsillo seguro ----------
{const r=await E(new Function(`return (async()=>{${head('pistola')}
  const rs=gengi.v4d().items.pistola.weapon.reloadSec??1.5;
  lo.arma.mag=0;lo.bolsillo={uid:'qa-poc-m',def:'municion',rarity:'comun',qty:10};s.host.refreshInventory();await __waitGame(0.05);const hud0=${hud()};
  await __waitGame(rs+0.4);await __waitGame(0.05);
  return {rs,hud0,mag:lo.arma.mag,poc:lo.bolsillo?.qty??0,hud1:${hud()},warned:s.noAmmoWarned};})()`));
 ok('K1 pistola sin balas en la mochila: recarga del bolsillo seguro (sin «¡Sin munición!»)', r.hud0==='0 / 10'&&r.mag===10&&r.poc===0&&r.hud1==='10 / 0'&&!r.warned, JSON.stringify(r));}
{const r=await E(new Function(`return (async()=>{${head('pistola')}
  const rs=gengi.v4d().items.pistola.weapon.reloadSec??1.5;
  lo.arma.mag=0;lo.mochila.push({uid:'qa-mo-m',def:'municion',rarity:'comun',qty:3});lo.bolsillo={uid:'qa-poc-m2',def:'municion',rarity:'comun',qty:5};s.host.refreshInventory();await __waitGame(0.05);const hud0=${hud()};
  await __waitGame(rs+0.4);await __waitGame(0.05);const mo=lo.mochila.filter(i=>i.def==='municion').reduce((a,i)=>a+i.qty,0);
  return {hud0,mag:lo.arma.mag,mo,poc:lo.bolsillo?.qty??0,hud1:${hud()}};})()`));
 ok('K2 mochila 3 + bolsillo 5: el HUD dice 0 / 8 y se recargan las 8 (primero la mochila)', r.hud0==='0 / 8'&&r.mag===8&&r.mo===0&&r.poc===0&&r.hud1==='8 / 0', JSON.stringify(r));}
{const r=await E(new Function(`return (async()=>{${head('escopeta')}
  gengi.aim(null);lo.arma.mag=0;lo.bolsillo={uid:'qa-poc-c',def:'cartuchos',rarity:'comun',qty:3};s.host.refreshInventory();await __waitGame(0.05);const hud0=${hud()};
  await __waitGame(0.8+0.5*3+0.5);
  return {hud0,mag:lo.arma.mag,poc:lo.bolsillo?.qty??0,hud1:${hud()},warned:s.noAmmoWarned};})()`));
 ok('K3 escopeta: recarga cartuchos del bolsillo seguro', r.hud0==='0 / 3'&&r.mag===3&&r.poc===0&&r.hud1==='3 / 0'&&!r.warned, JSON.stringify(r));}
{const r=await E(new Function(`return (async()=>{${head('pistola')}
  lo.arma.mag=0;s.host.refreshInventory();await __waitGame(0.3);
  return {hud:${hud()},warned:s.noAmmoWarned,reload:p.reload,left:s.ammoLeft('municion')};})()`));
 ok('K4 sin munición en ningún sitio: 0 / 0, «¡Sin munición!» y no recarga', r.hud==='0 / 0'&&r.warned&&r.reload<=0&&r.left===0, JSON.stringify(r));}
{const r=await E(new Function(`return (async()=>{${head('pistola')}
  // lo que enseña el HUD es exactamente lo que se acaba metiendo en el cargador (varias recargas seguidas)
  lo.mochila.push({uid:'qa-mo-m3',def:'municion',rarity:'comun',qty:7});lo.bolsillo={uid:'qa-poc-m3',def:'municion',rarity:'comun',qty:9};lo.arma.mag=0;s.host.refreshInventory();
  const rs=gengi.v4d().items.pistola.weapon.reloadSec??1.5;const shown=[],loaded=[];
  for(let k=0;k<3;k++){await __waitGame(0.05);const a=gengi.v4d().raid.hud.ammo.text;shown.push(+a.split('/')[1]);const m0=lo.arma.mag;await __waitGame(rs+0.3);loaded.push(lo.arma.mag-m0);lo.arma.mag=0;}
  return {shown,loaded};})()`));
 ok('K5 el número del HUD coincide con lo recargable (16 → 12 + 4)', JSON.stringify(r.shown)==='[16,4,0]'&&JSON.stringify(r.loaded)==='[12,4,0]', JSON.stringify(r));}

// ---------- G: recarga de la escopeta tras 0,8 s de reposo ----------
{const r=await E(()=>{const S=gengi.v4d().cfg.SHOTGUN;return {delay:S.reloadDelaySec,per:S.reloadPerShellSec,mag:S.mag,dmg:S.pelletDmg,pellets:S.pellets};});
 ok('G1 valores en config: reposo 0,8 s, 1 cartucho cada 0,5 s, cargador 4, daño sin cambios (6 × 7)', r.delay===0.8&&r.per===0.5&&r.mag===4&&r.dmg===7&&r.pellets===6, JSON.stringify(r));}
{const r=await E(new Function(`return (async()=>{${head('escopeta')}
  lo.mochila.push({uid:'qa-mo-c',def:'cartuchos',rarity:'comun',qty:10});lo.arma.mag=4;s.attackT=0;s.host.refreshInventory();
  const l0=s.stats.shellsLoaded;const shots0=s.stats.fireLog.length;
  // fuego seguido (mantener apuntado por encima del umbral): 1 disparo cada 1,2 s
  gengi.aim(1,0);await __waitGame(4.9);const magHold=lo.arma.mag,shots=s.stats.fireLog.length-shots0,loadedHold=s.stats.shellsLoaded-l0;
  // se suelta: el primer cartucho entra a los 0,8 + 0,5 s
  gengi.aim(null);const t0=__gt();let tFirst=null;while(__gt()-t0<2.5){if(lo.arma.mag>0&&tFirst===null)tFirst=__gt()-t0;await new Promise(r=>setTimeout(r,10));}
  const magAfter=lo.arma.mag;
  return {magHold,shots,loadedHold,tFirst:tFirst===null?null:+tFirst.toFixed(2),magAfter};})()`));
 ok('G2 fuego seguido vacía el cargador (4 disparos) sin meter ningún cartucho', r.shots===4&&r.magHold===0&&r.loadedHold===0, JSON.stringify(r));
 ok('G3 al dejar de apuntar, la recarga empieza a los 0,8 s: 1.er cartucho a ~1,3 s, luego 1 cada 0,5 s', r.tFirst!==null&&r.tFirst>=1.25&&r.tFirst<=1.42&&r.magAfter===3, JSON.stringify(r));}
{const r=await E(new Function(`return (async()=>{${head('escopeta')}
  lo.mochila.push({uid:'qa-mo-c2',def:'cartuchos',rarity:'comun',qty:10});lo.arma.mag=0;gengi.aim(null);s.shellIdleT=0;s.host.refreshInventory();
  const t0=__gt();while(lo.arma.mag<1&&__gt()-t0<3)await new Promise(r=>setTimeout(r,10));await __waitGame(0.2);
  const midReload=p.reload>0;const cuts0=s.stats.shellCuts;
  // apuntar (sin llegar a disparar) corta la recarga y la pausa
  gengi.aim(0.3,0);await __waitGame(0.1);const cut={reload:p.reload,cuts:s.stats.shellCuts-cuts0,mag:lo.arma.mag};
  await __waitGame(1.2);const held=lo.arma.mag;
  // se suelta: vuelve a esperar 0,8 s
  gengi.aim(null);await __waitGame(0.7);const early=lo.arma.mag;await __waitGame(0.75);const late=lo.arma.mag;
  // disparar también la corta: recargando con 2 dentro, un disparo deja 1 y sin recarga
  await __waitGame(0.2);const m2=lo.arma.mag;const wasRel=p.reload>0;s.attackT=0;gengi.aim(1,0);await __waitGame(0.1);gengi.aim(null);
  return {midReload,cut,held,early,late,m2,wasRel,afterFire:{mag:lo.arma.mag,reload:p.reload}};})()`));
 ok('G4 apuntar corta la recarga: se para, no entra nada mientras apuntas y vuelve a esperar 0,8 s al soltar', r.midReload&&r.cut.reload===0&&r.cut.cuts===1&&r.held===1&&r.early===1&&r.late===2, JSON.stringify(r));
 ok('G5 disparar corta la recarga (se gasta 1 cartucho y no sigue recargando)', r.wasRel&&r.afterFire.mag===r.m2-1&&r.afterFire.reload===0, JSON.stringify(r));}

ok('Z sin errores en la página', errs.length===0, errs.slice(0,3).join(' | '));
const pass=res.filter(x=>x.startsWith('PASS')).length, fail=res.length-pass;
console.log(`${pass} PASS, ${fail} FAIL`);
await b.close(); process.exit(fail?1:0);
