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
window.__snowK=0;window.__snowPt=()=>{const s=gengi.raid();const L=s.map.snow.lair;const pts=[];const st=T/2;for(let x=L.cx-L.w*0.4;x<=L.cx+L.w*0.4;x+=st)for(let y=L.cy-L.h*0.4;y<=L.cy+L.h*0.4;y+=st){if(!s.snowy(x,y))continue;if(s.walls.some(w=>x>w.x-20&&x<w.x+w.w+20&&y>w.y-20&&y<w.y+w.h+20))continue;pts.push({x,y});}if(!pts.length)return {x:L.cx,y:L.cy};return pts[(window.__snowK++*7919)%pts.length];};
window.__boss=()=>{const s=gengi.raid();const L=s.map.snow.lair;const e=s.spawnAt('matriarca',L.cx,L.cy,undefined,false);e.gx=L.cx;e.gy=L.cy;e.lair=true;return e;};
`;
async function endRaid(){ await E(()=>{const s=gengi.raid();if(s&&!s.ended)s.host.endRaid('extraido',{exit:s.snap.exits[0]});}); await sleep(500); await E(()=>document.querySelectorAll('.overlay button, .card button').forEach(b=>{if(/Volver|Continuar|Refugio/i.test(b.textContent))b.click();})); await sleep(300); }
async function newRaid(seed=null){ await endRaid(); await E(sd=>{gengi.seedNext(sd);gengi.start();},seed); await sleep(1600); await p.waitForFunction(()=>gengi.raid()&&gengi.raid().hud,{timeout:20000}); await E(setup); }

await newRaid(4242);
// ---------- R. Rarezas por mapa ----------
{const r=await E(()=>{const out={};for(const m of ['arrabal','via_muerta','crater','colmena']){const d=gengi.lootDist(m,2500,5);out[m]={caja:Object.keys(d.caja).sort(),elite:Object.keys(d.elite).sort(),lair:Object.keys(d.lair).sort()};}return out;});
 const all=m=>[...new Set([...r[m].caja,...r[m].elite,...r[m].lair])];
 const sub=(xs,ok)=>xs.every(x=>ok.includes(x));
 ok('R1 mapa 1 (El Arrabal): las cajas siguen en Común-Militar y solo la guarida da Anomalía', sub(r.arrabal.caja,['comun','reforzado','militar'])&&sub(r.arrabal.elite,['comun','reforzado','militar'])&&r.arrabal.lair.includes('anomalia'), JSON.stringify(r.arrabal));
 ok('R2 mapa 2 (Vía Muerta): Común-Anomalía', sub(all('via_muerta'),['comun','reforzado','militar','anomalia'])&&r.via_muerta.caja.includes('anomalia')&&r.via_muerta.caja.includes('comun'), JSON.stringify(r.via_muerta));
 ok('R3 mapa 3 (El Cráter): Reforzado-Reliquia, nada Común', sub(all('crater'),['reforzado','militar','anomalia','reliquia'])&&r.crater.caja.includes('reliquia')&&r.crater.lair.includes('reliquia'), JSON.stringify(r.crater));
 ok('R4 mapa 4 (La Colmena): Militar-Reliquia', sub(all('colmena'),['militar','anomalia','reliquia'])&&r.colmena.caja.includes('reliquia'), JSON.stringify(r.colmena));
 const live=await E(()=>gengi.raid().snap.containers.flatMap(c=>c.items).filter(i=>['bate','machete','arco','ballesta','pistola','tablas','chaleco','casco'].includes(i.def)).map(i=>i.rarity));
 ok('R5 en la incursión del mapa 1 el equipo de las cajas no pasa de Militar (salvo la guarida)', live.filter(x=>x==='anomalia'||x==='reliquia'||x==='chatarra').length<=1, JSON.stringify([...new Set(live)]));}
await E(()=>__calm());
// ---------- S. Reglas de la nieve ----------
{const r=await E(async()=>{const s=gengi.raid();const S=s.snowR;const pl=S.plates;const p=pl[0];
  const inSnow=pl.every(q=>s.snowy(q.x,q.y));
  // ruido de pasos: nieve ×0,7
  const pt=(()=>{for(let i=0;i<500;i++){const q=__snowPt();if(q&&S.plateAt(q.x,q.y)<0)return q;}})();
  __tp(pt.x,pt.y);s.vel.set(100,0);s.moveTier='andar';const nSnow=s.footNoise();const sp=(()=>{for(let i=0;i<2000;i++){const x=Math.random()*s.map.snow.lair.x+T*20,y=s.player.y;const q={x:s.map.spawn?.x??x,y:s.map.spawn?.y??y};if(!s.snowy(q.x,q.y))return q;}})();
  __tp(sp.x,sp.y);s.vel.set(100,0);const nOut=s.footNoise();s.vel.set(0,0);s.moveTier='quieto';
  // placa: cruje (5 casillas) y resbala
  const calls=[];const orig=s.noise.bind(s);s.noise=(x,y,rr)=>{calls.push(rr);return orig(x,y,rr);};
  __tp(p.x-p.w/2-30,p.y);const c0=S.stats.creaks;gengi.move(1,0);await __waitGame(0.6);gengi.move(0,0);s.noise=orig;
  const creak=S.stats.creaks-c0;
  // frenada: en la placa se resbala más
  const slide=async(x,y)=>{__tp(x,y);gengi.move(1,0);await __waitGame(0.5);gengi.move(0,0);const a=s.player.x;await __waitGame(0.6);return s.player.x-a;};
  const dIce=await slide(p.x-p.w/2+4,p.y), dSnow=await slide(pt.x,pt.y);
  return {n:pl.length,art:pl[0].img?.texture.key,inSnow,nSnow,nOut,ratio:nSnow/nOut,creak,calls:calls.filter(x=>x===5).length,inert:S.inertiaMult(p.x,p.y),dIce,dSnow};});
 ok('S1 hay placas de hielo visibles en la nieve (arte de Basu)', r.n>=8&&r.art==='v4/placa_hielo'&&r.inSnow, JSON.stringify({n:r.n,art:r.art}));
 ok('S2 la nieve amortigua: andar hace un 30 % menos ruido', Math.abs(r.ratio-0.7)<0.01, JSON.stringify({snow:r.nSnow,out:r.nOut}));
 ok('S3 el hielo cruje al pisarlo: ruido de 5 casillas', r.creak===1&&r.calls>=1, JSON.stringify({creak:r.creak,calls:r.calls}));
 ok('S4 el hielo resbala: inercia ×2 (frenas más tarde)', r.inert===2&&r.dIce>r.dSnow*1.4, JSON.stringify({inert:r.inert,dIce:r.dIce,dSnow:r.dSnow}));}
await E(()=>__calm());
{const r=await E(async()=>{const s=gengi.raid();const S=s.snowR;
  // tus huellas
  const pt=__snowPt();__tp(pt.x,pt.y);const n0=S.stats.prints;gengi.move(0,1);await __waitGame(1.2);gengi.move(0,0);await __waitGame(0.6);
  const mine=S.prints.filter(p=>!p.enemy);const made=S.stats.prints-n0;const life=Math.max(...mine.map(p=>p.t));
  const art=mine[0]?.img?.texture.key;
  // caducan a los 20 s
  for(const p of S.prints)p.t=0.01;await __waitGame(0.1);const left=S.prints.length;
  // los enemigos que encuentran tus huellas las siguen: rastro artificial de 10 huellas lejos de ti
  const a=__snowPt();const trail=[];for(let i=0;i<10;i++)trail.push({x:a.x+i*T*0.6,y:a.y,ang:0,t:15,enemy:false,img:null});S.prints.push(...trail);
  const far=(()=>{for(let i=0;i<500;i++){const q=__snowPt();if(Math.hypot(q.x-a.x,q.y-a.y)>T*14)return q;}})();__tp(far.x,far.y);
  const e=s.spawnAt('errante',a.x,a.y,undefined,false);e.state='idle';e.facing=Math.PI;const f0=S.stats.followed;
  await __waitGame(0.6);const st=e.state,g=e.goal?{x:(e.goal.x-a.x)/T,y:(e.goal.y-a.y)/T}:null;
  await __waitGame(2);const moved=(e.x-a.x)/T;
  // las suyas también se ven
  __tp(e.x-T*3,e.y);const ep0=S.stats.enemyPrints;await __waitGame(1.6);const ep=S.stats.enemyPrints-ep0;
  return {made,life,art,left,st,g,followed:S.stats.followed-f0,moved,type:e.def.type,ep};});
 ok('S5 dejas huellas en la nieve (20 s, arte huella) y se borran al caducar', r.made>=3&&r.life<=20&&r.life>18&&r.art==='v4/huella'&&r.left===0, JSON.stringify({made:r.made,life:r.life,art:r.art,left:r.left}));
 ok('S6 un enemigo que encuentra tus huellas las sigue (sin haberte visto)', r.st==='investigate'&&r.g&&r.g.x>0.5&&r.followed>=1&&r.moved>0.5, JSON.stringify(r));
 ok('S7 también ves las huellas de los enemigos', r.ep>=1, String(r.ep));}
await E(()=>__calm());
{const r=await E(async()=>{const s=gengi.raid();const S=s.snowR;const R0=s.vision.R;const tst=[];const ot=s.hud.toast.bind(s.hud);s.hud.toast=(m,d)=>{tst.push(m);return ot(m,d);};
  S.ventLeft=0;S.warned=false;S.ventT=5.6;await __waitGame(1);const warned=tst.some(m=>/ventisca/i.test(m));const before=S.ventLeft>0;
  await __waitGame(5);const on=S.ventLeft>0,R=s.vision.R/T,cap=s.sightCapTiles(),ov=!!S['overlay']?.visible;
  // un enemigo a 6 casillas, de frente y sin muros, no te ve con la ventisca
  S.ventLeft=0.05;await __waitGame(0.2);const off=S.ventLeft===0,R1=s.vision.R/T,cap1=s.sightCapTiles(),next=S.ventT;s.hud.toast=ot;
  return {warned,before,on,R,cap,ov,off,R1:R1,R0:R0/T,cap1,next,n:S.stats.ventiscas};});
 ok('V1 Ventisca: aviso 5 s antes; 25 s con la vista de todos a 4 casillas; luego vuelve y la siguiente llega en 3-4 min', r.warned&&!r.before&&r.on&&r.R===4&&r.cap===4&&r.ov&&r.off&&r.R1===r.R0&&r.cap1===99&&r.next>=180&&r.next<=240, JSON.stringify(r));}
{const r=await E(()=>{const s=gengi.raid();const L=s.map.snow.lair;const cols=s.walls.filter(w=>Math.abs(w.w-1.2*T)<2&&Math.abs(w.h-1.2*T)<2&&w.x>L.x&&w.x<L.x+L.w&&w.y>L.y&&w.y<L.y+L.h);return {n:cols.length};});
 ok('P1 la arena de la Matriarca tiene 6 columnas para cubrirse de las lanzas', r.n===6, JSON.stringify(r));}
// ---------- X. Revisión de experiencia (Dott/Basu) y Mesa de Mapas ----------
{const exp=[];let v=330;for(let n=1;n<=30;n++){if(n<=9){exp.push(60+30*n);continue;}const g=n>=25?1.1:n>=15?1.2:1.1;v*=g;exp.push(Math.round(v));}
 const got=await E(()=>Array.from({length:30},(_,i)=>gengi.lv().ops.xpToNext(i+1)));
 ok('X1 curva: lineal 1-9, ×1,10 10-14, ×1,20 15-24, ×1,10 desde 25', JSON.stringify(got)===JSON.stringify(exp), `9:${got[8]} 10:${got[9]} 14:${got[13]} 15:${got[14]} 24:${got[23]} 25:${got[24]} 26:${got[25]}`);}
await newRaid(4242);
{const r=await E(()=>{const s=gengi.raid();__calm();gengi.cfg42.SNOW_ENEMIES.enabled=false;s.snap.xp=0;s.snap.xpBy={};s.snap.killBase=0;
  const px=s.player.x,py=s.player.y,k=(t,w)=>{const e=s.spawnAt(t,px+200,py,undefined,false,true);if(w)e.wave=true;const x0=s.snap.xp;s.enemies.kill(e);return +(s.snap.xp-x0).toFixed(3);};
  const a=k('errante',false),b=k('errante',true),kb0=s.snap.killBase;s.snap.killBase=1500;const c=k('bruto',false),d=k('bruto',true);
  const n0=s.enemies.list.length;s.spawnWave();const nw=s.enemies.list.slice(n0);const wv=nw.length>0&&nw.every(e=>e.wave);
  gengi.clearEnemies();s.snap.xp=0;s.snap.xpBy={};s.snap.killBase=0;gengi.cfg42.SNOW_ENEMIES.enabled=true;
  return {a,b,kb0,c,d,nw:nw.map(e=>e.def.type),wv,cfg:gengi.lv().cfg.XP};});
 ok('X2 oleadas/hordas ×0,3 (errante 4 → 1,2) y, pasados 1.500 de base, cada muerte la mitad (bruto 12 → 6; de oleada 1,8)', r.a===4&&r.b===1.2&&Math.abs(r.kb0-5.2)<1e-9&&r.c===6&&r.d===1.8&&r.cfg.waveMult===0.3&&r.cfg.killSoftCap===1500&&r.cfg.overCapMult===0.5, JSON.stringify({a:r.a,b:r.b,kb0:r.kb0,c:r.c,d:r.d}));
 ok('X3 lo que entra por oleada lleva la marca de oleada', r.wv, JSON.stringify(r.nw));}
const LV=()=>E(()=>gengi.lv().prog());
async function endRaidX(exitType){ await E(t=>{const s=gengi.raid();const ex=t?s.snap.exits.find(e=>e.type===t)??{...s.snap.exits[0],type:t}:s.snap.exits[0];s.host.endRaid('extraido',{exit:ex});},exitType); await sleep(500); await E(()=>document.querySelectorAll('.overlay button, .card button').forEach(b=>{if(/Volver|Continuar|Refugio/i.test(b.textContent))b.click();})); await sleep(300); }
{const ids=await E(()=>{const s=gengi.raid();return {def:s.snap.mapDefId,save:s.snap.mapId};});
 ok('X4 la incursión guarda el id de la definición (mapDefId) además del saveId', ids.def==='arrabal'&&ids.save==='arrabal-v4', JSON.stringify(ids));
 const pre=await LV();
 await E(()=>{const s=gengi.raid();s.snap.xp=0;s.snap.xpBy={};s.snap.elapsed=0;s.gainXp(400,'boss');s.gainXp(100,'kills');});
 await endRaidX('helipuerto');const post=await LV();
 ok('X5 helipuerto: el ×1,5 no se aplica a la experiencia del jefe ((100+40)×1,5 + 400 = 610)', post.total-pre.total===610, `+${post.total-pre.total}`);}
for(const legacy of [false,true]){
 await newRaid(4242);
 const pre=await LV();
 await E(lg=>{const s=gengi.raid();__calm();const C=gengi.v4b().cfg;if(!C.MAPS.some(m=>m.id==='qa_mapa2'))C.MAPS.push({...C.MAPS[0],id:'qa_mapa2',saveId:'qa2-v1',nombre:'Mapa QA',xpMult:2.5});
   s.snap.xp=100;s.snap.xpBy={kills:100};s.snap.elapsed=0;if(lg){delete s.snap.mapDefId;s.snap.mapId='qa2-v1';}else{s.snap.mapDefId='qa_mapa2';}},legacy);
 await endRaidX(null);const post=await LV();
 ok(`X6 segundo MapDef (×2,5) resuelto por ${legacy?'saveId (guardado viejo)':'mapDefId'}: 100 + 40×2,5 = 200`, post.total-pre.total===200, `+${post.total-pre.total}`);}
await E(()=>{const C=gengi.v4b().cfg;C.MAPS.splice(C.MAPS.findIndex(m=>m.id==='qa_mapa2'),1);});
// Mesa de Mapas
const mesa=()=>E(()=>[...document.querySelectorAll('.mesa-mapas .polaroid')].map(b=>({id:b.dataset.map,g:b.dataset.gate,on:b.classList.contains('on'),lock:!!b.querySelector('img.lock'),t:b.querySelector('small').textContent})));
{await E(()=>gengi.v4b().setLevel(1));await sleep(200);const m1=await mesa();
 const v=m1.find(x=>x.id==='via_muerta'),a=m1.find(x=>x.id==='arrabal');
 ok('M1 Mesa de Mapas: 4 polaroids; El Arrabal elegido; la Vía Muerta con candado y «Requiere nivel 5»', m1.length===4&&a.on&&!a.lock&&v.lock&&v.t==='Requiere nivel 5'&&m1.filter(x=>x.lock).length===3, JSON.stringify(m1));
 // la Vía Muerta «construida» para probar el bloqueo por nivel
 await E(()=>{const C=gengi.v4b().cfg;C.MAPS[1].generador=C.MAPS[0].generador;gengi.v4b().setLevel(1);});await sleep(200);
 await E(()=>document.querySelector('.mesa-mapas [data-map=via_muerta]').click());await sleep(200);
 const sel1=await E(()=>gengi.state().mapSel??'arrabal');
 await E(()=>{gengi.v4b().save.data.mapSel='via_muerta';gengi.start();});await sleep(600);
 const st=await E(()=>({raid:!!gengi.raid(),active:!!gengi.state().activeRaid,sel:gengi.state().mapSel}));
 ok('M2 por debajo del nivel: no se elige ni se puede empezar la incursión', sel1==='arrabal'&&!st.raid&&!st.active&&st.sel==='arrabal', JSON.stringify({sel1,...st}));
 await E(()=>gengi.v4b().setLevel(5));await sleep(200);
 await E(()=>document.querySelector('.mesa-mapas [data-map=via_muerta]').click());await sleep(200);
 const m5=await mesa();const sel5=await E(()=>gengi.state().mapSel);
 await E(()=>gengi.v4b().setLevel(10));await sleep(200);const m10=await mesa();
 ok('M3 a nivel 5 se elige; a nivel 10 El Arrabal sale «Superado» pero sigue disponible', sel5==='via_muerta'&&m5.find(x=>x.id==='via_muerta').on&&!m5.find(x=>x.id==='via_muerta').lock&&m10.find(x=>x.id==='arrabal').g==='superado'&&!m10.find(x=>x.id==='arrabal').lock, JSON.stringify({sel5,a10:m10.find(x=>x.id==='arrabal')}));}
// importar: los rangos valen también al importar (mapa elegido e incursión a medias)
await newRaid(4242);
{const saved=await E(()=>{gengi.raid().persist();return gengi.state();});
 await endRaidX(null);
 const r=await E(sv=>{const V=gengi.v4b();const o=JSON.parse(JSON.stringify(sv));o.prog.level=1;o.mapSel='via_muerta';o.rev=(V.save.data.rev??0)+50;o.stats.raids=(V.save.data.stats.raids??0)+50;
   if(!o.activeRaid)return {err:'sin activeRaid'};o.activeRaid.mapDefId='via_muerta';
   let err=null;try{V.save.importString(JSON.stringify(o));}catch(e){err=e.message;}
   const d=V.save.data,out={err,log:V.save.gateLog,sel:d.mapSel,def:d.activeRaid?.mapDefId,rep:d.activeRaid?.repopulate};
   d.activeRaid=null;d.prog.level=1;V.save.save();V.app.hub.render();return out;},saved);
 ok('M4 al importar: mapa no permitido → El Arrabal y la incursión a medias se repuebla en El Arrabal', !r.err&&r.sel==='arrabal'&&r.def==='arrabal'&&r.rep===true&&r.log.length===2, JSON.stringify(r));}
await E(()=>{gengi.v4b().cfg.MAPS[1].generador=null;});
ok('Z sin errores de página', errs.length===0, errs.slice(0,3).join(' | '));
const nf=res.filter(x=>x.startsWith('FAIL')).length;console.log(`${res.length-nf} PASS, ${nf} FAIL`);
await b.close();
process.exit(nf?1:0);
