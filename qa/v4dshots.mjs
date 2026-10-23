// Capturas v4d (diseno-v4 §7) → shots/v4d-*.png. Antes: «QA v4d: rangos de mapas, sin tope de experiencia, presión al final (escalado, cazadores, niebla ×2),
// armas a distancia sin disparo automático, flechas compartidas + migración, escopeta, habilidades temporales,
// HUD (munición, curas fijas, arco de habilidades) y niebla v2 (máscara continua, independiente de los fps).
// node qa/v4dshots.mjs [url]
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


const shot=async n=>{await p.screenshot({path:SHOTS+'/'+n});console.log('shot',n);};
await newRaid(3131);
await E(async()=>{const s=gengi.raid();__calm();const lo=s.snap.loadout;
  gengi.give('casco','comun');gengi.give('chaleco','comun');for(const id of ['casco','chaleco']){const it=lo.mochila.find(i=>i.def===id);if(it)s.invEquip(it.uid);}
  __arm('pistola','municion',24);lo.arma.mag=8;lo.reserva={uid:'qa-res-arco',def:'arco',rarity:'comun',qty:1};lo.mochila.push({uid:'qa-fl',def:'flechas',rarity:'comun',qty:14});
  lo.mochila=lo.mochila.filter(i=>i.def!=='vendaje'&&i.def!=='botiquin');lo.mochila.push({uid:'qa-v',def:'vendaje',rarity:'comun',qty:2},{uid:'qa-b',def:'botiquin',rarity:'comun',qty:1});s.host.refreshInventory();
  s.facing=-Math.PI/2;s.hud.msgT=0;await __waitGame(5);s.hud.msg.setAlpha(0);});
await sleep(200); await shot('v4d-hud-armas.png');
await E(async()=>{const s=gengi.raid();const lo=s.snap.loadout;lo.reserva=null;__arm('arco','flechas',3);s.host.refreshInventory();await __waitGame(0.5);});
for(let k=0;k<12;k++){const red=await E(()=>/^#ff/i.test(gengi.raid().hud.ammo.style.color));if(red)break;await sleep(40);}
await shot('v4d-municion-baja.png');
await E(async()=>{const s=gengi.raid();__arm('escopeta','cartuchos',12);s.snap.loadout.arma.mag=4;s.host.refreshInventory();__dummy('corredor',0.4,-3,Math.PI/2,2000,'chase');__dummy('errante',-0.6,-3.6,Math.PI/2,2000,'chase');await __waitGame(0.3);gengi.aim(0,-1);
  await new Promise(r=>{const f=()=>{if(s.stats.shotgun.length)r();else requestAnimationFrame(f);};f();});gengi.aim(null);});
await sleep(40); await shot('v4d-escopeta-disparo.png');
await E(async()=>{const s=gengi.raid();gengi.clearEnemies();window.__pins.clear();await __waitGame(1.5);s.snap.elapsed=10*60-0.1;s.snap.fogT=10*60-0.1;s.snap.huntersWarned=false;await __waitGame(0.3);});
await shot('v4d-aviso-cazadores.png');
// niebla: después (v2) y antes (FOG2.enabled = false), quieto y girando a 540°/s, mismo sitio
for(const [tag,on] of [['despues',true],['antes',false]]){
  await endRaid(); await E(o=>{gengi.v4d().cfg.FOG2.enabled=o;},on);
  await newRaid(3131);
  await E(async()=>{const s=gengi.raid();__calm();s.snap.loadout.arma={uid:'qa-bate',def:'bate',rarity:'comun',qty:1};s.host.refreshInventory();s.facing=-Math.PI/2;await __waitGame(5);s.hud.msg.setAlpha(0);});
  await sleep(100); await shot(`v4d-niebla-${tag}-quieto.png`);
  await E(async()=>{const s=gengi.raid();window.__spin={a:s.facing,w:Math.PI*3};await __waitGame(0.45);});
  await shot(`v4d-niebla-${tag}-girando.png`);
  await E(()=>{window.__spin=null;});
}
await endRaid(); await E(()=>{gengi.v4d().cfg.FOG2.enabled=true;});
console.log('errs',errs.length,errs.slice(0,3).join(' | '));
await b.close();
