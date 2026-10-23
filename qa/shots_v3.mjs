// Capturas v3 (sigilo, indicadores, estados, curación, niebla, inventario) a 390×844: node qa/shots_v3.mjs [dir]
import puppeteer from 'puppeteer-core';
const dir=process.argv[2]||'/workspace/gengi/shots';
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
const b=await puppeteer.launch({executablePath:'/usr/bin/google-chrome',headless:'new',args:['--no-sandbox','--use-gl=swiftshader','--enable-unsafe-swiftshader']});
const p=await b.newPage(); await p.setViewport({width:390,height:844,isMobile:true,hasTouch:true,deviceScaleFactor:1});
const errs=[]; p.on('pageerror',e=>errs.push(e.message));
await p.goto('http://localhost:4173/?debug=1&noelite'); await p.waitForFunction(()=>window.gengi);
await p.evaluate(()=>gengi.reset()).catch(()=>{}); await sleep(700); await p.waitForFunction(()=>window.gengi);
const E=(f,...a)=>p.evaluate(f,...a);
await E(()=>gengi.start()); await sleep(2000);
await E(()=>{const s=gengi.raid();gengi.god(true);gengi.clearEnemies();s.snap.stream=null;s.snap.spawnTimer=-1e9;s.settings.curarUmbral=0;
  window.__pins=new Map();window.__meter=new Map();s.events.on('update',()=>{s.idleT=0;for(const [e,pos] of window.__pins){if(!e.dead){e.body.reset(pos.x,pos.y);if(pos.f!==undefined&&e.state==='idle'){e.facing=pos.f;e.turnT=1e9;}}}for(const [e,m] of window.__meter)if(!e.dead&&e.state==='idle')e.meter=m;});});
const calm=()=>E(()=>{const s=gengi.raid();window.__pins.clear();window.__meter.clear();gengi.clearEnemies();gengi.move(0,0);gengi.aim(null);s.hud.toast('',0.01);s.fx.corpses.forEach(c=>c.destroy());s.fx.corpses.length=0;});
const spot=r=>E(r=>{const s=gengi.raid();let o=null;for(let k=r;k>=2&&!o;k--)o=s.openSpot(k);s.player.setPosition(o.x,o.y);s.player.body.reset(o.x,o.y);s.vel.set(0,0);return o;},r);
// 1) sigilo: '?' (medidor a medias), '!' (acaba de verte), anillo de ruido, conos, botón Ejecutar
{await calm(); await spot(9);
 await E(()=>{const s=gengi.raid();gengi.give('bate','comun');const lo=s.snap.loadout;s.invEquip(lo.mochila.find(i=>i.def==='bate').uid);s.swapT=0;});
 await sleep(600);
 await E(()=>{const s=gengi.raid(),T=48,px=s.player.x,py=s.player.y;s.facing=-Math.PI/2;
   const pin=(t,dx,dy,f)=>{const e=s.spawnAt(t,px+dx*T,py+dy*T);e.state='idle';e.meter=0;e.facing=f;e.turnT=1e9;e.wander?.set(0,0);window.__pins.set(e,{x:e.x,y:e.y,f});return e;};
   pin('errante',0,-1.1,-Math.PI/2);                       // de espaldas, pegado: Ejecutar
   const q=pin('errante',-2.6,-3.6,Math.atan2(3.6,2.6));window.__meter.set(q,0.55); // te está viendo: '?'
   pin('corredor',3.2,-4.2,Math.PI*0.9);                    // conos de visión
   window.__al=pin('errante',2.8,1.8,Math.PI);
   gengi.move(0.3,0);});
 await sleep(900); await E(()=>{gengi.move(0,0);const s=gengi.raid();s.enemies.becomeAlert(window.__al,false);gengi.move(0.32,0);}); await sleep(450);
 await p.screenshot({path:`${dir}/v3-sigilo.png`}); await E(()=>gengi.move(0,0));}
// 2) indicadores: habilidades activas en fila, mini barra, sangrado ×3 y veneno ×2, escaneo 10 casillas
{await calm(); await spot(8);
 await E(()=>{const s=gengi.raid(),lo=s.snap.loadout;lo.torso={uid:'s-ch',def:'chaleco',rarity:'comun',qty:1};lo.cabeza={uid:'s-ca',def:'casco',rarity:'comun',qty:1};s.snap.player.cds={};
   const T=48;for(const [t,dx,dy] of [['errante',4,-6],['errante',-7,2],['hinchado',6,5],['errante',13,0]]){const e=s.spawnAt(t,s.player.x+dx*T,s.player.y+dy*T);e.turnT=1e9;window.__pins.set(e,{x:e.x,y:e.y});}});
 await sleep(200);
 await E(()=>{const s=gengi.raid();s.useAbility(s.abilityIds.indexOf('aguantar'));s.useAbility(s.abilityIds.indexOf('escanear'));gengi.god(false);s.snap.player.hp=30;s.addStatus('bleed',3);s.addStatus('poison',2);s.facing=-Math.PI/2;});
 await sleep(900); await p.screenshot({path:`${dir}/v3-indicadores-estados.png`});
 await E(()=>{const s=gengi.raid();s.snap.player.bleed=[];s.snap.player.poison=[];gengi.god(true);s.snap.player.hp=100;});}
// 3) curación: anillo de progreso (botiquín 2,5 s) moviéndose al 50 %
{await calm(); await spot(8);
 await E(()=>{const s=gengi.raid();gengi.give('botiquin','comun',2);gengi.god(false);s.snap.player.hp=45;s.snap.player.healLeft=0;s.useConsumable('botiquin',false);gengi.move(0.9,-0.3);});
 await sleep(1300); await p.screenshot({path:`${dir}/v3-curacion.png`}); await E(()=>{gengi.move(0,0);gengi.god(true);});}
// 4) niebla al 45 % con borde difuminado, junto a un edificio
{await calm();
 const pos=await E(()=>{const s=gengi.raid();const f=s.map.floors.slice().sort((a,b)=>b.w*b.h-a.w*a.h)[0];return {x:f.x+f.w/2,y:f.y+f.h+2.2*48};});
 await E(([x,y])=>{const s=gengi.raid();s.player.setPosition(x,y);s.player.body.reset(x,y);s.facing=-0.5;},[pos.x,pos.y]);
 await sleep(1200); await E(()=>gengi.raid().hud.toast('',0.01)); await sleep(150); await p.screenshot({path:`${dir}/v3-niebla.png`});}
// 5) inventario: menú contextual (se abre al soltar el toque)
{await calm(); await spot(6);
 await E(()=>{const s=gengi.raid();s.snap.loadout.mochila=[];for(const [id,q] of [['vendaje',2],['botiquin',1],['machete',1],['casco',1],['chaleco',1],['arco',1],['flechas',10],['municion',8],['tela',3],['bate',1],['machete',1],['vendaje',1]])gengi.give(id,'comun',q);gengi.inventory();});
 await sleep(300);
 await E(()=>{const el=document.querySelector('.sheet .scroll');el.scrollTop=140;}); await sleep(200);
 const c=await E(()=>{const sc=document.querySelector('.sheet .scroll').getBoundingClientRect();const c=[...document.querySelectorAll('.sheet .scroll [data-uid]')].map(el=>{const r=el.getBoundingClientRect();return {x:r.left+r.width/2,y:r.top+r.height/2,top:r.top,bottom:r.bottom}}).filter(c=>c.top>=sc.top+2&&c.bottom<=sc.bottom-2);return c[Math.floor(c.length/2)];});
 await p.touchscreen.tap(c.x,c.y); await sleep(500); await p.screenshot({path:`${dir}/v3-inventario-menu.png`});}
console.log('errores', JSON.stringify(errs));
await b.close();
