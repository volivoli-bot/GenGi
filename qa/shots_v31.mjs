// Capturas v3.1 (refugio, tiendas, misiones, enemigos nuevos, mutaciones, granada, inventario con espalda) a 390×844:
// node qa/shots_v31.mjs [dir]
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
// ---- refugio y tiendas ----
await E(()=>{for(const [id,q] of [['mat_chatarra',20],['mat_tela',14],['mat_componentes',9],['mat_combustible',8],['mat_muestra',5]])gengi.give(id,'comun',q);gengi.chapas(2600);gengi.op('upgrade','generador');gengi.op('upgrade','bolsillo');gengi.op('upgrade','enfermeria');gengi.op('craft','vendajes');gengi.raids(4);});
await E(()=>gengi.tab('refugio')); await sleep(400); await shot('v31-refugio');
await E(()=>{const el=document.querySelector('.hub .scroll, .scroll');if(el)el.scrollTop=520;}); await sleep(200); await shot('v31-refugio-fabricar');
await E(()=>{gengi.repXp('doc',850);gengi.tab('tiendas','doc');}); await sleep(400); await shot('v31-tienda-doc');
await E(()=>{gengi.repXp('chispas',1700);gengi.missions('chispas',2);gengi.tab('tiendas','chispas');}); await sleep(400); await E(()=>{const el=document.querySelector('.scroll');if(el)el.scrollTop=0;}); await sleep(200); await shot('v31-tienda-chispas-rep4');
await E(()=>{const m=document.querySelector('.tiendas .vhead');if(m)m.scrollIntoView({block:'start'});}); await sleep(200); await shot('v31-misiones');
await E(()=>gengi.tab('equipo')); await sleep(300); await E(()=>{const el=document.querySelector('.scroll');if(el)el.scrollTop=0;}); await sleep(200); await shot('v31-equipo-bolsillos');
// ---- raid ----
await E(()=>{gengi.give('mochila_media','comun',1);gengi.equipFromStash('mochila_media');gengi.start();}); await sleep(2200);
await E(()=>{const s=gengi.raid();gengi.god(true);gengi.clearEnemies();s.snap.stream=null;s.snap.spawnTimer=-1e9;
  window.__pins=new Map();s.events.on('update',()=>{s.idleT=0;s.snap.spawnTimer=Math.min(s.snap.spawnTimer,-1e6);for(const [e,pos] of window.__pins){if(!e.dead)e.body.reset(pos.x,pos.y);}});});
const calm=()=>E(()=>{const s=gengi.raid();window.__pins.clear();gengi.clearEnemies();gengi.move(0,0);gengi.aim(null);s.hud.toast('',0.01);s.fx.corpses.forEach(c=>c.destroy());s.fx.corpses.length=0;});
const spot=r=>E(r=>{const s=gengi.raid();let o=null;for(let k=r;k>=2&&!o;k--)o=s.openSpot(k);s.player.setPosition(o.x,o.y);s.player.body.reset(o.x,o.y);s.vel.set(0,0);return o;},r);
const waitFor=(fn,ms=8000)=>p.waitForFunction(fn,{timeout:ms,polling:20}).catch(()=>console.log('timeout',fn.toString().slice(0,60)));
// Escupidor: saco cargado y bola de ácido por encima de la niebla
{await calm();await spot(8);
 await E(()=>{const s=gengi.raid(),T=48;s.facing=-Math.PI/2;window.__f=()=>{s.facing=-Math.PI/2;};s.events.on('update',window.__f);const e=s.spawnAt('escupidor',s.player.x+1*T,s.player.y-5*T);s.enemies.becomeAlert(e,false);window.__pins.set(e,{x:e.x,y:e.y});window.__e=e;});
 await waitFor(()=>window.__e.state==='windup'&&window.__e.t<0.25); await shot('v31-escupidor-aviso');
 await waitFor(()=>gengi.raid().enemies.v3.balls.length>0); await sleep(250); await shot('v31-escupidor-acido');
 await E(()=>gengi.raid().events.off('update',window.__f));}
// Chillón: se yergue y grita (onda)
{await calm();await spot(8);
 await E(()=>{const s=gengi.raid(),T=48;s.facing=-Math.PI/2;const e=s.spawnAt('chillon',s.player.x-1*T,s.player.y-5*T);s.enemies.becomeAlert(e,false);window.__pins.set(e,{x:e.x,y:e.y});window.__e=e;});
 await waitFor(()=>window.__e.state==='windup'&&window.__e.t<0.5); await shot('v31-chillon-grito');}
// Acechador: borde rojo y revelado justo antes del golpe
{await calm();await spot(8);
 await E(()=>{const s=gengi.raid(),T=48;s.facing=-Math.PI/2;const e=s.spawnAt('acechador',s.player.x+2*T,s.player.y+5*T);s.enemies.becomeAlert(e,false);window.__e=e;});
 await sleep(900); await shot('v31-acechador-acecha');
 await waitFor(()=>window.__e.state==='windup'&&window.__e.t<0.45,15000); await shot('v31-acechador-revelado');}
// Bruto: placa frontal y aviso de golpe / carga
{await calm();await spot(9);
 await E(()=>{const s=gengi.raid(),T=48;s.facing=-Math.PI/2;const e=s.spawnAt('bruto',s.player.x,s.player.y-4.5*T);e.facing=Math.PI/2;s.enemies.becomeAlert(e,false);window.__e=e;});
 await waitFor(()=>window.__e.state==='windup',15000); await sleep(300); await shot('v31-bruto-aviso');}
// Reptante: burbujas en la alcantarilla y agarre
{await calm();await spot(8);
 await E(()=>{const s=gengi.raid();s.enemies.v3.grabImm=0;gengi.reptante(1.2,0);s.facing=0;});
 await waitFor(()=>gengi.raid().enemies.list.some(e=>e.sub==='warn')); await sleep(400); await shot('v31-reptante-burbujas');
 await waitFor(()=>!!gengi.raid().enemies.v3.grab); await sleep(200); await shot('v31-reptante-agarre');
 await waitFor(()=>!gengi.raid().enemies.v3.grab);}
// Enjambre: mancha oscura y borde que vibra
{await calm();await spot(9);
 await E(()=>{const s=gengi.raid();s.facing=0;gengi.swarm(0,9.5,11);for(const e of s.enemies.list)s.enemies.becomeAlert(e,false);});
 await sleep(1100); await shot('v31-enjambre-borde');
 await sleep(1300); await shot('v31-enjambre-cerca');}
// Mutados con aura
{await calm();await spot(9);
 await E(()=>{const s=gengi.raid(),T=48;gengi.minute(11);s.facing=-Math.PI/2;const ms=['veloz','blindado','volatil','regenerador'];
   ms.forEach((m,i)=>{const e=s.spawnAt(i%2?'corredor':'errante',s.player.x+(-2.4+i*1.6)*T,s.player.y-3.5*T);s.enemies.mutate(e,m);e.state='idle';e.facing=Math.PI/2;e.turnT=1e9;window.__pins.set(e,{x:e.x,y:e.y});});});
 await sleep(700); await shot('v31-mutados');}
// Granada: aviso en el suelo
{await calm();await spot(8);
 await E(()=>{const s=gengi.raid(),T=48;s.facing=-Math.PI/2;gengi.give('granada','comun',1);for(let i=0;i<3;i++){const e=s.spawnAt('errante',s.player.x+(i-1)*T,s.player.y-5*T);window.__pins.set(e,{x:e.x,y:e.y});}gengi.grenade();});
 await sleep(650); await shot('v31-granada');}
// Inventario: espalda + bolsillo de 2 casillas
{await calm();await spot(6);
 await E(()=>{const s=gengi.raid();for(const [id,q] of [['vendaje',2],['adrenalina',1],['antidoto',1],['mat_chatarra',4],['mat_tela',2],['granada',1]])gengi.give(id,'comun',q);const lo=s.snap.loadout;const a=lo.mochila.find(i=>i.def==='adrenalina');if(a)s.invToPocket(a.uid);gengi.inventory();});
 await sleep(500); await shot('v31-inventario-espalda');}
console.log('errores', JSON.stringify(errs));
await b.close();
