// QA "Cámara y avisos fuera de pantalla": node qa/offscreen.mjs (con vite preview en :4173)
import puppeteer from 'puppeteer-core';
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
const res=[]; const ok=(n,c,i='')=>res.push(`${c?'PASS':'FAIL'} ${n} ${i}`);
const b=await puppeteer.launch({executablePath:'/usr/bin/google-chrome',headless:'new',args:['--no-sandbox','--use-gl=swiftshader','--enable-unsafe-swiftshader']});
const p=await b.newPage(); await p.setViewport({width:390,height:844,isMobile:true,hasTouch:true});
const errs=[]; p.on('pageerror',e=>errs.push(e.message));
await p.goto('http://localhost:4173/?debug=1'); await p.waitForFunction(()=>window.gengi);
await p.evaluate(()=>gengi.reset()).catch(()=>{}); await sleep(600); await p.waitForFunction(()=>window.gengi);
const E=(f,...a)=>p.evaluate(f,...a);
await E(()=>gengi.start()); await sleep(1200);
// escenario controlado: sin oleadas, sin Corredor de castigo, sin paredes para la línea de visión
// v2: la visión (cono + niebla) se prueba en qa/v2.mjs; aquí se aísla el criterio «en pantalla» con la visión apagada
await E(()=>{const s=gengi.raid();gengi.god(true);gengi.vision(false);gengi.clearEnemies();s.snap.stream=null;s.snap.spawnTimer=-1e9;
  s.walls.length=0;s.wallIndex.rebuild(s.walls);
  window.__pins=new Map();
  s.events.on('update',()=>{ s.idleT=0; for(const [e,pos] of window.__pins){ if(!e.dead){ e.body.reset(s.player.x+pos.dx,s.player.y+pos.dy); } } });
  window.__view=()=>{const v=s.cameras.main.worldView;return {w:v.width/48,h:v.height/48,zoom:s.cameras.main.zoom}}; });
const view=await E(()=>window.__view()); ok('zoom 1,4× ≈ 7 casillas de ancho', view.w>6.5&&view.w<7.6, JSON.stringify(view));
const T=48;
// A) Corredor fuera de pantalla dentro de su distancia de carga: puede acercarse pero NO cargar
const A=await E(async(T)=>{const s=gengi.raid();const e=s.spawnAt('corredor',s.player.x+4.3*T,s.player.y);e.state='chase';e.sees=true;e.sightT=1e9;
  window.__pins.set(e,{dx:4.3*T,dy:0});const seen=new Set();const t0=performance.now();
  while(performance.now()-t0<2500){seen.add(e.state);await new Promise(r=>requestAnimationFrame(r));}
  const arrows=JSON.parse(JSON.stringify(s.hud.threatShown));
  return {states:[...seen],off:s.enemies.teleStats.off,onScreen:s.onScreen(e.x,e.y),arrows,W:innerWidth};},T);
ok('Corredor fuera de pantalla nunca inicia la carga', !A.onScreen && !A.states.includes('windup') && !A.states.includes('attack') && A.off===0, JSON.stringify({states:A.states,off:A.off}));
// B) flecha roja en el borde para el enemigo que te ha detectado fuera de pantalla
const arrow=A.arrows.find(a=>a.type==='corredor');
ok('enemigo detectado fuera de pantalla → flecha roja en el borde', !!arrow && arrow.x>=A.W-40, JSON.stringify(arrow));
// control: al entrar en pantalla SÍ carga (el test es sensible)
const A2=await E(async(T)=>{const s=gengi.raid();const e=s.enemies.list.find(x=>x.def.type==='corredor');window.__pins.set(e,{dx:2.2*T,dy:0});
  const t0=performance.now();let w=false;while(performance.now()-t0<1500){if(e.state==='windup')w=true;await new Promise(r=>requestAnimationFrame(r));}
  return {w,on:s.enemies.teleStats.on,off:s.enemies.teleStats.off,arrows:s.hud.threatShown.length};},T);
ok('control: en pantalla el Corredor sí avisa y carga; sin flecha', A2.w && A2.on>0 && A2.off===0 && A2.arrows===0, JSON.stringify(A2));
await E(()=>{window.__pins.clear();gengi.clearEnemies();});
// C) el ataque automático a distancia ignora objetivos fuera de pantalla
const C=await E(async(T)=>{const s=gengi.raid();gengi.give('pistola','reforzado');gengi.give('municion','comun',24);
  const pis=s.snap.loadout.mochila.find(i=>i.def==='pistola');s.invEquip(pis.uid);s.snap.loadout.arma.mag=12;s.snap.player.reload=0;
  const e=s.spawnAt('errante',s.player.x+5*T,s.player.y);s.enemies.becomeAlert(e,false);e.sightT=1e9;window.__pins.set(e,{dx:5*T,dy:0}); // sigilo v3: el disparo automático ignora a los que no te han detectado → enemigo en alerta
  await new Promise(r=>setTimeout(r,100));
  const pickOff=s.pickTarget(6*T,false);const mag0=s.snap.loadout.arma.mag;
  await new Promise(r=>setTimeout(r,1500));const magOff=s.snap.loadout.arma.mag;const hpOff=e.hp;
  window.__pins.set(e,{dx:2.5*T,dy:0});await new Promise(r=>setTimeout(r,1200));
  return {pickOff:!!pickOff,mag0,magOff,hpOff,max:e.maxHp,magOn:s.snap.loadout.arma.mag,dead:e.dead,onScreenAt5:false};},T);
ok('ataque a distancia ignora enemigos fuera de pantalla', !C.pickOff && C.mag0===C.magOff && C.hpOff===C.max, JSON.stringify(C));
ok('control: en pantalla la pistola sí dispara', C.magOn<C.magOff || C.dead, `mag ${C.magOff}→${C.magOn}`);
await E(()=>{window.__pins.clear();gengi.clearEnemies();});
// E) Hinchado muerto FUERA de pantalla: explota igual (sin aviso previo exigido), daña a otros enemigos (cadena con otro Hinchado
//    y charco de ácido) y no puede tocar al jugador (fuera de la vista está a >1,8 casillas)
const E5=await E(async(T)=>{const s=gengi.raid();gengi.god(false);const p=s.snap.player;p.hp=100;
  const mk=(k,dx)=>{const e=s.spawnAt(k,s.player.x+dx*T,s.player.y);e.state='idle';e.sees=false;e.sightT=1e9;window.__pins.set(e,{dx:dx*T,dy:0});return e;};
  const h1=mk('hinchado',5), er1=mk('errante',5.8), h2=mk('hinchado',6.5), er2=mk('errante',8); h2.hp=15; // herido: la explosión (20) lo remata → cadena
  await new Promise(r=>setTimeout(r,100));
  const off=!s.onScreen(h1.x,h1.y,0)&&!s.onScreen(h2.x,h2.y,0);const hp0=p.hp, er1max=er1.hp, er2max=er2.hp;
  const n0=s.enemies.explosions.length; s.enemies.damage(h1,9999);
  const t0=performance.now();let swell1=false;
  while(performance.now()-t0<1400){if(h1.state==='swell')swell1=true;await new Promise(r=>requestAnimationFrame(r));}
  const er1AfterBlast=er1.hp, h2State=h2.state;
  await new Promise(r=>setTimeout(r,1000)); const er1Later=er1.hp;   // charco de ácido sigue restando
  await new Promise(r=>setTimeout(r,900));
  const ex=s.enemies.explosions.slice(n0);
  const res={off,swell1,h1dead:h1.dead,exps:ex.length,expOn:ex.map(x=>x.on),hits:ex.map(x=>x.hit),er1:[er1max,er1AfterBlast,er1Later],h2State,h2dead:h2.dead,er2:[er2max,er2.dead?0:er2.hp],hp:[hp0,p.hp],acid:s.snap.acid.length};
  window.__pins.clear();gengi.clearEnemies();gengi.god(true);s.snap.acid.length=0;return res;},T);
ok('Hinchado muerto fuera de pantalla explota igual', E5.off && E5.swell1 && E5.h1dead && E5.exps>=1 && E5.expOn[0]===false, JSON.stringify({off:E5.off,swell:E5.swell1,exps:E5.exps,expOn:E5.expOn}));
ok('la explosión daña a otros enemigos y encadena otro Hinchado', E5.er1[1]<=E5.er1[0]-20 && E5.h2dead && E5.exps>=2 && E5.er2[1]<E5.er2[0], JSON.stringify({er1:E5.er1,er2:E5.er2,h2:E5.h2State,hits:E5.hits}));
ok('el charco de ácido daña a enemigos', E5.er1[2]<E5.er1[1], JSON.stringify(E5.er1));
ok('jugador fuera del radio no recibe daño', E5.hp[0]===E5.hp[1], JSON.stringify(E5.hp));
// D) invariante con multitud real: ningún aviso (carga, embestida, círculo, cono, hinchazón) empieza fuera de pantalla
const D=await E(async(T)=>{const s=gengi.raid();s.walls.length=0;gengi.minute(6);const st=s.enemies.teleStats;st.on=0;st.off=0;const ds=s.enemies.deathSwell;ds.on=0;ds.off=0;
  const kinds=['errante','errante','errante','corredor','corredor','hinchado','errante','corredor','hinchado','errante','errante','corredor'];
  kinds.forEach((k,i)=>{const a=i/kinds.length*Math.PI*2,r=(4+i%5)*T;const e=s.spawnAt(k,s.player.x+Math.cos(a)*r,s.player.y+Math.sin(a)*r);e.state='chase';});
  const ab=s.spawnAt('abominacion',s.player.x,s.player.y-9*T);ab.gx=s.player.x;ab.gy=s.player.y;ab.state='chase';
  await new Promise(r=>setTimeout(r,9000));return {...st,deathSwell:{...ds}};},T);
ok('multitud 9 s: 0 avisos iniciados fuera de pantalla (las explosiones de muerte no cuentan como aviso)', D.off===0 && D.on>0, JSON.stringify(D));
console.log(res.join('\n'));console.log('ERRORES:',errs);
await b.close();
