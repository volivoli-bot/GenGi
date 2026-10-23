// Capturas v2 a 390×844: node qa/shots_v2.mjs [dir]  (con vite preview en :4173)
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
await E(()=>{const s=gengi.raid();gengi.god(true);gengi.clearEnemies();s.snap.stream=null;s.snap.spawnTimer=-1e9;s.hud.toast('',0.01);s.fx.corpses.forEach(c=>c.destroy());s.fx.corpses.length=0;
  window.__pins=new Map();s.events.on('update',()=>{s.idleT=0;for(const [e,pos] of window.__pins){if(!e.dead)e.body.reset(pos.x,pos.y);}});});
const tp=(x,y,face)=>E(([x,y,face])=>{const s=gengi.raid();s.player.setPosition(x,y);s.player.body.reset(x,y);s.vel.set(0,0);s.facing=face;s.cameras.main.centerOn(x,y-60/s.cameras.main.zoom);},[x,y,face]);
const spawnPinned=(list)=>E((list)=>{const s=gengi.raid();for(const [k,dx,dy] of list){const e=s.spawnAt(k,s.player.x+dx*48,s.player.y+dy*48);e.state='idle';e.sees=false;e.sightT=1e9;window.__pins.set(e,{x:e.x,y:e.y});}},list);
// 1) cono de visión con niebla detrás y muros que tapan: en la calle junto a un edificio
{const pos=await E(()=>{const s=gengi.raid();const f=s.map.floors.slice().sort((a,b)=>b.w*b.h-a.w*a.h)[0];return {x:f.x+f.w/2,y:f.y+f.h+2.2*48};});
 await tp(pos.x,pos.y,-0.5); await spawnPinned([['errante',2.2,-2.6],['corredor',3,0.6],['errante',-2,-4.5],['errante',-1.2,3.2],['hinchado',-1.5,4.6]]);
 await sleep(1500); await p.screenshot({path:`${dir}/v2-cono-niebla.png`});}
await E(()=>{window.__pins.clear();gengi.clearEnemies();const s=gengi.raid();s.fx.corpses.forEach(c=>c.destroy());s.fx.corpses.length=0;});
// 2) línea de apuntado (pistola) estable
{await E(()=>{const s=gengi.raid();gengi.give('pistola','reforzado');gengi.give('municion','comun',30);const lo=s.snap.loadout;s.invEquip(lo.mochila.find(i=>i.def==='pistola').uid);lo.arma.mag=12;s.snap.player.reload=0;});
 const o=await E(()=>gengi.raid().openSpot(5)); await tp(o.x,o.y,-Math.PI/2);
 await spawnPinned([['errante',2.5,-6]]); await sleep(400);
 await E(()=>gengi.aim(0.38,-0.62)); await sleep(1100); await p.screenshot({path:`${dir}/v2-linea-apuntado.png`}); await E(()=>gengi.aim(null));}
await E(()=>{window.__pins.clear();gengi.clearEnemies();});
// 3) números de daño, sangre y manchas
{const o=await E(()=>gengi.raid().openSpot(5)); await tp(o.x,o.y,-Math.PI/2);
 await E(()=>{const s=gengi.raid();s.snap.loadout.arma.mag=0;}); // sin disparo automático durante la foto
 await spawnPinned([['errante',-1.6,-2.6],['errante',1.6,-3],['abominacion',0.2,-5.2]]); await sleep(600);
 await E(async()=>{const s=gengi.raid();const L=[...s.enemies.list];const D=s.dealDamage.bind(s);s.dealDamage=(e,...a)=>e.dead?false:D(e,...a);const w=ms=>new Promise(r=>setTimeout(r,ms));
   s.dealDamage(L[0],8,-Math.PI/2,'bate',false,55);s.dealDamage(L[1],12,-Math.PI/2,'pistola',false,50);await w(90);
   s.dealDamage(L[2],15,-Math.PI/2,'bate',false,55);s.dealDamage(L[0],14.4,-Math.PI/2,'bate',true,80);await w(90);
   s.dealDamage(L[2],21.6,-Math.PI/2,'bate',true,80);s.dealDamage(L[1],9,-Math.PI/2,'pistola',false,50);});
 await sleep(110); await p.screenshot({path:`${dir}/v2-numeros-danio.png`}); await E(()=>{const s=gengi.raid();delete s.dealDamage;});}
await E(()=>{window.__pins.clear();gengi.clearEnemies();});
// 4) menú contextual del inventario
{await E(()=>{gengi.give('vendaje','comun',3);gengi.give('machete','militar');gengi.give('casco','reforzado');gengi.inventory();}); await sleep(300);
 const c=await E(()=>{const el=[...document.querySelectorAll('.sheet [data-uid]')].find(e=>e.querySelector('img')?.alt==='Machete');const r=el.getBoundingClientRect();return {x:r.left+r.width/2,y:r.top+r.height/2}});
 await p.touchscreen.tap(c.x,c.y); await sleep(300); await p.screenshot({path:`${dir}/v2-menu-contextual.png`});
 await p.touchscreen.tap(c.x,c.y); await sleep(100);
 await p.touchscreen.touchStart(c.x,c.y); await sleep(650); await p.touchscreen.touchEnd(); await sleep(200); await p.screenshot({path:`${dir}/v2-comparar.png`});
 await E(()=>document.querySelector('.sheet .btn.x').click());}
// 5) interior de un edificio (baldosa, habitaciones, puertas)
{const pos=await E(()=>{const s=gengi.raid();const f=s.map.floors.slice().sort((a,b)=>b.w*b.h-a.w*a.h)[1];return {x:f.x+f.w*0.5,y:f.y+f.h*0.6};});
 await tp(pos.x,pos.y,-Math.PI/2); await sleep(1500); await p.screenshot({path:`${dir}/v2-interior-edificio.png`});}
// 6) arma de reserva en el HUD
{await E(()=>{const s=gengi.raid();gengi.give('arco','comun');gengi.give('flechas','comun',12);s.invEquip(s.snap.loadout.mochila.find(i=>i.def==='arco').uid);}); await sleep(400);
 await p.screenshot({path:`${dir}/v2-hud-reserva.png`});}
console.log('ok',errs); await b.close();
