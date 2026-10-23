// QA v3.1 (diseno-v3.md §9 + corrección de reputación + jugador nuevo): arco/ballesta silenciosos, daño variable y
// críticos, memoria de visión, el Trapero, élites, reputación y el arte nuevo del jugador.
// node qa/v31.mjs (con `npx vite preview --port 4173` en marcha)
import puppeteer from 'puppeteer-core';
const URL=(process.env.GENGI_BASE||'http://localhost:4173/')+'?debug=1';
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
const res=[]; const ok=(n,c,i='')=>{res.push(`${c?'PASS':'FAIL'} ${n} ${i}`);console.log(`${c?'PASS':'FAIL'} ${n} ${i}`);};
const info=(n,i)=>{res.push(`INFO ${n} ${i}`);console.log(`INFO ${n} ${i}`);};
const b=await puppeteer.launch({executablePath:'/usr/bin/google-chrome',headless:'new',args:['--no-sandbox','--use-gl=swiftshader','--enable-unsafe-swiftshader','--window-size=390,844']});
const errs=[];
const ctx=await b.createBrowserContext(); const p=await ctx.newPage();
await p.setViewport({width:390,height:844,isMobile:true,hasTouch:true});
p.on('pageerror',e=>errs.push(e.message)); p.on('console',m=>{if(m.type()==='error')errs.push(m.text())});
await p.goto(URL); await p.waitForFunction(()=>window.gengi,{timeout:20000});
await p.evaluate(()=>gengi.reset()).catch(()=>{}); await sleep(900); await p.waitForFunction(()=>window.gengi,{timeout:20000});
const E=(f,...a)=>p.evaluate(f,...a);
const T=48;
const setup=`
window.T=48;
window.__calm=()=>{const s=gengi.raid();gengi.god(true);gengi.clearEnemies();s.snap.stream=null;s.snap.spawnTimer=-1e9;gengi.move(0,0);gengi.aim(null);gengi.cfg31.ELITE.chance=0;
  if(!window.__hooked||window.__hookedScene!==s){window.__hooked=true;window.__hookedScene=s;window.__pins=new Map();s.events.on('update',()=>{s.idleT=0;if(!window.__natural)s.snap.spawnTimer=Math.min(s.snap.spawnTimer,-1e6);for(const [e,pos] of window.__pins){if(!e.dead&&e.body){e.body.reset(pos.x,pos.y);}}});}
  window.__pins.clear();};
window.__gt=()=>gengi.raid().snap.elapsed;
window.__waitGame=sec=>new Promise(r=>{const t0=__gt();const f=()=>{if(__gt()-t0>=sec)r();else setTimeout(f,20)};f();});
window.__open=(r=7)=>{const s=gengi.raid();let o=null;for(let k=r;k>=2&&!o;k--)o=s.openSpot(k);s.player.setPosition(o.x,o.y);s.vel.set(0,0);s.player.body.reset(o.x,o.y);return o;};
window.__dummy=(type,dx,dy,f,hp,state)=>{const s=gengi.raid();const x=s.player.x+dx*T,y=s.player.y+dy*T;const e=s.spawnAt(type,x,y,undefined,false);e.state=state||'idle';e.meter=0;e.facing=f??0;e.turnT=1e9;e.wander?.set(0,0);if(hp){e.hp=e.maxHp=hp;}window.__pins.set(e,{x,y,f});return e;};
window.__arm=(id,ammo,n=30)=>{const s=gengi.raid();const lo=s.snap.loadout;lo.arma={uid:'qa-w-'+id+Math.random(),def:id,rarity:'comun',qty:1};lo.mochila=lo.mochila.filter(i=>i.def!=='flechas'&&i.def!=='virotes');if(ammo)lo.mochila.push({uid:'qa-a'+Math.random(),def:ammo,rarity:'comun',qty:n});s.host.refreshInventory();s.swapT=0;s.applyLoadout?.();};
window.__ammo=id=>{const lo=gengi.raid().snap.loadout;return lo.mochila.filter(i=>i.def===id).reduce((a,i)=>a+i.qty,0);};
`;
async function newRaid(){ await E(()=>{const s=gengi.raid();if(s&&!s.ended)s.host.endRaid('extraido',{exit:s.snap.exits[0]});}); await sleep(500); await E(()=>gengi.start()); await sleep(1600); try{await p.waitForFunction(()=>gengi.raid()&&gengi.raid().hud,{timeout:20000});}catch(err){console.log('newRaid falló',errs.slice(-5),await E(()=>({act:!!gengi.state().activeRaid,r:!!gengi.raid(),ended:gengi.raid()?.ended,ov:document.querySelector('.overlay,.card')?.textContent?.slice(0,80)})));throw err;} await E(setup); await E(()=>__calm()); }
await E(()=>{gengi.chapas(5000);}); await newRaid();
const D=await E(()=>gengi.defs());

// ======================= A. Arco y ballesta silenciosos (§9.1) =======================
{const w=D.weapons.ballesta, it=D.items.ballesta;
 ok('A1 Ballesta: 24 de daño, 0,4 ataques/s efectivos, alcance 8, peso 3, usa virotes', w.dmg===24&&Math.abs(w.aps-0.4)<0.01&&w.rangeTiles===8&&it.weight===3&&!!D.items.virotes, JSON.stringify({dmg:w.dmg,aps:+w.aps.toFixed(3),range:w.rangeTiles,weight:it.weight,noise:w.noise}));
 ok('A1 arco y ballesta: 0 ruido al disparar', D.weapons.arco.noise===0&&w.noise===0, `arco=${D.weapons.arco.noise} ballesta=${w.noise}`);}
{const r=await E(async()=>{const s=gengi.raid();__calm();__open(9);const out={};
  for(const [id,ammo] of [['arco','flechas'],['ballesta','virotes']]){__arm(id,ammo,10);s.facing=0;const n0=s.noiseLog.length,t0=__gt(),g0=s.groundArrows.length,imp0=s.stats.impactNoises;
    const px=s.player.x,py=s.player.y;s.fireRanged(Math.PI/2*0+0.3,false);const f=s.proj.fired[s.proj.fired.length-1];
    await __waitGame(2.2);const nz=s.noiseLog.slice(n0);
    out[id]={speed:f.speed,kind:f.kind,atPlayer:nz.filter(n=>Math.hypot(n.x-px,n.y-py)<T*1.2).length,impact:nz.map(n=>({r:n.r,d:+(Math.hypot(n.x-px,n.y-py)/T).toFixed(1)})),imp:s.stats.impactNoises-imp0,ground:s.groundArrows.length-g0,gdef:s.groundArrows[s.groundArrows.length-1]?.def,glow:!!s.groundArrows[s.groundArrows.length-1]?.img?.visible||s.groundArrows[s.groundArrows.length-1]?.img!==undefined};}
  return out;});
 ok('A2 flecha 7 casillas/s (336 px/s), virote 10 casillas/s (480 px/s)', r.arco.speed===336&&r.ballesta.speed===480, `flecha=${r.arco.speed} virote=${r.ballesta.speed}`);
 ok('A2 disparar no hace ruido; al caer sí (1,5 casillas donde cae)', r.arco.atPlayer===0&&r.ballesta.atPlayer===0&&r.arco.imp===1&&r.ballesta.imp===1&&r.arco.impact.every(n=>n.r===1.5&&n.d>2), JSON.stringify({arco:r.arco.impact,ballesta:r.ballesta.impact}));
 ok('A3 los fallos se quedan en el suelo (flecha/virote con brillo)', r.arco.ground===1&&r.ballesta.ground===1&&r.ballesta.gdef==='virotes', JSON.stringify({a:r.arco.ground,b:r.ballesta.ground,def:r.ballesta.gdef}));}
{const r=await E(async()=>{const s=gengi.raid();__calm();__open(8);__arm('arco','flechas',5);
  const e=__dummy('errante',3,0,Math.PI,50,'idle');await __waitGame(0.2);const a0=__ammo('flechas');
  s.fireRanged(0,false);await __waitGame(1.6);const out={hpLost:50-e.hp,dead:e.dead};
  // el ruido de la caída hace ir a mirar a un desprevenido cercano
  __calm();__open(9);const e2=__dummy('errante',0,-4,Math.PI/2,500,'idle');window.__pins.delete(e2);
  s.noise(e2.x+T*0.8,e2.y,1.5);await __waitGame(0.3);out.invest=e2.state;
  // recogida al pasar por encima, sin anillo
  __calm();const o=__open(8);s.dropArrow(o.x+T*2,o.y,3,'flechas');const g=s.groundArrows.length;const b0=__ammo('flechas');
  s.player.body.reset(o.x+T*2,o.y);await __waitGame(0.4);out.pick={before:b0,after:__ammo('flechas'),ground:[g,s.groundArrows.length],ring:!!s.loot?.c};
  return out;});
 ok('A3 un impacto ruidoso distrae: el enemigo va a mirar', r.invest==='investigate'||r.invest==='suspicious', `estado=${r.invest}`);
 ok('A3 recoger al pasar por encima (sin anillo de saqueo)', r.pick.after===r.pick.before+3&&r.pick.ground[1]===r.pick.ground[0]-1&&!r.pick.ring, JSON.stringify(r.pick));}
{const r=await E(async()=>{const s=gengi.raid();__calm();__open(8);
  const e=__dummy('errante',3,0,Math.PI,1e7,'chase');let N=2000;
  for(let i=0;i<N;i++)s.onProjHit({kind:'flecha',pierce:0,pierced:null,aimed:false,dmg:0.001,base:0.001,crit:false,weapon:'arco',vx:1,vy:0},e);
  const stuck=s.stuck.get(e)?.flechas??0;const g0=s.groundArrows.reduce((a,x)=>a+x.qty,0);const near0=s.groundArrows.filter(a=>Math.hypot(a.x-e.x,a.y-e.y)<T*1.5).reduce((a,x)=>a+x.qty,0);
  window.__pins.delete(e);s.dealDamage(e,1e9,0,'arco',false);await __waitGame(0.3);
  const near=s.groundArrows.filter(a=>Math.hypot(a.x-e.x,a.y-e.y)<T*1.5).reduce((a,x)=>a+x.qty,0);
  return {N,stuck,rate:stuck/N,dropped:s.groundArrows.reduce((a,x)=>a+x.qty,0)-g0,near:near-near0};});
 ok('A4 al acertar se recupera el 60 % (cae junto al cuerpo al morir)', Math.abs(r.rate-0.6)<0.04&&r.dropped===r.stuck&&r.near===r.stuck, JSON.stringify(r));}
{const r=await E(async()=>{const s=gengi.raid();__calm();__open(9);__arm('ballesta','virotes',10);await __waitGame(0.2);
  const ab=s.hud.abilities.map(b=>b.id??b.key??b.label?.text);let idx=-1;for(let i=0;i<3;i++){s.clavarArmed=false;s.abilityCd&&(s.abilityCd=[0,0,0]);s.useAbility(i);if(s.clavarArmed){idx=i;break;}}
  const es=[2.2,3.6,5,6.4].map(dx=>__dummy('errante',dx,0,Math.PI,1000,'chase'));await __waitGame(0.1);
  if(!s.clavarArmed)s.clavarArmed=true;s.fireRanged(0,false);await __waitGame(1.2);
  const first=es.map(e=>Math.round(1000-e.hp));es.forEach(e=>{e.hp=1000});
  s.attackT=0;s.fireRanged(0,false);await __waitGame(1.2);const second=es.map(e=>Math.round(1000-e.hp));
  return {idx,ab,first,second,stuck:es.map(e=>s.stuck.get(e)?.virotes??0)};});
 ok('A5 «Clavar»: el virote atraviesa a 2 enemigos (se para en el 3.º); sin Clavar se para en el 1.º', r.first[0]>0&&r.first[1]>0&&r.first[2]>0&&r.first[3]===0&&r.second[0]>0&&r.second[1]===0, JSON.stringify(r));}

// ======================= B. Daño variable y críticos (§9.2) =======================
{const r=await E(()=>{const f=(side)=>{const {out,mean}=gengi.rollDmg(100,side,40000);const nc=out.filter(o=>!o.crit).map(o=>o.dmg),c=out.filter(o=>o.crit).map(o=>o.dmg);
  return {crit:+(c.length/out.length).toFixed(4),ncMin:+Math.min(...nc).toFixed(2),ncMax:+Math.max(...nc).toFixed(2),cMin:+Math.min(...c).toFixed(2),cMax:+Math.max(...c).toFixed(2),avg:+(out.reduce((a,o)=>a+o.dmg,0)/out.length/100).toFixed(4),mean:+mean.toFixed(4)};};
  const pl=f('player'),en=f('enemy');const C=gengi.cfg31.DAMAGE;const keep=C.player.critChance;C.player.critChance=0.5;const half=f('player');C.player.critChance=keep;
  return {pl,en,half};});
 ok('B1 jugador: daño en [0,72; 1,04] × base, crítico 25 % × 1,5', r.pl.ncMin>=72&&r.pl.ncMax<=104&&r.pl.cMin>=108&&r.pl.cMax<=156&&Math.abs(r.pl.crit-0.25)<0.01, JSON.stringify(r.pl));
 ok('B1 enemigos: misma variación, crítico 10 %', r.en.ncMin>=72&&r.en.ncMax<=104&&Math.abs(r.en.crit-0.1)<0.008, JSON.stringify(r.en));
 ok('B1 configurable por lado (crítico del jugador al 50 % → 50 %)', Math.abs(r.half.crit-0.5)<0.015, `crit=${r.half.crit}`);
 info('B1 media', `jugador ×${r.pl.avg} (teórica ${r.pl.mean}; v2 era ×1,08 con 10 % × 1,8) · enemigos ×${r.en.avg} (teórica ${r.en.mean}; antes ×1,00)`);}
{const r=await E(async()=>{const s=gengi.raid();__calm();__open(8);gengi.god(false);const P=s.snap.player;P.hp=P.maxHp=1e6;gengi.dmgLog.enemy.length=0;
  s.addStatus('bleed',3);s.addStatus('poison',3);await __waitGame(2.5);const dot=gengi.dmgLog.enemy.length;const hp1=P.hp;
  s.damagePlayer(5,'Reptante');const rep=gengi.dmgLog.enemy.length;
  s.damagePlayer(10,'Errante');const hit=gengi.dmgLog.enemy.length;
  const C=gengi.cfg31.DAMAGE.enemy;const keep=C.critChance;C.critChance=0;s.damagePlayer(10,'Errante');const nHurt=s.fx.shown[s.fx.shown.length-1];
  C.critChance=1;const ct0=s.stats.critsTaken;s.damagePlayer(10,'Errante');const cHurt=s.fx.shown[s.fx.shown.length-1];const shake=s.cameras.main.shakeEffect.isRunning;C.critChance=keep;
  s.snap.status=[];s.snap.player.status&&(s.snap.player.status=[]);gengi.god(true);P.hp=P.maxHp=100;
  return {dotDmg:Math.round(1e6-hp1),dot,rep,hit,nHurt,cHurt,critsTaken:s.stats.critsTaken-ct0,shake};});
 ok('B2 sangrado/veneno y el agarre del Reptante NO tiran variación/crítico; los golpes directos sí', r.dotDmg>0&&r.dot===0&&r.rep===0&&r.hit===1, JSON.stringify({dotDmg:r.dotDmg,dot:r.dot,rep:r.rep,hit:r.hit}));
 ok('B3 daño recibido en rojo; crítico recibido con «!» y temblor de pantalla', r.nHurt.color==='#ff4d4d'&&r.nHurt.hurt&&r.cHurt.crit&&r.cHurt.text.endsWith('!')&&r.critsTaken===1&&r.shake, JSON.stringify({n:r.nHurt,c:r.cHurt,shake:r.shake}));}
{const r=await E(async()=>{const s=gengi.raid();__calm();__open(8);const out={};
  const e=__dummy('bruto',2,0,0,1e6,'chase');await __waitGame(0.1);
  s.dealDamage(e,10,0,'x',false);out.n=s.fx.shown[s.fx.shown.length-1];s.dealDamage(e,10,0,'x',true);out.c=s.fx.shown[s.fx.shown.length-1];
  // puñalada / disparo apuntado a un desprevenido: base × 2,5, siempre crítico, sin variación
  __calm();__open(8);const d=__dummy('errante',3,0,0,1e6,'idle');await __waitGame(0.1);const vals=[];
  for(let i=0;i<40;i++){const h=d.hp;d.state='idle';d.meter=0;s.onProjHit({kind:'flecha',pierce:1,pierced:new Set(),aimed:true,dmg:20,base:20,crit:false,weapon:'arco',vx:1,vy:0},d);vals.push(+(h-d.hp).toFixed(2));}
  out.bs=[...new Set(vals)];out.bsNum=s.fx.shown[s.fx.shown.length-1];
  return out;});
 ok('B4 número normal blanco 17 px; crítico #ffb02e 1,35× (23 px) con «!»', r.n.color==='#ffffff'&&r.n.size===17&&!r.n.text.endsWith('!')&&r.c.color==='#ffb02e'&&r.c.size===23&&r.c.text.endsWith('!'), JSON.stringify({n:r.n,c:r.c}));
 ok('B5 puñalada/disparo a desprevenido: ×2,5 exacto y siempre crítico', r.bs.length===1&&r.bs[0]===50&&r.bsNum.crit, JSON.stringify({vals:r.bs,num:r.bsNum}));}
// TTK (antes: daño fijo y crítico 10 % × 1,8; ahora: [0,72;1,04] y 25 % × 1,5) — Monte Carlo
{const W=['puños','bate','machete','arco','ballesta','pistola','escopeta','rifle'].filter(w=>D.weapons[w]);const EN=['errante','corredor','bruto','escupidor','chillon'].filter(t=>D.enemies[t]);
 const rnd=()=>Math.random();
 const hits=(hp,dmg,model)=>{let h=0,n=0;while(h<hp){n++;if(model==='old')h+=dmg*(rnd()<0.1?1.8:1);else{let d=dmg*(0.72+0.32*rnd());if(rnd()<0.25)d*=1.5;h+=d;}if(n>500)break;}return n;};
 const rows=[];for(const w of W){const ws=D.weapons[w];for(const t of EN){const hp=D.enemies[t].hp;let a=0,c=0;const N=4000;for(let i=0;i<N;i++){a+=hits(hp,ws.dmg,'old');c+=hits(hp,ws.dmg,'new');}a/=N;c/=N;rows.push(`${w}→${t}(${hp}): ${a.toFixed(2)}→${c.toFixed(2)} golpes, ${((a-1)/ws.aps).toFixed(2)}→${((c-1)/ws.aps).toFixed(2)} s`);}}
 info('B6 TTK (golpes y s, antes→ahora, rareza común, minuto 0)', '\n   '+rows.join('\n   '));
 const pr=[];for(const t of EN){const d=D.enemies[t].dmg??D.enemies[t].damage;if(!d)continue;let a=0,c=0;const N=4000;for(let i=0;i<N;i++){let h=0,n=0;while(h<100){n++;h+=d;}a+=n;h=0;n=0;while(h<100){n++;let x=d*(0.72+0.32*rnd());if(rnd()<0.1)x*=1.5;h+=x;}c+=n;}pr.push(`${t}(${d}): ${(a/N).toFixed(2)}→${(c/N).toFixed(2)} golpes`);}
 info('B6 golpes que aguanta el jugador (100 PV, sin armadura, antes→ahora)', pr.join(' · '));}

// ======================= C. Memoria de visión (§9.3) =======================
{const r=await E(async()=>{const s=gengi.raid();__calm();__open(8);s.facing=0;await __waitGame(0.5);
  const v0=s.viewFacing;s.facing=Math.PI;const samples=[];const t0=__gt();
  while(__gt()-t0<0.5){samples.push([__gt()-t0,s.viewFacing]);await new Promise(r=>setTimeout(r,16));}
  let maxRate=0;for(let i=1;i<samples.length;i++){const dt=samples[i][0]-samples[i-1][0];if(dt<=0.005)continue;let d=Math.abs(samples[i][1]-samples[i-1][1]);d=Math.min(d,Math.PI*2-d);maxRate=Math.max(maxRate,d/dt*180/Math.PI);}
  const reached=samples.find(x=>Math.abs(Math.cos(x[1])+1)<0.01);
  return {maxRate:Math.round(maxRate),tReach:reached?+reached[0].toFixed(3):null};});
 ok('C1 giro de la mirada con tope 540°/s (180° en ~0,33 s)', r.maxRate<=560&&r.tReach!==null&&r.tReach>=0.3&&r.tReach<0.45, JSON.stringify(r));}
{const r=await E(async()=>{const s=gengi.raid();__calm();__open(8);s.facing=0;s.viewFacing=0;await __waitGame(0.5);
  const st0={...s.vision.lingerStats};s.facing=Math.PI;let maxL=0;const t0=__gt();let tLast=0;
  while(__gt()-t0<1.4){const l=s.vision.lingerCount();if(l>0){maxL=Math.max(maxL,l);tLast=__gt()-t0;}await new Promise(r=>setTimeout(r,20));}
  return {maxL,tLast:+tLast.toFixed(2),now:s.vision.lingerCount(),redraws:s.vision.lingerStats.redraws-st0.redraws};});
 ok('C2 lo que sale del cono sigue visible ~0,6 s y se apaga', r.maxL>0&&r.now===0&&r.tLast>0.45&&r.tLast<1.15, JSON.stringify(r));}
{const r=await E(async()=>{const s=gengi.raid();__calm();__open(8);s.facing=0;s.viewFacing=0;
  const e=__dummy('errante',4,0,Math.PI,1e5,'idle');await __waitGame(0.6);const vis0=e.rig.c.visible&&!e.rig.ghostOn;
  s.facing=Math.PI;s.viewFacing=Math.PI;window.__pins.delete(e);await __waitGame(0.12);
  const g1={on:e.rig.ghostOn,x:e.rig.c.x,y:e.rig.c.y,a:e.rig.c.alpha};
  e.body.reset(e.x,e.y+T*2);window.__pins.set(e,{x:e.x,y:e.y+T*2});await __waitGame(0.25);
  const g2={on:e.rig.ghostOn,x:e.rig.c.x,y:e.rig.c.y,a:e.rig.c.alpha,ex:e.x,ey:e.y};
  await __waitGame(0.6);const g3={on:e.rig.ghostOn,vis:e.rig.c.visible};
  return {vis0,g1,g2,g3,frames:s.enemies.ghostFrames};});
 ok('C3 fantasma quieto en la última posición vista, se desvanece y desaparece', r.vis0&&r.g1.on&&r.g2.on&&r.g2.x===r.g1.x&&r.g2.y===r.g1.y&&Math.abs(r.g2.ey-r.g2.y)>T&&r.g2.a<r.g1.a&&!r.g3.on&&!r.g3.vis, JSON.stringify(r));}

// ======================= D. El Trapero (§9.4) =======================
{const rate=await E(()=>gengi.traperoRate(4000));ok('D1 aparece en ~50 % de las incursiones', Math.abs(rate-0.5)<0.03, `tasa=${rate}`);}
let found=false;for(let i=0;i<12&&!found;i++){found=await E(()=>!!gengi.v31().trapero);if(!found)await newRaid();}
ok('D1 incursión con Trapero encontrada', found);
if(found){
 {const r=await E(async()=>{const s=gengi.raid();__calm();const t=s.snap.trapero;const out={found0:t.found,vis0:s.trapImg.visible,stock:t.stock.map(e=>({def:e.item.def,r:e.item.rarity,q:e.item.qty,price:e.price,expect:gengi.traperoPrice(e.item.def,e.item.rarity)})),dist:Math.round(Math.hypot(t.x-s.snap.player.x,t.y-s.snap.player.y)/T)};
   for(const a of [Math.PI/2,0,Math.PI,-Math.PI/2]){if(t.found)break;const x=t.x+Math.cos(a)*T*2.2,y=t.y+Math.sin(a)*T*2.2;s.player.body.reset(x,y);s.player.setPosition(x,y);s.facing=a+Math.PI;s.viewFacing=a+Math.PI;await __waitGame(0.5);}
   out.found1=t.found;out.vis1=s.trapImg.visible;out.state=s.traperoState()&&{open:s.traperoState().open,near:s.traperoState().near};out.toasts=(s.hud.toasts??[]).map?.(x=>x.text??x)??null;return out;});
  ok('D2 oculto hasta que lo ves; al verlo: «Has encontrado al Trapero»', !r.found0&&!r.vis0&&r.found1&&r.vis1&&r.state.open&&r.state.near, JSON.stringify({f0:r.found0,v0:r.vis0,f1:r.found1,v1:r.vis1,st:r.state,dist:r.dist}));
  const cats=r.stock.map(x=>D.items[x.def].kind);
  ok('D2 vende 3 objetos (Reforzado, Militar, consumible), 1 unidad, −20 % sobre rep. 1', r.stock.length===3&&r.stock[0].r==='reforzado'&&r.stock[1].r==='militar'&&r.stock.every(x=>x.q===1&&x.price===x.expect), JSON.stringify(r.stock)+' '+cats.join(','));}
 {const r=await E(async()=>{const s=gengi.raid();const lo=s.snap.loadout;const mats=Object.entries(gengi.defs().items).filter(([,d])=>d.kind==='material').map(([id])=>id);const m=mats[0];
   lo.mochila=lo.mochila.filter(i=>D_keep(i));function D_keep(i){return i.def!=='chapas';}
   const tag={uid:'qa-m1',def:m,rarity:'comun',qty:3,raid:s.snap.id},ref={uid:'qa-m2',def:m,rarity:'comun',qty:3},old={uid:'qa-m3',def:m,rarity:'comun',qty:3,raid:'otra'},nm={uid:'qa-m4',def:'vendaje',rarity:'comun',qty:2,raid:s.snap.id};
   lo.mochila.push(tag,ref,old,nm);const v0=s.snap.trapero.vales;
   const out={m,a:s.traperoSell('qa-m1'),b:s.traperoSell('qa-m2'),c:s.traperoSell('qa-m3'),d:s.traperoSell('qa-m4'),vales:s.snap.trapero.vales-v0,expect:gengi.valesFor(m,3),value:gengi.defs().items[m].value};
   return out;});
  ok('D3 compra materiales saqueados en ESTA incursión al 70 % en vales', r.a.ok&&r.vales===r.expect&&r.expect===Math.floor(r.value*3*0.7), JSON.stringify({a:r.a,vales:r.vales,expect:r.expect}));
  ok('D3 rechaza materiales del refugio / de otra incursión / no materiales', !r.b.ok&&!r.c.ok&&!r.d.ok&&/saqueado/.test(r.b.msg)&&/materiales/.test(r.d.msg), JSON.stringify([r.b.msg,r.c.msg,r.d.msg]));}
 {const r=await E(async()=>{const s=gengi.raid();const t=s.snap.trapero;const lo=s.snap.loadout;const e=t.stock.find(x=>!x.sold);const P=e.price;
   t.vales=Math.floor(P*0.3);const carried=Math.floor(P*0.3);lo.mochila=lo.mochila.filter(i=>i.def!=='chapas');lo.mochila.push({uid:'qa-ch',def:'chapas',rarity:'comun',qty:carried});
   const bank0=gengi.state().chapas;const v0=t.vales;const idx=t.stock.indexOf(e);const r1=s.traperoBuy(idx);const bank1=gengi.state().chapas;
   const again=s.traperoBuy(idx);const bought=lo.mochila.find(i=>i.def===e.item.def&&i.uid.startsWith(e.item.uid));
   // sin fondos
   const bk=gengi.state().chapas;gengi.chapas(-bk);t.vales=0;const e2=t.stock.findIndex(x=>!x.sold);const poor=e2>=0?s.traperoBuy(e2):{ok:false,msg:'(sin stock)'};gengi.chapas(bk);
   // revender al Trapero lo que te vende: no
   const resell=bought?s.traperoSell(bought.uid):{ok:false,msg:'-'};
   return {P,v0,carried,r1,again,fromVales:v0-t.vales,carriedLeft:lo.mochila.filter(i=>i.def==='chapas').reduce((a,i)=>a+i.qty,0),bankSpent:bank0-bank1,bought:!!bought,poor,resell,boughtUid:bought?.uid};});
  ok('D4 se combinan vales + chapas encima + chapas del refugio (en ese orden)', r.r1.ok&&r.fromVales===r.v0&&r.carriedLeft===0&&r.bankSpent===r.P-r.v0-r.carried&&r.bought, JSON.stringify(r));
  ok('D4 1 unidad de cada (2.ª compra «Agotado»); sin fondos «No te llega»; no recompra lo suyo', !r.again.ok&&/Agotado/.test(r.again.msg)&&!r.poor.ok&&!r.resell.ok, JSON.stringify([r.again.msg,r.poor.msg,r.resell.msg]));
  // no hay arbitraje: lo comprado al Trapero se vende en el refugio por ≤40 % de lo pagado; prueba exhaustiva incluye su descuento
  const ec=await E(()=>gengi.econ(40));ok('D5 sin arbitraje (prueba exhaustiva con el descuento del Trapero: venta ≤ 40 % del precio más bajo)', ec.nBad===0&&ec.worstRatio<=0.4, `peor=${ec.worstRatio}`);
  {const r2=await E(async()=>{const s=gengi.raid();const t=s.snap.trapero;const out={};
    const el=s.snap.elapsed;s.snap.elapsed=600;out.time=s.traperoState();s.snap.elapsed=el;
    __calm();const e=__dummy('errante',0,0,0,100,'idle');e.body.reset(t.x+T*3,t.y);window.__pins.set(e,{x:t.x+T*3,y:t.y});s.enemies.becomeAlert(e,false);await __waitGame(0.1);out.alert3=s.traperoState();
    window.__pins.set(e,{x:t.x+T*6,y:t.y});for(let k=0;k<4;k++){await __waitGame(0.2);out.alert6=s.traperoState();if(out.alert6.open)break;}const sell=s.traperoSell('nope');gengi.clearEnemies();await __waitGame(0.1);out.after=s.traperoState();
    return {time:{open:out.time.open,why:out.time.why},a3:{open:out.alert3.open,why:out.alert3.why},a6:out.alert6.open,after:out.after.open};});
   ok('D6 cierra en el minuto 10 y con un enemigo en alerta a ≤4 casillas (a 6 sigue abierto)', !r2.time.open&&!r2.a3.open&&r2.a6&&r2.after, JSON.stringify(r2));}
  {const r3=await E(async()=>{const s=gengi.raid();const t=s.snap.trapero;t.vales=77;const ch0=gengi.state().chapas;s.host.persist();
    const lo=s.snap.loadout;const mats=Object.entries(gengi.defs().items).filter(([,d])=>d.kind==='material').map(([id])=>id);lo.mochila.push({uid:'qa-tag2',def:mats[0],rarity:'comun',qty:2,raid:s.snap.id});
    s.host.endRaid('extraido',{exit:s.snap.exits[0]});await new Promise(r=>setTimeout(r,500));const d=gengi.state();const js=JSON.stringify(d);
    return {chDelta:d.chapas-ch0,active:d.activeRaid,vales:/"vales"/.test(js),tagged:d.stash.filter(i=>i.raid).length,mats:d.stash.filter(i=>i.def===mats[0]).length};});
   ok('D7 al extraer los vales desaparecen (no se convierten en chapas) y los materiales pierden la marca de la incursión', r3.active===null&&!r3.vales&&r3.tagged===0, JSON.stringify(r3));}
 }
}
// muerte con vales
{let f=false;await newRaid();for(let i=0;i<12&&!f;i++){f=await E(()=>!!gengi.v31().trapero);if(!f)await newRaid();}
 if(f){const r=await E(async()=>{const s=gengi.raid();s.snap.trapero.vales=55;s.host.persist();gengi.god(false);gengi.kill();await new Promise(r=>setTimeout(r,800));const d=gengi.state();return {active:d.activeRaid,vales:/"vales"/.test(JSON.stringify(d))};});
  ok('D7 al morir también desaparecen', r.active===null&&!r.vales, JSON.stringify(r));}
 await E(()=>{document.querySelectorAll('button').forEach(b=>{if(/Volver|Continuar|refugio/i.test(b.textContent))b.click();});});await sleep(400);await newRaid();}

// ======================= E. Élites (§9.5) =======================
{const r=await E(async()=>{const s=gengi.raid();__calm();__open(8);const C=gengi.cfg31.ELITE;const keep={...C};C.chance=0.05;C.maxAlive=1e9;C.maxPerRaid=1e9;let n=0,el=0;
  for(let b=0;b<12;b++){for(let i=0;i<100;i++){const e=s.spawnAt('errante',s.player.x+T*(8+Math.random()*4),s.player.y+T*(Math.random()*8-4));n++;if(e.elite)el++;}gengi.clearEnemies();}
  C.chance=1;const ex={};for(const t of ['abominacion','enjambre']){const e=s.spawnAt(t,s.player.x+T*9,s.player.y);ex[t]=!!e.elite;ex[t+'F']=s.forceElite(e);gengi.clearEnemies();}
  Object.assign(C,keep);s.snap.elites=0;return {rate:el/n,n,ex};});
 ok('E1 ~5 % de los enemigos son élite', Math.abs(r.rate-0.05)<0.015, `tasa=${r.rate.toFixed(3)} n=${r.n}`);
 ok('E1 nunca la Abominación ni el Enjambre', !r.ex.abominacion&&!r.ex.abominacionF&&!r.ex.enjambre&&!r.ex.enjambreF, JSON.stringify(r.ex));}
{const r=await E(async()=>{const s=gengi.raid();__calm();__open(8);
  const a=__dummy('errante',5,-2,Math.PI,0,'idle');const b=gengi.elite('errante',5,2);window.__pins.set(b,{x:b.x,y:b.y});await __waitGame(0.3);
  const out={hp:[a.maxHp,b.maxHp],dmg:[a.dmg,b.dmg],scale:[a.rig.c.scaleX,b.rig.c.scaleX],aura:b.rig.isElite,auraA:a.rig.isElite};
  // límites: vivos 3, por incursión 6
  __calm();s.snap.elites=0;const C=gengi.cfg31.ELITE;const keep=C.chance;C.chance=1;for(let i=0;i<10;i++)s.spawnAt('errante',s.player.x+T*(6+i*0.5),s.player.y+T*3);out.alive=s.enemies.eliteAlive();
  for(let k=0;k<4;k++){for(const e of s.enemies.list.filter(e=>e.elite))s.dealDamage(e,1e9,0,'x',false);for(let i=0;i<5;i++)s.spawnAt('errante',s.player.x+T*(6+i*0.5),s.player.y-T*3);}
  out.perRaid=s.snap.elites;out.alive2=s.enemies.eliteAlive();C.chance=keep;gengi.clearEnemies();return out;});
 ok('E2 vida ×2, daño ×2, tamaño ×1,1 y aura dorada', r.hp[1]===r.hp[0]*2&&Math.abs(r.dmg[1]/r.dmg[0]-2)<1e-6&&Math.abs(r.scale[1]/r.scale[0]-1.1)<0.01&&r.aura&&!r.auraA, JSON.stringify(r));
 ok('E2 máximo 3 vivos y 6 por incursión', r.alive===3&&r.perRaid===6, `vivos=${r.alive} total=${r.perRaid}`);}
{const r=await E(()=>{const d=gengi.eliteDrops(5000);const items=gengi.defs().items;const order=['comun','reforzado','militar','prototipo'];
  const gearA=d.every(x=>!!(items[x.a].weapon||items[x.a].armor||items[x.a].slot&&items[x.a].slot!=='mochila'||items[x.a].kind==='arma'||items[x.a].kind==='armadura'||items[x.a].kind==='equipo'));
  const dist={};for(const x of d)dist[x.ar]=(dist[x.ar]||0)+1;const distB={};for(const x of d)distB[x.br]=(distB[x.br]||0)+1;
  return {n:d.length,gearA,dist,distB,kinds:[...new Set(d.map(x=>items[x.a].kind))]};});
 ok('E3 2 objetos; el 1.º es equipo una rareza por encima (nunca común, tope Militar)', !r.dist.comun&&!r.dist.prototipo&&r.gearA, JSON.stringify(r));}
{const r=await E(async()=>{const s=gengi.raid();__calm();__open(8);const e=gengi.elite('errante',3,0);const c0=s.snap.containers.length;const k0={...s.v31s};
  s.dealDamage(e,1e9,0,'x',false);await __waitGame(0.3);const c=s.snap.containers.slice(c0);return {cont:c.map(x=>x.items.map(i=>i.def+':'+i.rarity)),drops:s.v31s.eliteDrops-k0.eliteDrops};});
 ok('E3 un élite muerto deja su cuerpo con los 2 objetos extra', r.drops===2&&r.cont.length>=1&&r.cont[0].length>=2, JSON.stringify(r));}
{const r=await E(async()=>{const s=gengi.raid();__calm();__open(8);gengi.god(true);window.__pins.clear();
  const T0={...s.enemies.teleStats};const e=gengi.elite('bruto',2.5,0);s.enemies.becomeAlert(e,false);await __waitGame(4);
  const t={on:s.enemies.teleStats.on-T0.on,off:s.enemies.teleStats.off-T0.off};gengi.clearEnemies();return t;});
 ok('E4 justicia: los ataques de élite se telegrafían en pantalla (0 fuera de pantalla)', r.on>0&&r.off===0, JSON.stringify(r));}

// ======================= F. Reputación (corrección de Dott/Basu) =======================
await E(()=>{const s=gengi.raid();s.host.endRaid('extraido',{exit:s.snap.exits[0]});}); await sleep(600);
{const r=await E(()=>{gengi.chapas(200000);const out={};const xp=v=>gengi.state().vendors[v].xp;
  // vender no da reputación
  for(const v of ['doc','chispas','hierro']){const x0=xp(v);let sold=0;for(const it of gengi.state().stash.slice(0,6)){const s2=gengi.op('sellTo',v,it.uid);if(s2.ok)sold++;}out['sell_'+v]={sold,dxp:xp(v)-x0};}
  // bucle comprar→revender: la reputación de comprar tiene tope por renovación de tienda
  const v='chispas';const x0=xp(v);let paid=0,got=0,buys=0;
  for(let k=0;k<30;k++){const st=gengi.state().vendors[v].stock;if(!st.length)break;const c0=gengi.state().chapas;const b=gengi.op('buyStock',v,0);if(!b.ok)break;buys++;paid+=c0-gengi.state().chapas;const S=gengi.state().stash;const it=S[S.length-1];const c1=gengi.state().chapas;const sr=gengi.op('sellTo',v,it.uid);if(!sr.ok)gengi.op('sellTo','doc',it.uid);got+=gengi.state().chapas-c1;}
  out.loop={buys,dxp:xp(v)-x0,paid,got,left:gengi.op('buyXpLeft',v)};
  gengi.endRaids(3);out.afterRestock=gengi.op('buyXpLeft',v);
  // nivel 3-4 solo con misiones
  gengi.repXp('doc',99999);out.noMission=gengi.op('rep','doc');gengi.missions('doc',1);out.m1=gengi.op('rep','doc');gengi.missions('doc',2);out.m2=gengi.op('rep','doc');gengi.missions('doc',0);gengi.repXp('doc',0);
  return out;});
 ok('F1 vender no da reputación (los 3 vendedores)', ['doc','chispas','hierro'].every(v=>r['sell_'+v].dxp===0)&&r.sell_doc.sold+r.sell_chispas.sold+r.sell_hierro.sold>0, JSON.stringify([r.sell_doc,r.sell_chispas,r.sell_hierro]));
 ok('F2 bucle comprar→revender: pierde chapas y la reputación se para en el tope por renovación (150)', r.loop.buys>0&&r.loop.dxp<=150&&r.loop.got<r.loop.paid&&r.afterRestock===150, JSON.stringify(r.loop)+` tras renovar=${r.afterRestock}`);
 ok('F3 sin misión no pasas de nivel 2 (aunque tengas la XP); 1 misión → 3; 2 → 4', r.noMission===2&&r.m1===3&&r.m2===4, JSON.stringify({sin:r.noMission,m1:r.m1,m2:r.m2}));}
{const c2=await b.createBrowserContext();const p2=await c2.newPage();await p2.setViewport({width:390,height:844});p2.on('pageerror',e=>errs.push(e.message));
 await p2.goto(URL);await p2.waitForFunction(()=>window.gengi,{timeout:20000});
 await p2.evaluate(()=>{const d=gengi.state();d.saveVersion=3;for(const v of Object.values(d.vendors)){delete v.missionsDone;delete v.buyXp;}d.vendors.doc.xp=1700;d.vendors.chispas.xp=300;localStorage.setItem('gengi.save',JSON.stringify(d));location.reload();}).catch(()=>{});
 await sleep(1800);await p2.waitForFunction(()=>window.gengi,{timeout:20000});
 const m=await p2.evaluate(()=>{const d=gengi.state();return {ver:d.saveVersion,xp:d.vendors.doc.xp,lv:gengi.op('rep','doc'),missions:d.vendors.doc.missionsDone,stockLevel:d.vendors.doc.stockLevel,ch:gengi.op('rep','chispas')};});
 await c2.close();
 ok('F4 migración: guarda la XP pero limita al nivel 2 sin misiones', m.ver>=4&&m.xp===1700&&m.lv===2&&m.missions===0&&m.stockLevel===2&&m.ch===2, JSON.stringify(m));}

// ======================= G. Jugador nuevo (Basu) =======================
await newRaid();
{const r=await E(async()=>{const s=gengi.raid();__calm();__open(8);__arm('pistola',null);s.snap.loadout.arma.mag=10;await __waitGame(0.3);const rig=s.rig;
  const keys=rig.c.list.map(o=>o.texture?.key??o.type);
  const amp=async(m)=>{gengi.move(m,0);await __waitGame(0.9);let mx=0;const t0=__gt();while(__gt()-t0<1.4){mx=Math.max(mx,Math.abs(rig.scarfAngle));await new Promise(r=>setTimeout(r,16));}gengi.move(0,0);__open(8);return +(mx*180/Math.PI).toFixed(1);};
  const idle=await amp(0),sig=await amp(0.3),run=await amp(1);
  const g0=rig.goggleFlashes;s.attackT=0;s.fireRanged(0,false);const g1=rig.goggleFlashes;const vis=rig.goggle.visible;await __waitGame(0.15);
  return {keys,idle,sig,run,flash:g1-g0,vis,vis2:rig.goggle.visible,flag:gengi.cfg31.PLAYER_ART.version};});
 const k=r.keys,ix=n=>k.indexOf(n);
 ok('G1 jugador nuevo (bandera PLAYER_ART=v3) con orden de capas sombra, pies, bufanda, mochila, torso, brazos, arma, cabeza', r.flag==='v3'&&ix('jugador3_sombra')===0&&ix('jugador3_pie')<ix('jugador3_bufanda')&&ix('jugador3_bufanda')<ix('jugador3_mochila')&&ix('jugador3_mochila')<ix('jugador3_torso')&&ix('jugador3_torso')<ix('jugador3_brazo')&&k.lastIndexOf('jugador3_brazo')<k.indexOf(k.find(x=>/^arma_/.test(x)))&&ix(k.find(x=>/^arma_/.test(x)))<ix('jugador3_cabeza'), k.join(','));
 ok('G2 bufanda ±8° quieto, más al correr, quieta en sigilo', r.idle>6&&r.idle<=8.1&&r.run>r.idle*1.3&&r.run<=8*1.8+0.1&&r.sig<0.3, `quieto=${r.idle}° sigilo=${r.sig}° correr=${r.run}°`);
 ok('G3 gafas: destello de 1 fotograma al disparar', r.flash===1&&r.vis&&!r.vis2, JSON.stringify({flash:r.flash,vis:r.vis,after:r.vis2}));}
{await E(()=>{gengi.cfg31.PLAYER_ART.version='v2';});await newRaid();
 const r=await E(()=>{const s=gengi.raid();return {keys:s.rig.c.list.map(o=>o.texture?.key).filter(Boolean),scarf:s.rig.hasScarf};});
 ok('G4 bandera PLAYER_ART=v2: vuelve el jugador anterior', r.keys.includes('jugador_torso')&&!r.keys.some(x=>x.startsWith('jugador3'))&&!r.scarf, r.keys.join(','));
 await E(()=>{gengi.cfg31.PLAYER_ART.version='v3';});await newRaid();}

// ======================= H. Simulación de 15 min (élites) =======================
{const r=await E(async()=>{const s=gengi.raid();__calm();window.__natural=true;gengi.cfg31.ELITE.chance=0.05;s.snap.spawnTimer=0;gengi.god(true);
  const k0={...s.v31s};const typeCount={};let spawned=0;const seen=new Set();let maxAlive=0,maxEl=0;
  const dt=50;let t=performance.now();
  for(let i=0;i<15*60*1000/dt;i++){t+=dt;s.update(t,dt);s.hitStopT=0;
    if(i%20===0){for(const e of s.enemies.list){if(!seen.has(e)){seen.add(e);spawned++;typeCount[e.def.type]=(typeCount[e.def.type]||0)+1;}}maxAlive=Math.max(maxAlive,s.enemies.list.length);maxEl=Math.max(maxEl,s.enemies.eliteAlive());}
    if(i%200===0){for(const e of [...s.enemies.list])if(!e.dead&&Math.random()<0.5)s.dealDamage(e,1e9,0,'x',false);}
    if(s.ended)break;}
  window.__natural=false;gengi.cfg31.ELITE.chance=0;
  const drops=s.snap.containers.filter(c=>c.kind==='cadaver'||c.elite).length;
  return {min:+(s.snap.elapsed/60).toFixed(1),spawned,typeCount,elites:s.snap.elites,maxEl,kills:s.v31s.eliteKills-k0.eliteKills,drops:s.v31s.eliteDrops-k0.eliteDrops,maxAlive};});
 ok('H1 incursión simulada de 15 min: élites ≤6, nunca >3 vivos', r.elites<=6&&r.maxEl<=3&&r.min>=14.9, JSON.stringify(r));
 info('H1 botín de élite en 15 min', `élites=${r.elites} muertos=${r.kills} objetos de élite=${r.drops} enemigos generados=${r.spawned}`);}

ok('Z sin errores de consola', errs.length===0, errs.slice(0,5).join(' | '));
await b.close();
const fails=res.filter(x=>x.startsWith('FAIL')).length;console.log(`\n${res.filter(x=>x.startsWith('PASS')).length} PASS, ${fails} FAIL`);process.exit(fails?1:0);
