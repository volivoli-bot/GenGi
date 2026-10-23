// QA v4.2 Zona Helada (diseno-v4 §4): enemigos de la nieve (Congelado, Lobo mutado, Escarcha) y La Matriarca.
// node qa/v42.mjs [url]
import puppeteer from 'puppeteer-core';
const BASE=process.argv[2]||process.env.GENGI_BASE||'http://localhost:4178/';
const URL=BASE+'?debug=1';
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
window.__calm=()=>{const s=gengi.raid();gengi.god(true);gengi.clearEnemies();s.snap.stream=null;s.snap.spawnTimer=-1e9;gengi.move(0,0);gengi.aim(null);gengi.cfg31.ELITE.chance=0;s.snap.xp=0;s.snap.xpBy={};
  if(!window.__hooked||window.__hookedScene!==s){window.__hooked=true;window.__hookedScene=s;s.events.on('update',()=>{s.idleT=0;s.snap.spawnTimer=Math.min(s.snap.spawnTimer,-1e6);});}};
window.__gt=()=>gengi.raid().snap.elapsed;
window.__waitGame=sec=>new Promise(r=>{const t0=__gt();const f=()=>{if(__gt()-t0>=sec)r();else setTimeout(f,20)};f();});
window.__tp=(x,y)=>{const s=gengi.raid();s.player.setPosition(x,y);s.vel.set(0,0);s.player.body.reset(x,y);};
window.__seed=n=>{let a=n>>>0;Math.random=()=>{a=a+0x6D2B79F5|0;let t=Math.imul(a^a>>>15,1|a);t=t+Math.imul(t^t>>>7,61|t)^t;return((t^t>>>14)>>>0)/4294967296;};};window.__snowK=0;window.__snowPt=()=>{const s=gengi.raid();const L=s.map.snow.lair;const pts=[];const st=T/2;for(let x=L.cx-L.w*0.4;x<=L.cx+L.w*0.4;x+=st)for(let y=L.cy-L.h*0.4;y<=L.cy+L.h*0.4;y+=st){if(!s.snowy(x,y)||!s.snowy(x+T*5,y))continue;if(s.walls.some(w=>w.x<x+T*6&&w.x+w.w>x-T*1.5&&w.y<y+T*4.5&&w.y+w.h>y-T*1.5))continue;pts.push({x,y});}if(!pts.length)return {x:L.cx,y:L.cy};return pts[(window.__snowK++*7919)%pts.length];};
window.__boss=()=>{const s=gengi.raid();const L=s.map.snow.lair;const e=s.spawnAt('matriarca',L.cx,L.cy,undefined,false);e.gx=L.cx;e.gy=L.cy;e.lair=true;return e;};
`;
async function endRaid(){ await E(()=>{const s=gengi.raid();if(s&&!s.ended)s.host.endRaid('extraido',{exit:s.snap.exits[0]});}); await sleep(500); await E(()=>document.querySelectorAll('.overlay button, .card button').forEach(b=>{if(/Volver|Continuar|Refugio/i.test(b.textContent))b.click();})); await sleep(300); }
async function newRaid(seed=null){ await endRaid(); await E(sd=>{gengi.seedNext(sd);gengi.start();},seed); await sleep(1600); await p.waitForFunction(()=>gengi.raid()&&gengi.raid().hud,{timeout:20000}); await E(setup); }

await newRaid(4242);
// ---------- A. La guarida tiene a La Matriarca ----------
{const r=await E(()=>{const s=gengi.raid();const m=s.enemies.list.find(e=>e.def.type==='matriarca');const L=s.map.snow.lair;
  return m?{n:s.enemies.list.filter(e=>e.def.type==='matriarca').length,lair:m.lair,hp:m.maxHp,inLair:Math.hypot(m.x-L.cx,m.y-L.cy)/T,rig:m.rig.kind,arms:m.rig.parts.filter(p=>p.texture.key==='v4/matriarca_brazo').length,body:m.rig.parts.some(p=>p.texture.key==='v4/matriarca_cuerpo'),abom:s.enemies.list.filter(e=>e.def.type==='abominacion'&&e.lair).length}:null;});
 ok('A1 la guarida de la Zona Helada tiene a La Matriarca (2.000 de vida ×1,3 nieve, arte de Basu con brazos)', r&&r.n===1&&r.lair&&r.hp>=2000*1.3-1&&r.inLair<4&&r.rig==='v3'&&r.arms===2&&r.body&&r.abom===0, JSON.stringify(r));}
await E(()=>__calm());
// ---------- B. Enemigos de la nieve ----------
{const r=await E(()=>{const s=gengi.raid();const pt=__snowPt();const out={};
  const c=s.spawnAt('errante',pt.x,pt.y,undefined,false);out.congelado=c.def.type;out.ice=c.ice;
  const n0=s.enemies.list.filter(e=>e.def.type==='lobo').length;const l=s.spawnAt('corredor',pt.x+T,pt.y,undefined,false);const wolves=s.enemies.list.filter(e=>e.def.type==='lobo');
  out.lobo=l.def.type;out.pack=wolves.length-n0;out.sides=wolves.map(w=>w.flankSide).sort();
  const es=s.spawnAt('escupidor',pt.x-T,pt.y,undefined,false);out.escarcha=es.def.type;
  const out0=s.spawnAt('errante',s.player.x+T*3,s.player.y,undefined,false);out.outside=s.snowy(out0.x,out0.y)?'nieve':out0.def.type;
  out.rigs=[c,l,es].map(e=>e.rig.parts[0]?.texture.key);
  return out;});
 ok('B1 en la nieve: Errante → Congelado, Corredor → manada de 3 Lobos (rodean por los dos lados), Escupidor → Escarcha; fuera no cambia', r.congelado==='congelado'&&r.ice===true&&r.lobo==='lobo'&&r.pack===3&&r.sides.includes(-1)&&r.sides.includes(1)&&r.escarcha==='escarcha'&&r.outside==='errante', JSON.stringify(r));
 ok('B1 arte de Basu: congelado, lobo_mutado, escarcha', JSON.stringify(r.rigs)===JSON.stringify(['v4/congelado','v4/lobo_mutado','v4/escarcha']), JSON.stringify(r.rigs));}
await E(()=>__calm());
{const r=await E(()=>{const s=gengi.raid();const pt=__snowPt();const c=s.spawnAt('errante',pt.x,pt.y,undefined,false);c.hp=c.maxHp=100;
  s.enemies.damage(c,20,{silent:true});const h1=c.hp;const ice1=c.ice;s.enemies.damage(c,20,{silent:true});const h2=c.hp;
  const snap=s.enemies.snapshot?s.enemies.snapshot():null;
  const c2=s.spawnAt('errante',pt.x+T,pt.y,undefined,false);const sn=s.enemies.snapshot?s.enemies.snapshot().find(x=>x.type==='congelado'&&x.ice):null;
  return {h1,ice1,h2,ice2:c.ice,tint:c.baseTint,snapIce:!!sn,breaks:s.enemies.v4.stats.shellBreaks};});
 ok('B2 Congelado: el primer golpe solo rompe el hielo (50 %), el segundo hace daño completo; el caparazón se guarda', r.h1===90&&r.ice1===false&&r.h2===70&&r.tint===null&&r.snapIce&&r.breaks>=1, JSON.stringify(r));}
await E(()=>__calm());
{const r=await E(async()=>{__seed(42);const s=gengi.raid();const pt=__snowPt();__tp(pt.x,pt.y+T*3);
  const cnt={bleed:0};const orig=s.addStatus.bind(s);s.addStatus=(k,n)=>{if(k==='bleed')cnt.bleed++;};
  const w=s.spawnAt('corredor',pt.x,pt.y,undefined,false);const g=s.spawnAt('errante',s.player.x+T*6,s.player.y+T*6,undefined,false);
  const N=600;let wb=0,gb=0;
  for(let i=0;i<N;i++){w.hitDone=false;w.t=1;w.body.reset(s.player.x,s.player.y);w.x;cnt.bleed=0;s.enemies.updateAttack(w,0,s.player.x,s.player.y);wb+=cnt.bleed;}
  for(let i=0;i<N;i++){g.hitDone=false;g.t=1;cnt.bleed=0;s.enemies.updateAttack(g,0,g.x,g.y);gb+=cnt.bleed;}
  s.addStatus=orig;return {wolf:wb/N,base:gb/N,ai:w.ai};});
 ok('B3 Lobo mutado: ataca como el Corredor y su mordisco sangra el 50 % de las veces', r.ai==='corredor'&&Math.abs(r.wolf-0.5)<0.07&&r.base<r.wolf-0.1, JSON.stringify(r));}
await E(()=>__calm());
{const r=await E(async()=>{__seed(7);const s=gengi.raid();const pt=__snowPt();__tp(pt.x,pt.y);s.chillInGod=true;const p0=s.snap.player.poison?.length??0;
  const e=s.spawnAt('escupidor',pt.x+T*3,pt.y,undefined,false);s.enemies.v3.spit(e,Math.PI);const h0=s.enemies.v3.iceHits;
  for(let i=0;i<60&&s.enemies.v3.iceHits===h0;i++)await new Promise(r=>setTimeout(r,30));
  s.enemies.kill(e);const k=s.chill.k,t=s.chill.t;const tex=s.enemies.v3.balls[0]?.img.texture.key;
  // velocidad máxima con frío
  const plates=s.snowR?.plates;if(s.snowR)s.snowR.plates=[]; // v4b: sin placas de hielo (la inercia ×2 falsea la medida)
  const P=()=>({x:s.player.x,y:s.player.y});gengi.move(1,0);await __waitGame(0.15);let a=P();let g0=__gt();await __waitGame(0.4);let b=P();const vSlow=Math.hypot(b.x-a.x,b.y-a.y)/(__gt()-g0);
  s.chill.t=0;s.chill.k=0;await __waitGame(0.15);a=P();g0=__gt();await __waitGame(0.4);b=P();const vFree=Math.hypot(b.x-a.x,b.y-a.y)/(__gt()-g0);gengi.move(0,0);
  if(s.snowR)s.snowR.plates=plates;s.chillInGod=false;return {hits:s.enemies.v3.iceHits-h0,k,t,poison:(s.snap.player.poison?.length??0)-p0,vRatio:vSlow/vFree};});
 ok('B4 Escarcha: el hielo ralentiza un 40 % durante 2 s, sin veneno', r.hits===1&&Math.abs(r.k-0.4)<1e-6&&r.t>1.5&&r.t<=2&&r.poison===0&&Math.abs(r.vRatio-0.6)<0.08, JSON.stringify(r));}
// ---------- C. La Matriarca ----------
await E(()=>__calm());
{const r=await E(async()=>{const s=gengi.raid();const B=__boss();const V=s.enemies.v4;const st=V.state(B);const L=s.map.snow.lair;
  const out={};
  // pisotón: dentro del anillo (2 casillas) → golpe; fuera (4) → nada
  __tp(B.x,B.y+T*2);V.stats.stompHits=0;V.start(B,st,'stomp');out.warn=st.gfx[0]?.texture?.key;await __waitGame(1.15);out.in=V.stats.stompHits;
  __tp(B.x,B.y+T*2);V.start(B,st,'stomp');__tp(B.x,B.y+T*4);await __waitGame(1.15);out.out=V.stats.stompHits-out.in;
  return out;});
 ok('C1 Pisotón: aviso en anillo (aviso_onda) 1 s; golpea dentro de 3 casillas y se esquiva saliendo', r.warn==='v4/aviso_onda'&&r.in===1&&r.out===0, JSON.stringify(r));}
await E(()=>__calm());
{const r=await E(async()=>{const s=gengi.raid();const B=__boss();const V=s.enemies.v4;const st=V.state(B);const out={};
  __tp(B.x,B.y+T*4);V.stats.lanceHits=0;V.stats.lanceBlocked=0;V.start(B,st,'lances');out.n=st.lines.length;out.warn=st.gfx[0]?.texture?.key;out.lens=st.lines.map(l=>+(l.len/T).toFixed(1));
  await __waitGame(0.5);out.early=V.stats.lanceHits;await __waitGame(0.45);out.hit=V.stats.lanceHits;
  // la columna corta la línea: si la línea central acaba antes del jugador, no le da
  __tp(B.x,B.y+T*4);V.start(B,st,'lances');st.lines[1].len=T*2;st.lines[0].ang+=1;st.lines[2].ang-=1;await __waitGame(0.95);out.blocked=V.stats.lanceBlocked;out.hit2=V.stats.lanceHits-out.hit;
  return out;});
 ok('C2 Lanzas de hielo: 3 líneas marcadas 0,8 s (aviso_lanza_hielo); golpean al terminar el aviso; una pared/columna en medio te protege', r.n===3&&r.warn==='v4/aviso_lanza_hielo'&&r.early===0&&r.hit===1&&r.blocked>=1&&r.hit2===0, JSON.stringify(r));}
await E(()=>__calm());
{const r=await E(async()=>{const s=gengi.raid();const B=__boss();const V=s.enemies.v4;const st=V.state(B);s.chillInGod=true;const out={};
  __tp(B.x,B.y+T*3);B.facing=Math.PI/2;const t0=V.stats.breathTicks;V.start(B,st,'breath');await __waitGame(0.4);out.slowWarn=s.chill.t>0;
  await __waitGame(1.2);out.k=s.chill.k;out.ticks=V.stats.breathTicks-t0;await __waitGame(1.2);out.puddles=V.puddles.length;
  out.pud=V.puddles.map(p=>+p.t.toFixed(1));const pd=V.puddles[0];if(pd){s.chill.t=0;s.chill.k=0;__tp(pd.x,pd.y);await __waitGame(0.3);out.pk=s.chill.k;}
  s.chillInGod=false;return out;});
 ok('C3 Aliento helado: aviso 0,6 s y cono de 60° 2 s que ralentiza mucho; deja charcos de hielo 6 s que ralentizan', !r.slowWarn&&r.k>=0.6&&r.ticks>=2&&r.puddles>=1&&r.pud.every(t=>t<=6&&t>4)&&r.pk===0.4, JSON.stringify(r));}
await E(()=>__calm());
{const r=await E(async()=>{const s=gengi.raid();const B=__boss();const V=s.enemies.v4;const st=V.state(B);const out={};
  __tp(B.x,B.y+T*4);s.facing=-Math.PI/2;s.viewFacing=-Math.PI/2;st.engaged=true;B.state='chase';B.cd=99;
  const n0=s.enemies.list.length;B.hp=B.maxHp*0.59;await __waitGame(1.4);
  out.calls=V.stats.calls;out.new=s.enemies.list.filter(e=>e!==B).reduce((m,e)=>{m[e.def.type]=(m[e.def.type]??0)+1;return m;},{});
  B.hp=B.maxHp*0.55;await __waitGame(0.5);out.calls2=V.stats.calls;
  return out;});
 ok('C4 Llamada al 60 %: grita y salen 4 Congelados y 2 Lobos (una sola vez por umbral)', r.calls===1&&r.new.congelado===4&&r.new.lobo===2&&r.calls2===1, JSON.stringify(r));}
await E(()=>__calm());
{const r=await E(async()=>{const s=gengi.raid();const B=__boss();const V=s.enemies.v4;const st=V.state(B);const out={};
  __tp(B.x,B.y+T*2);s.facing=-Math.PI/2;s.viewFacing=-Math.PI/2;st.engaged=true;B.state='chase';st.calls=[0.6,0.3];B.hp=B.maxHp*0.35;const ic0=V.stats.icicles;
  const l0=V.stats.lances;V.start(B,st,'stomp');await __waitGame(1.1);out.chain=st.atk;out.lances=V.stats.lances-l0;
  await __waitGame(3.5);out.phase2=V.stats.phase2;out.icicles=V.stats.icicles-ic0;out.shadow=V.icicles[0]?.img.texture.key??'(ya cayó)';
  return out;});
 ok('C5 Fase 2 (< 40 %): encadena pisotón + lanzas y caen carámbanos con sombra 1 s antes', r.phase2&&r.chain==='lances'&&r.lances===1&&r.icicles>=1, JSON.stringify(r));}
await E(()=>__calm());
{const r=await E(()=>{const s=gengi.raid();const B=__boss();B.hp=B.maxHp=1000;B.facing=0;
  s.enemies.damage(B,10,{ang:0,silent:true});const back=1000-B.hp;s.enemies.damage(B,10,{ang:Math.PI,silent:true});const front=1000-back-B.hp;
  return {back,front,stag:B.stagger};});
 ok('C6 Punto débil: daño ×2 por la espalda; resistente al tambaleo', r.back===20&&r.front===10&&r.stag===0, JSON.stringify(r));}
await E(()=>__calm());
{const r=await E(async()=>{const s=gengi.raid();const B=__boss();const V=s.enemies.v4;V.stats.teleOff=0;
  // pelea normal: el jugador entra en la arena mirándola; ningún aviso empieza fuera de pantalla
  const free=(x,y)=>!s.walls.some(r=>x>r.x-24&&x<r.x+r.w+24&&y>r.y-24&&y<r.y+r.h+24);
  const segOk=(x,y)=>{for(let i=1;i<20;i++){const t=i/20;if(!free(B.x+(x-B.x)*t,B.y+(y-B.y)*t))return false;}return true;};
  let ang0=Math.PI/2;for(let i=0;i<16;i++){const a=Math.PI/2+i*Math.PI/8,x=B.x+Math.cos(a)*T*5,y=B.y+Math.sin(a)*T*5;if(free(x,y)&&segOk(x,y)){ang0=a;break;}}
  __tp(B.x+Math.cos(ang0)*T*5,B.y+Math.sin(ang0)*T*5);s.facing=ang0+Math.PI;s.viewFacing=ang0+Math.PI;B.facing=ang0;B.meter=1;B.state='chase';B.sees=true;const a0=V.stats.stomps+V.stats.lances+V.stats.breaths;
  await __waitGame(8);const a1=V.stats.stomps+V.stats.lances+V.stats.breaths;
  // se aleja más de la correa: vuelve a casa
  __tp(B.gx,B.gy+T*20);await __waitGame(3);const st=V.state(B);
  return {attacks:a1-a0,teleOff:V.stats.teleOff,engagedFar:st.engaged};});
 ok('C7 IA: en la arena ataca (≥ 2 ataques en 8 s), ningún aviso fuera de pantalla, y no te persigue lejos de la guarida', r.attacks>=2&&r.teleOff===0&&!r.engagedFar, JSON.stringify(r));}
await E(()=>__calm());
{const r=await E(async()=>{const s=gengi.raid();const B=__boss();s.snap.xp=0;s.snap.xpBy={};const k0=s.v42s.bossKills;s.enemies.damage(B,1e6,{silent:true});await __waitGame(0.3);
  const L=s.map.snow.lair;const box=s.snap.containers.find(c=>c.kind==='elite'&&Math.hypot(c.x-L.cx,c.y-L.cy)<T*3);
  return {xp:(s.snap.xpBy.kills??0)+(s.snap.xpBy.boss??0),mult:s.mapDef.xpMult,kills:s.v42s.bossKills-k0,box:box?box.items.map(i=>i.def+':'+i.rarity):null,toast:s.hud.msg?.text};});
 ok('C8 al matarla: 400 de experiencia (jefe) y su botín en la guarida (3 objetos, uno Militar o mejor)', r.xp===400*r.mult&&r.kills===1&&r.box&&r.box.length>=3&&r.box.some(x=>/:(militar|anomalia|reliquia)$/.test(x)), JSON.stringify(r));}
// ---------- D. Guardar y restaurar a mitad de incursión ----------
await E(()=>__calm());
{const r=await E(()=>{const s=gengi.raid();const B=__boss();B.hp=B.maxHp*0.5;const snap=s.enemies.snapshot();const m=snap.find(x=>x.type==='matriarca');
  const V=s.enemies.v4;const e2=s.enemies.spawn('matriarca',B.x,B.y,1,m);const st=V.state(e2);return {hp:Math.round(m.hp),restored:Math.round(e2.hp),calls:st.calls};});
 ok('D1 se restaura a mitad de vida sin repetir la llamada del 60 %', r.restored===r.hp&&r.calls.includes(0.6)&&!r.calls.includes(0.3), JSON.stringify(r));}
ok('Z sin errores de página', errs.length===0, errs.slice(0,5).join(' | '));
console.log(`${res.filter(x=>x.startsWith('PASS')).length} PASS, ${res.filter(x=>x.startsWith('FAIL')).length} FAIL`);
await b.close();
