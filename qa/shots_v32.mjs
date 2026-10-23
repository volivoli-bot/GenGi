// Capturas v3.1 §9 (jugador nuevo, ballesta, críticos, memoria de visión, Trapero, élites, reputación) a 390×844:
// node qa/shots_v32.mjs [dir]
import puppeteer from 'puppeteer-core';
const dir=process.argv[2]||'/workspace/gengi/shots';
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
const b=await puppeteer.launch({executablePath:'/usr/bin/google-chrome',headless:'new',args:['--no-sandbox','--use-gl=swiftshader','--enable-unsafe-swiftshader']});
const p=await b.newPage(); await p.setViewport({width:390,height:844,isMobile:true,hasTouch:true,deviceScaleFactor:1});
const errs=[]; p.on('pageerror',e=>errs.push(e.message));
await p.goto('http://localhost:4173/?debug=1&noelite'); await p.waitForFunction(()=>window.gengi);
await p.evaluate(()=>gengi.reset()).catch(()=>{}); await sleep(700); await p.waitForFunction(()=>window.gengi);
const E=(f,...a)=>p.evaluate(f,...a);
const shot=async n=>{await p.screenshot({path:`${dir}/${n}.png`});console.log('ok',n);};
const waitFor=(fn,ms=8000)=>p.waitForFunction(fn,{timeout:ms,polling:20}).catch(()=>console.log('timeout',fn.toString().slice(0,60)));
async function raid(){
  await E(()=>{const s=gengi.raid();if(s&&!s.ended)s.host.endRaid('extraido',{exit:s.snap.exits[0]});}); await sleep(500);
  await E(()=>gengi.start()); await sleep(2000); await p.waitForFunction(()=>gengi.raid()&&gengi.raid().hud);
  await E(()=>{const s=gengi.raid();gengi.god(true);gengi.clearEnemies();s.snap.stream=null;s.snap.spawnTimer=-1e9;
    window.__pins=new Map();s.events.on('update',()=>{s.idleT=0;s.snap.spawnTimer=Math.min(s.snap.spawnTimer,-1e6);for(const [e,pos] of window.__pins){if(!e.dead)e.body.reset(pos.x,pos.y);}});});
}
const calm=()=>E(()=>{const s=gengi.raid();window.__pins.clear();gengi.clearEnemies();gengi.move(0,0);gengi.aim(null);s.hud.toast('',0.01);s.fx.corpses.forEach(c=>c.destroy());s.fx.corpses.length=0;});
const spot=r=>E(r=>{const s=gengi.raid();let o=null;for(let k=r;k>=2&&!o;k--)o=s.openSpot(k);s.player.setPosition(o.x,o.y);s.player.body.reset(o.x,o.y);s.vel.set(0,0);return o;},r);
const arm=(id,ammo,n=20)=>E(([id,ammo,n])=>{const s=gengi.raid();gengi.give(id,'comun',1);if(ammo)gengi.give(ammo,'comun',n);const it=s.snap.loadout.mochila.find(i=>i.def===id);s.invEquip(it.uid);},[id,ammo,n]);
await E(()=>gengi.chapas(3000));
// ---- jugador nuevo de Basu ----
await raid();
{await calm();await spot(7);await arm('machete');await sleep(700);
 await E(()=>{const s=gengi.raid();s.facing=-Math.PI/2;gengi.move(0,-0.55);});await sleep(900);await E(()=>gengi.move(0,0));await sleep(250);
 await shot('v3_1-jugador-nuevo');
 await E(()=>{gengi.move(1,0);});await sleep(700);await shot('v3_1-jugador-nuevo-corriendo');await E(()=>gengi.move(0,0));}
// ---- ballesta: virote en vuelo hacia un enemigo + virote caído con brillo ----
{await calm();await spot(9);await arm('ballesta','virotes',12);await sleep(1500);
 await E(()=>{const s=gengi.raid(),T=48;s.facing=-Math.PI/2;s.viewFacing=-Math.PI/2;s.dropArrow(s.player.x+1.6*T,s.player.y-1.2*T,1,'virotes');s.dropArrow(s.player.x-2*T,s.player.y-2.5*T,2,'flechas');
   const e=s.spawnAt('errante',s.player.x+0.3*T,s.player.y-6.5*T,undefined,false);s.enemies.becomeAlert(e,false);window.__pins.set(e,{x:e.x,y:e.y});s.useAbility(0);s.attackT=0;s.fireRanged(Math.atan2(e.y-s.player.y,e.x-s.player.x),false);});
 await sleep(330); await shot('v3_1-ballesta-clavar');}
// ---- números: normal, crítico y recibido ----
{await calm();await spot(8);await arm('machete');
 await E(()=>{const s=gengi.raid(),T=48;s.facing=-Math.PI/2;const a=s.spawnAt('bruto',s.player.x-1.4*T,s.player.y-3.2*T,undefined,false);const c=s.spawnAt('errante',s.player.x+1.6*T,s.player.y-3*T,undefined,false);for(const e of [a,c]){e.hp=e.maxHp=1e4;e.state='idle';e.turnT=1e9;window.__pins.set(e,{x:e.x,y:e.y});}
   s.dealDamage(a,21,0,'machete',false);setTimeout(()=>s.dealDamage(c,34,0,'machete',true),90);setTimeout(()=>{gengi.god(false);s.snap.player.hp=100;const C=gengi.cfg31.DAMAGE.enemy;const k=C.critChance;C.critChance=1;s.damagePlayer(6,'Errante');C.critChance=k;gengi.god(true);},160);});
 await sleep(330); await shot('v3_1-numeros-critico');}
// ---- memoria de visión: fantasma quieto al girarte ----
{await calm();await spot(8);
 await E(()=>{const s=gengi.raid(),T=48;s.facing=-Math.PI/2;s.viewFacing=-Math.PI/2;for(const dx of [-1.5,1.2]){const e=s.spawnAt(dx<0?'corredor':'errante',s.player.x+dx*T,s.player.y-4*T,undefined,false);e.state='idle';e.turnT=1e9;window.__pins.set(e,{x:e.x,y:e.y});}});
 await sleep(800); await E(()=>{gengi.raid().facing=Math.PI/2;}); await sleep(230); await shot('v3_1-fantasma-memoria');}
// ---- élites con aura dorada ----
{await calm();await spot(9);
 await E(()=>{const s=gengi.raid(),T=48;s.facing=-Math.PI/2;s.viewFacing=-Math.PI/2;const n=s.spawnAt('errante',s.player.x-1.8*T,s.player.y-3.6*T,undefined,false);const a=gengi.elite('errante',0.6,-4);const b=gengi.elite('bruto',2.2,-5.6);
   for(const e of [n,a,b]){e.state='idle';e.facing=Math.PI/2;e.turnT=1e9;window.__pins.set(e,{x:e.x,y:e.y});}});
 await sleep(900); await shot('v3_1-elites');}
// ---- el Trapero: caseta y tienda ----
{let ok=false;for(let i=0;i<12&&!ok;i++){ok=await E(()=>!!gengi.v31().trapero);if(!ok)await raid();}
 if(ok){await calm();
  await E(()=>{const s=gengi.raid(),T=48;const t=s.snap.trapero;s.player.body.reset(t.x-0.4*T,t.y+2.6*T);s.player.setPosition(t.x-0.4*T,t.y+2.6*T);s.facing=-Math.PI/2;s.viewFacing=-Math.PI/2;});
  await sleep(1200); await shot('v3_1-trapero-caseta');
  await E(()=>{const s=gengi.raid();const lo=s.snap.loadout;for(const [id,q] of [['mat_chatarra',6],['mat_tela',3],['mat_componentes',2]])lo.mochila.push({uid:'sh-'+id,def:id,rarity:'comun',qty:q,raid:s.snap.id});gengi.give('mat_combustible','comun',2);s.traperoSell('sh-mat_chatarra');gengi.inventory();});
  await sleep(600); await E(()=>{const el=document.querySelector('.trapero');if(el)el.scrollIntoView({block:'start'});}); await sleep(250); await shot('v3_1-trapero-tienda');
  await E(()=>{document.querySelector('.btn.x')?.click();});
 } else console.log('sin Trapero en 12 incursiones');}
// ---- reputación: misión necesaria para nivel 3 ----
await E(()=>{const s=gengi.raid();if(s&&!s.ended)s.host.endRaid('extraido',{exit:s.snap.exits[0]});}); await sleep(600);
await E(()=>{document.querySelectorAll('.overlay button, .card button').forEach(b=>/Refugio|Continuar/.test(b.textContent)&&b.click());});
await E(()=>{gengi.repXp('doc',900);gengi.tab('tiendas','doc');}); await sleep(500); await E(()=>{const el=document.querySelector('.scroll');if(el)el.scrollTop=0;}); await sleep(200); await shot('v3_1-reputacion-mision');
// ---- jugador anterior (bandera PLAYER_ART = 'v2') para comparar ----
await E(()=>{gengi.cfg31.PLAYER_ART.version='v2';}); await raid(); await calm(); await spot(7); await arm('machete');
await E(()=>{const s=gengi.raid();s.facing=-Math.PI/2;}); await sleep(700); await shot('v3_1-jugador-anterior');
console.log('errores', JSON.stringify(errs));
await b.close();
