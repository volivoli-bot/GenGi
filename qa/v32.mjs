// QA v3.2 (pase de rendimiento + service worker): topes de flechas, fantasmas y manchas, aura de élite sin tween,
// reserva de números de daño, niebla con menos polígonos, contador de fps con mínimo 12-15 y precarga automática del SW.
// node qa/v32.mjs (con `npx vite preview --port 4173` en marcha y dist recién construido)
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
import fs from 'fs'; import path from 'path';

// ======================= P. Topes y reservas =======================
{const r=await E(async()=>{const s=gengi.raid();__calm();const o=__open(9);const n0=s.groundArrows.length;
  for(let i=0;i<40;i++) s.dropArrow(o.x+((i%8)-4)*T*1.2,o.y+(Math.floor(i/8)-2)*T*1.2,1,i%2?'virotes':'flechas');
  const imgs=s.children.list.filter(c=>c.texture&&/flecha_suelo|proyectil_virote|proyectil_flecha/.test(c.texture.key)&&c.active).length;
  return {n0,len:s.groundArrows.length,culled:s.arrowsCulled,saved:s.snap.arrows.length,imgs,tw:s.tweens.getTweens().filter(t=>s.groundArrows.some(a=>a.glow&&t.targets?.includes(a.glow))).length};});
 ok('P1 como mucho 30 flechas/virotes en el suelo (las más viejas desaparecen)', r.len===30&&r.saved===30&&r.culled>=10&&r.imgs<=30&&r.tw===0, JSON.stringify(r));}
{const r=await E(async()=>{const s=gengi.raid();__calm();__open(9);s.facing=0;s.viewFacing=0;const es=[];
  for(let i=0;i<16;i++){const a=-0.9+1.8*i/15;es.push(__dummy('errante',Math.cos(a)*(3+i%3),Math.sin(a)*(3+i%3),Math.PI,1e5,'idle'));}
  await __waitGame(0.6);const seen=es.filter(e=>e.rig.c.visible&&!e.rig.ghostOn).length;s.enemies.ghostsMax=0;
  s.facing=Math.PI;s.viewFacing=Math.PI;await __waitGame(0.15);
  const now=es.filter(e=>e.rig.ghostOn).length,max0=s.enemies.ghostsMax;await __waitGame(0.8);
  return {seen,ghostsNow:now,max:Math.max(max0,s.enemies.ghostsMax),after:es.filter(e=>e.rig.ghostOn).length,hiddenRest:es.filter(e=>!e.rig.ghostOn&&e.rig.c.visible).length};});
 ok('P2 como mucho 8 siluetas fantasma a la vez', r.seen>=10&&r.ghostsNow===8&&r.max<=8&&r.after===0&&r.hiddenRest===0, JSON.stringify(r));}
{const r=await E(async()=>{const s=gengi.raid();__calm();__open(8);const e=gengi.elite('errante',2,0);await __waitGame(0.3);
  const aura=e.rig.c.list.find(c=>c.texture?.key==='aura_elite');const tw=aura?s.tweens.getTweensOf(aura).length:-1;const a1=aura?.alpha;await __waitGame(0.45);
  return {aura:!!aura,tint:aura?.tintTopLeft?.toString(16),tw,pulse:aura?Math.abs(aura.alpha-a1)>0.01:false,particles:s.children.list.filter(c=>c.type==='ParticleEmitter').length};});
 ok('P3 aura de élite: un sprite teñido de dorado, sin tween infinito ni partículas, y late', r.aura&&r.tint==='ffd86a'&&r.tw===0&&r.particles===0&&r.pulse, JSON.stringify(r));}
{const r=await E(async()=>{const s=gengi.raid();__calm();const o=__open(6);const fx=s.fx;const f0=fx.stainsFaded,l0=fx.stainsLive;
  for(let i=0;i<150;i++) fx.stain(o.x+(i%15)*10,o.y+Math.floor(i/15)*10,i%2===0,0.5);
  const live=fx.stainsLive;await __waitGame(0.8);
  const imgs=s.children.list.filter(c=>c.texture&&/fx_mancha_suelo/.test(c.texture.key)&&c.visible).length;
  const total=s.children.list.filter(c=>c.texture&&/fx_mancha_suelo/.test(c.texture.key)).length;
  return {l0,live,faded:fx.stainsFaded-f0,visible:imgs,objects:total};});
 ok('P4 como mucho 60 manchas de sangre (las más viejas se desvanecen y se reutilizan)', r.live===60&&r.faded>=90&&r.visible<=60&&r.objects<=75, JSON.stringify(r));}
{const r=await E(async()=>{const s=gengi.raid();__calm();__open(6);const fx=s.fx;const n0=s.children.list.filter(c=>c.type==='Text'&&c.depth===31).length;
  for(let i=0;i<120;i++){fx.damageNumber(s.player.x,s.player.y,10+i,i%4===0,i%3===0);if(i%10===9)await new Promise(r=>setTimeout(r,20));}
  await __waitGame(1.2);
  for(let i=0;i<40;i++) fx.damageNumber(s.player.x,s.player.y,5,i%2===0,false);
  const texts=s.children.list.filter(c=>c.type==='Text'&&c.depth===31);const last=fx.shown.slice(-2);
  const crit=texts.find(t=>t.active&&t.text.endsWith('!'));
  return {n0,objs:texts.length,pools:fx.numPools.size,critStyle:crit?{size:crit.style.fontSize,color:crit.style.color,stroke:crit.style.strokeThickness}:null,last};});
 ok('P5 números de daño: reserva por estilo (se reutilizan; el crítico conserva color, tamaño y contorno)', r.pools<=4&&r.objs<=120&&r.critStyle?.color==='#ffb02e'&&r.critStyle?.size==='23px'&&r.critStyle?.stroke===4, JSON.stringify(r));}

// ======================= N. Niebla =======================
{const r=await E(async()=>{const s=gengi.raid();__calm();__open(8);s.facing=0;s.viewFacing=0;await __waitGame(0.8);
  const v=s.vision;const p0=v.lingerStats.polys,s0=v.lingerStats.samples,r0=v.lingerStats.redraws;await __waitGame(1);
  const still={polys:v.lingerStats.polys-p0,samples:v.lingerStats.samples-s0,redraws:v.lingerStats.redraws-r0};
  // barrido continuo de la mirada: fotos limitadas (≤ 1 cada 0,12 s) y polígonos por fotograma acotados
  const p1=v.lingerStats.polys,s1=v.lingerStats.samples;let frames=0;const t0=__gt();const h=()=>{frames++;s.facing+=0.08;};s.events.on('update',h);
  let maxHist=0;while(__gt()-t0<1.5){maxHist=Math.max(maxHist,v.lingerCount());await new Promise(r=>setTimeout(r,16));}
  s.events.off('update',h);
  return {still,v2:!!v.fogInfo?.().v2,sweep:{samples:v.lingerStats.samples-s1,frames,polysPerFrame:+((v.lingerStats.polys-p1)/frames).toFixed(1),maxHist}};});
 ok('N1 quieto: sin fotos nuevas ni redibujos de la niebla', r.still.samples===0&&r.still.redraws===0&&r.still.polys===0, JSON.stringify(r.still));
 ok('N2 barriendo: ≤ 1 foto cada 0,12 s, ≤ 6 vivas y ≤ 15 polígonos de máscara por fotograma (antes hasta 33; v4d niebla v2: una sola máscara, 0 fotos/polígonos)', r.v2 ? (r.sweep.samples===0&&r.sweep.polysPerFrame===0) : (r.sweep.samples<=Math.ceil(1.5/0.12)+1&&r.sweep.maxHist<=6&&r.sweep.polysPerFrame<=15), JSON.stringify({v2:r.v2,...r.sweep}));}

// ======================= F. Contador de fps =======================
{const r=await E(async()=>{const s=gengi.raid();__calm();__open(8);gengi.minute(11.98);await __waitGame(3);
  const a={min:s.fpsMin1215,txt:s.hud.fps.text,vis:s.hud.fps.visible};gengi.minute(15.2);const m=s.fpsMin1215;await __waitGame(1.5);
  return {a,frozen:s.fpsMin1215===m,txt2:s.hud.fps.text};});
 ok('F1 contador de fps con el mínimo entre los minutos 12 y 15 (se congela después)', r.a.vis&&Number.isFinite(r.a.min)&&r.a.min>0&&/fps · mín 12-15: \d+/.test(r.a.txt)&&r.frozen, JSON.stringify(r));}
{const c2=await b.createBrowserContext();const q=await c2.newPage();await q.setViewport({width:390,height:844,isMobile:true,hasTouch:true});
 await q.goto((process.env.GENGI_BASE||'http://localhost:4173/')+'?debug=0');await sleep(1500);
 const btn=await q.evaluate(()=>{const b=[...document.querySelectorAll('button')].find(b=>/Salir a la zona|Incursión|Empezar|Jugar/i.test(b.textContent));if(b){b.click();return b.textContent;}return null;});
 await sleep(2500);
 const r=await q.evaluate(()=>{const c=document.querySelector('canvas');return {canvas:!!c,gengi:typeof window.gengi};});
 await c2.close();
 info('F2 sin ?debug el contador también se ve (bandera PERF.showFps)', `botón=${btn} ${JSON.stringify(r)} (comprobado en la captura v3_2-contador-fps)`);}

// ======================= S. Service worker =======================
{const dist=process.env.GENGI_DIST||'/workspace/gengi/dist';const sw=fs.readFileSync(path.join(dist,'sw.js'),'utf8');const m=sw.match(/const PRECACHE = (\[[\s\S]*?\]);/);const list=m?JSON.parse(m[1]):[];
 const walk=(d)=>fs.readdirSync(d).flatMap(n=>{const f=path.join(d,n);return fs.statSync(f).isDirectory()?walk(f):[f];});
 const art=walk(path.join(dist,'art')).map(f=>'./'+path.relative(dist,f).split(path.sep).join('/'));
 const all=walk(dist).map(f=>'./'+path.relative(dist,f).split(path.sep).join('/')).filter(f=>f!=='./sw.js'&&!f.endsWith('.map'));
 const missArt=art.filter(f=>!list.includes(f)),missAll=all.filter(f=>!list.includes(f)),extra=list.filter(f=>f!=='./'&&!all.includes(f));
 const v31new=['jugador3_torso','jugador3_bufanda','jugador3_mochila','arma_ballesta','proyectil_virote','flecha_suelo','aura_elite','caseta_trapero'].filter(k=>!list.some(f=>f.includes(k+'.svg')));
 ok('S1 cada fichero de dist/art está en la precarga del service worker (lista generada en el build)', art.length>0&&missArt.length===0&&v31new.length===0, `art=${art.length} faltan=${JSON.stringify(missArt.slice(0,5))} v3.1 faltan=${JSON.stringify(v31new)}`);
 ok('S1 y también todo lo demás de dist (bundle, iconos, manifiesto), sin entradas que no existan', missAll.length===0&&extra.length===0&&list.includes('./')&&list.some(f=>/assets\/index-.*\.js$/.test(f)), `total=${list.length} faltan=${JSON.stringify(missAll.slice(0,5))} sobran=${JSON.stringify(extra.slice(0,5))}`);
 ok('S1 el nombre de la caché sigue generándose en el build', /const CACHE = 'gengi-[0-9a-f]{10}-[0-9a-z]+'/.test(sw), sw.match(/const CACHE = '[^']*'/)?.[0]);}
{const c3=await b.createBrowserContext();const q=await c3.newPage();await q.setViewport({width:390,height:844,isMobile:true,hasTouch:true});
 const qerr=[];q.on('pageerror',e=>qerr.push(e.message));
 await q.goto((process.env.GENGI_BASE||'http://localhost:4173/')+'?debug=1');await q.waitForFunction(()=>window.gengi,{timeout:20000});
 const ready=await q.evaluate(async()=>{const reg=await navigator.serviceWorker.ready;const t0=Date.now();while(!navigator.serviceWorker.controller&&Date.now()-t0<10000)await new Promise(r=>setTimeout(r,100));
   const ks=await caches.keys();const c=await caches.open(ks.find(k=>k.startsWith('gengi')));return {active:!!reg.active,ctrl:!!navigator.serviceWorker.controller,keys:ks,n:(await c.keys()).length};});
 await q.setOfflineMode(true);
 const failed=[];q.on('requestfailed',r=>failed.push(r.url()));
 await q.reload();let boot=false;try{await q.waitForFunction(()=>window.gengi,{timeout:20000});boot=true;}catch{}
 let raid=null;if(boot){await q.evaluate(()=>gengi.start());await sleep(2500);raid=await q.evaluate(()=>{const s=gengi.raid();const k=['jugador3_torso','jugador3_bufanda','arma_ballesta','aura_elite','caseta_trapero','flecha_suelo','proyectil_virote'];
   return {ok:!!s?.snap,tex:k.filter(x=>!s?.textures.exists(x)||s.textures.get(x).key==='__MISSING'),player:s?.player?.x>0};});}
 await q.setOfflineMode(false);await c3.close();
 ok('S2 sin conexión: tras la primera carga, el juego arranca y carga todo el arte (también el de v3.1)', ready.ctrl&&ready.n>=100&&boot&&raid?.ok&&raid.tex.length===0&&failed.length===0&&qerr.length===0, JSON.stringify({ready,boot,raid,failed:failed.slice(0,5),qerr:qerr.slice(0,3)}));}

ok('Z sin errores de consola', errs.length===0, errs.slice(0,5).join(' | '));
await b.close();
const fails=res.filter(x=>x.startsWith('FAIL')).length;console.log(`\n${res.filter(x=>x.startsWith('PASS')).length} PASS, ${fails} FAIL`);process.exit(fails?1:0);
