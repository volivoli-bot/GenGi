// QA de la prueba de Pablo (diseno-v3.md §8, números finales de Basu) + curación con tiempo (§8.8):
// node qa/prueba.mjs (con `npx vite preview --port 4173` en marcha)
import puppeteer from 'puppeteer-core';
const URL=(process.env.GENGI_BASE||'http://localhost:4173/')+'?debug=1&noelite';
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
const res=[]; const ok=(n,c,i='')=>{res.push(`${c?'PASS':'FAIL'} ${n} ${i}`);console.log(`${c?'PASS':'FAIL'} ${n} ${i}`);};
const b=await puppeteer.launch({executablePath:'/usr/bin/google-chrome',headless:'new',args:['--no-sandbox','--use-gl=swiftshader','--enable-unsafe-swiftshader','--window-size=390,844']});
const errs=[];
const ctx=await b.createBrowserContext(); const p=await ctx.newPage();
await p.setViewport({width:390,height:844,isMobile:true,hasTouch:true});
p.on('pageerror',e=>errs.push(e.message)); p.on('console',m=>{if(m.type()==='error')errs.push(m.text())});
await p.goto(URL); await p.waitForFunction(()=>window.gengi,{timeout:20000});
await p.evaluate(()=>gengi.reset()).catch(()=>{}); await sleep(700); await p.waitForFunction(()=>window.gengi);
const E=(f,...a)=>p.evaluate(f,...a);
const setup=`
window.T=48;
window.__calm=()=>{const s=gengi.raid();gengi.god(true);gengi.clearEnemies();s.snap.stream=null;s.snap.spawnTimer=-1e9;gengi.move(0,0);gengi.aim(null);
  s.settings.curarUmbral=0;s.snap.acid.length=0;s.snap.player.bleed=[];s.snap.player.poison=[];s.applying=null;s.snap.player.healLeft=0;s.snap.player.aguantar=0;
  if(!window.__hooked){window.__hooked=true;window.__pins=new Map();s.events.on('update',()=>{s.idleT=0;for(const [e,pos] of window.__pins){if(!e.dead)e.body.reset(pos.x,pos.y);}});}
  window.__pins.clear();};
window.__gt=()=>gengi.raid().snap.elapsed;
window.__waitGame=sec=>new Promise(r=>{const t0=__gt();const f=()=>{if(__gt()-t0>=sec)r();else setTimeout(f,20)};f();});
window.__until=(fn,max)=>new Promise(r=>{const t0=__gt();const f=()=>{if(fn()||__gt()-t0>=max)r(__gt()-t0);else setTimeout(f,15)};f();});
window.__open=(r=6)=>{const s=gengi.raid();let o=null;for(let k=r;k>=2&&!o;k--)o=s.openSpot(k);s.player.setPosition(o.x,o.y);s.vel.set(0,0);s.player.body.reset(o.x,o.y);return o;};
window.__count=id=>{const l=gengi.raid().snap.loadout;return l.mochila.filter(i=>i.def===id).reduce((n,i)=>n+i.qty,0)+(l.bolsillo?.def===id?l.bolsillo.qty:0);};
window.__naked=()=>{const l=gengi.raid().snap.loadout;l.torso=null;l.cabeza=null;};
`;
await E(()=>gengi.start()); await sleep(1500); await E(setup); await E(()=>__calm());

// ---------- 1. Inventario: tras hacer scroll, un toque abre el menú del objeto correcto ----------
{await E(()=>{const s=gengi.raid();__calm();s.snap.loadout.mochila=[];for(const [id,q] of [['vendaje',2],['botiquin',1],['machete',1],['casco',1],['chaleco',1],['arco',1],['flechas',10],['municion',8],['tela',3],['bate',1],['machete',1],['vendaje',1]])gengi.give(id,'comun',q);gengi.inventory();});
 await sleep(300);
 const sc=await E(()=>{const el=document.querySelector('.sheet .scroll');if(el.scrollHeight<=el.clientHeight+40)el.style.maxHeight='220px';const r=el.getBoundingClientRect();return {sh:el.scrollHeight,ch:el.clientHeight,x:r.left+r.width/2,y:r.top+r.height/2};});
 // arrastre real con el dedo (scroll nativo)
 await p.touchscreen.touchStart(sc.x,sc.y+60); for(let i=1;i<=8;i++){await p.touchscreen.touchMove(sc.x,sc.y+60-i*15);await sleep(16);} await p.touchscreen.touchEnd(); await sleep(400);
 let st=await E(()=>document.querySelector('.sheet .scroll').scrollTop);
 if(st<20){await E(()=>{const el=document.querySelector('.sheet .scroll');el.scrollTop=140;});await sleep(200);st=await E(()=>document.querySelector('.sheet .scroll').scrollTop);}
 const pick=await E(()=>{const sc=document.querySelector('.sheet .scroll').getBoundingClientRect();const c=[...document.querySelectorAll('.sheet .scroll [data-uid]')].map(el=>{const r=el.getBoundingClientRect();return {uid:el.dataset.uid,x:r.left+r.width/2,y:r.top+r.height/2,top:r.top,bottom:r.bottom}}).filter(c=>c.top>=sc.top+2&&c.bottom<=sc.bottom-2);return c[c.length-1]||null;});
 const taps0=await E(()=>gengi.raid().host?.inv?.taps??null);
 await p.touchscreen.tap(pick.x,pick.y); await sleep(450);
 const m=await E(()=>{const c=document.querySelector('.ctx');if(!c)return null;const r=c.getBoundingClientRect();return {uid:c.dataset.uid,top:r.top,bottom:r.bottom,left:r.left,right:r.right,acts:[...c.querySelectorAll('button')].map(b=>b.textContent)}});
 ok('P1 scroll real de la lista y luego toque: se abre el menú (y sigue abierto)', st>=20&&!!m, `scrollTop=${st} menu=${!!m}`);
 ok('P1 el menú es del objeto tocado y está junto a él', m&&m.uid===pick.uid&&Math.min(Math.abs(m.top-pick.bottom),Math.abs(m.bottom-pick.top),Math.abs((m.top+m.bottom)/2-pick.y))<140, JSON.stringify({tocado:pick?.uid,menu:m?.uid,celdaY:Math.round(pick?.y),menuY:m&&[Math.round(m.top),Math.round(m.bottom)]}));
 // scroll real ≥ 8 px con el menú abierto lo cierra
 await E(()=>{const el=document.querySelector('.sheet .scroll');el.scrollTop=Math.max(0,el.scrollTop-40);}); await sleep(250);
 ok('P1 un scroll real (≥ 8 px) con el menú abierto lo cierra', await E(()=>!document.querySelector('.ctx')));
 // arrastrar el dedo ≥ 8 px sobre un objeto no es toque
 const pick2=await E(()=>{const el=[...document.querySelectorAll('.sheet .scroll [data-uid]')].find(e=>{const r=e.getBoundingClientRect(),s=document.querySelector('.sheet .scroll').getBoundingClientRect();return r.top>=s.top+2&&r.bottom<=s.bottom-2});const r=el.getBoundingClientRect();return {x:r.left+r.width/2,y:r.top+r.height/2}});
 await p.touchscreen.touchStart(pick2.x,pick2.y); await p.touchscreen.touchMove(pick2.x+12,pick2.y); await sleep(40); await p.touchscreen.touchEnd(); await sleep(300);
 const dragMenu=await E(()=>!!document.querySelector('.ctx'));
 // pulsación de 380 ms (> 300 ms, < pulsación larga) no es toque
 await p.touchscreen.touchStart(pick2.x,pick2.y); await sleep(380); await p.touchscreen.touchEnd(); await sleep(300);
 const slowMenu=await E(()=>!!document.querySelector('.ctx:not(.cmp)'));
 ok('P1 no es toque: mover ≥ 8 px o mantener > 300 ms', !dragMenu&&!slowMenu, `arrastre=${dragMenu} lento=${slowMenu}`);
 await E(()=>{document.querySelector('.ctx')?.remove();document.querySelector('.sheet .btn.x')?.click();}); await sleep(200);}

// ---------- 2. Daño enemigo +25 % ----------
{const r=await E(async()=>{const s=gengi.raid();__calm();__open(6);__naked();
  const base={};for(const t of ['errante','corredor','abominacion']){const e=s.enemies.spawn(t,s.player.x+T*12,s.player.y,1);base[t]=e.dmg;s.enemies.kill(e);}
  gengi.god(false);s.snap.player.hp=100;
  const hits=[];const orig=s.damagePlayer.bind(s);s.damagePlayer=(n,c,react=true)=>{const h0=s.snap.player.hp;orig(n,c,react);if(react)hits.push({n,c,real:+(h0-s.snap.player.hp).toFixed(2)});};
  const hold=()=>{s.attackT=5;};s.events.on('update',hold); // el jugador no dispara (si no, lo empuja)
  const e=s.enemies.spawn('errante',s.player.x+T*2,s.player.y,1);s.enemies.becomeAlert(e,false);
  await __until(()=>hits.length>0,12);s.events.off('update',hold);s.attackT=0;s.damagePlayer=orig;gengi.god(true);s.enemies.kill(e);
  const late=s.enemies.spawn('errante',s.player.x+T*12,s.player.y,1.5);const lateDmg=late.dmg;s.enemies.kill(late);
  return {base,hit:hits[0],lateDmg};});
 ok('P2 daño ×1,25: Errante 6→7,5, Corredor 5→6,25, Abominación 18→22,5', r.base.errante===7.5&&r.base.corredor===6.25&&r.base.abominacion===22.5, JSON.stringify(r.base));
 ok('P2 golpe real de Errante sin armadura = 7,5 × [0,72;1,04] (v3.1: ×1,5 si crítico)', r.hit&&r.hit.real>=7.5*0.72-0.01&&r.hit.real<=7.5*1.04*1.5+0.01, JSON.stringify(r.hit));
 ok('P2 la curva por minuto va encima (×1,5 → 11,25)', Math.abs(r.lateDmg-11.25)<0.01, `${r.lateDmg}`);}

// ---------- 3. Escanear: radio 10 casillas, 3 s, también tras paredes ----------
{const r=await E(async()=>{const s=gengi.raid();__calm();const o=__open(8);s.snap.loadout.cabeza={uid:'qa-casco',def:'casco',rarity:'comun',qty:1};s.snap.player.cds={};
  const inW=(x,y,pad=20)=>s.walls.some(w=>x>w.x-pad&&x<w.x+w.w+pad&&y>w.y-pad&&y<w.y+w.h+pad);
  const blocked=(x0,y0,x1,y1)=>{for(let k=1;k<30;k++){if(inW(x0+(x1-x0)*k/30,y0+(y1-y0)*k/30,0))return true;}return false;};
  let wallSpot=null;
  for(const w of s.walls){if(wallSpot)break;const hz=w.w>=w.h;const cx=w.x+w.w/2,cy=w.y+w.h/2;
    const a=hz?{x:cx,y:w.y-T*2}:{x:w.x-T*2,y:cy},b2=hz?{x:cx,y:w.y+w.h+T*2}:{x:w.x+w.w+T*2,y:cy};
    if(a.x<80||a.y<80||b2.x<80||b2.y<80||a.x>s.physics.world.bounds.width-80||b2.y>s.physics.world.bounds.height-80)continue;
    if(!inW(a.x,a.y,26)&&!inW(b2.x,b2.y,26)&&blocked(a.x,a.y,b2.x,b2.y)){s.player.setPosition(a.x,a.y);s.player.body.reset(a.x,a.y);wallSpot=b2;}}
  const near=s.enemies.spawn('errante',wallSpot?wallSpot.x:s.player.x+T*5,wallSpot?wallSpot.y:s.player.y,1);
  let far=null;for(let a=0;a<32&&!far;a++){const x=s.player.x+Math.cos(a/32*6.283)*14*T,y=s.player.y+Math.sin(a/32*6.283)*14*T;if(x>60&&y>60&&x<s.physics.world.bounds.width-60&&y<s.physics.world.bounds.height-60&&!inW(x,y,26))far=s.enemies.spawn('errante',x,y,1);}
  for(const e of [near,far])if(e){e.turnT=1e9;window.__pins.set(e,{x:e.x,y:e.y});}
  let last=null;const h=s.hud;const orig=h.drawMinimap.bind(h);h.drawMinimap=(...a)=>{last=a[4];return orig(...a);};
  await __waitGame(0.1);s.refreshAbilities?.();const idx=s.abilityIds.indexOf('escanear');s.useAbility(idx);
  await __waitGame(0.3);const during=last.map(m=>Math.round(Math.hypot(m.x-s.player.x,m.y-s.player.y)/T*10)/10);const nearHidden=!near.visibleNow;
  const t=await __until(()=>last.length===0,6)+0.3;
  h.drawMinimap=orig;s.snap.loadout.cabeza=null;return {wall:!!wallSpot,during,nearHidden,t,far:!!far,scanDepth:s.scanGfx.depth,fogDepth:s.vision?.fogs?.[0]?.depth??s.vision?.rtA?.depth};});
 ok('P3 Escanear marca solo enemigos a ≤ 10 casillas (antes: todo el mapa)', r.during.length===1&&r.during[0]<=10&&r.far, JSON.stringify({dist:r.during,lejano14:r.far}));
 ok('P3 se ve también tras una pared (marca por encima de la niebla)', r.wall&&r.nearHidden&&r.during.length===1&&r.scanDepth>r.fogDepth, JSON.stringify({pared:r.wall,enemigoOculto:r.nearHidden,capas:[r.scanDepth,r.fogDepth]}));
 ok('P3 dura 3 s (antes 6 s)', Math.abs(r.t-3)<0.25, `${r.t.toFixed(2)} s`);}

// ---------- 4. Indicadores junto al jugador ----------
{const r=await E(async()=>{const s=gengi.raid();__calm();__open(6);
  s.snap.loadout.torso={uid:'qa-ch',def:'chaleco',rarity:'comun',qty:1};s.snap.loadout.cabeza={uid:'qa-ca',def:'casco',rarity:'comun',qty:1};s.snap.player.cds={};
  await __waitGame(0.1);s.useAbility(s.abilityIds.indexOf('aguantar'));s.useAbility(s.abilityIds.indexOf('escanear'));await __waitGame(0.2);
  const ia=s.markImgs.get('hab_aguantar'),ie=s.markImgs.get('hab_escanear');
  const txt=[...s.children.list,...s.scene.get('ui')?.children.list??[],...(s.hud?.scene?.children.list??[])].filter(o=>o.type==='Text'&&o.visible&&/AGUANTAR/i.test(o.text)).map(o=>o.text);
  const icons={a:ia&&ia.visible&&Math.round(ia.displayWidth),e:ie&&ie.visible&&Math.round(ie.displayWidth),row:ia&&ie&&Math.abs(ia.y-ie.y)<1&&Math.abs(ia.x-ie.x)>=18,above:ia&&ia.y<s.player.y-30};
  __naked();s.snap.player.cds={};gengi.god(false);const p=s.snap.player;
  p.hp=100;s.miniHpUntil=-1;s.hitTimes=[];await __waitGame(0.1);const full=s.miniShown;
  p.hp=30;await __waitGame(0.1);const low=s.miniShown;p.hp=100;await __waitGame(0.1);const back=s.miniShown;
  s.damagePlayer(2,'QA');await __waitGame(0.1);const one=s.miniShown;await __waitGame(1);s.damagePlayer(2,'QA');const tHit=__gt();await __waitGame(0.1);const two=s.miniShown;
  const t=await __until(()=>!s.miniShown,5);
  // estados
  gengi.god(false);s.addStatus('bleed',3);s.addStatus('poison',1);await __waitGame(0.1);const sb=s.markImgs.get('estado_sangrado'),sp=s.markImgs.get('estado_veneno');
  const st={b:sb?.visible&&Math.round(sb.displayWidth),bn:s.markTxt.get('estado_sangrado')?.text,p:sp?.visible&&Math.round(sp.displayWidth),pn:s.markTxt.get('estado_veneno')?.text,nextToBar:sb&&Math.abs(sb.y-(s.player.y+32))<6};
  p.bleed=[];p.poison=[];gengi.god(true);p.hp=100;return {icons,txt,bar:{full,low,back,one,two,stay:+(t+0.1).toFixed(2)},st};});
 ok('P4 habilidad activa: icono 18 px sobre la cabeza, varios en fila', r.icons.a===18&&r.icons.e===18&&r.icons.row&&r.icons.above, JSON.stringify(r.icons));
 ok('P4 ya no sale el texto AGUANTAR arriba', r.txt.length===0, JSON.stringify(r.txt));
 ok('P4 mini barra: oculta con vida llena, visible < 35 %', !r.bar.full&&r.bar.low&&!r.bar.back, JSON.stringify(r.bar));
 ok('P4 mini barra: 1 golpe no; 2 golpes en 3 s sí, y se queda 3 s', !r.bar.one&&r.bar.two&&Math.abs(r.bar.stay-3)<0.3, JSON.stringify(r.bar));
 ok('P4 estados: iconos 14 px con número de cargas junto a la barra', r.st.b===14&&r.st.p===14&&r.st.bn==='3'&&r.st.pn==='1'&&r.st.nextToBar, JSON.stringify(r.st));}

// ---------- 5. Niebla fuera del cono ----------
{const r=await E(async()=>{const s=gengi.raid();__calm();__open(7);gengi.face(0);
  const e=s.spawnAt('errante',s.player.x-T*3,s.player.y);e.turnT=1e9;window.__pins.set(e,{x:e.x,y:e.y});s.facing=0;await __waitGame(0.3);
  const f=s.vision.fogInfo();const out={...f,hidden:!e.visibleNow,spriteVis:e.sprite?.visible??null};s.enemies.kill(e);return out;});
 ok('P5 niebla al 45 % (antes 62 %) con borde difuminado (3 capas; v4d niebla v2: 1 máscara con degradado)', Math.abs(r.total-0.45)<0.005&&(r.layers===3||(r.v2&&r.layers===1)), JSON.stringify({total:+r.total.toFixed(3),capas:r.layers,v2:!!r.v2}));
 ok('P5 los enemigos en la niebla siguen ocultos', r.hidden, JSON.stringify(r));}

// ---------- 6. Cadencia a distancia ×0,67 ----------
{const r=await E(async()=>{const s=gengi.raid();__calm();__open(8);const lo=s.snap.loadout;const out={};
  for(const [w,extra] of [['pistola',{mag:99}],['arco',{}]]){
    lo.arma={uid:'qa-'+w,def:w,rarity:'comun',qty:1,...extra};if(w==='arco'){lo.mochila=[];gengi.give('flechas','comun',30);}
    s.snap.player.reload=0;const e=s.enemies.spawn('errante',s.player.x+T*3,s.player.y,1);e.hp=e.maxHp=99999;s.enemies.becomeAlert(e,false);window.__pins.set(e,{x:e.x,y:e.y});
    const times=[];let n0=s.stats.shots;const hook=()=>{if(s.stats.shots>n0){n0=s.stats.shots;times.push(__gt());}};s.events.on('update',hook);
    // apuntado manual; el arco exige soltar y volver a tensar entre flechas (se hace en cuanto dispara)
    const pull=()=>{if(s.fireLatch)gengi.aim(0.3,0);else gengi.aim(1,0);};s.events.on('update',pull);await __waitGame(w==='arco'?6:4.5);s.events.off('update',pull);gengi.aim(null);s.events.off('update',hook);s.enemies.kill(e);window.__pins.clear();
    const iv=[];for(let i=1;i<times.length;i++)iv.push(times[i]-times[i-1]);iv.sort((a,b)=>a-b);const med=iv[Math.floor(iv.length/2)];out[w]={shots:times.length,aps:+(1/med).toFixed(3)};}
  return out;});
 ok('P6 pistola: 1 disparo cada 0,8 s (v4d §7; antes 1,34/s)', Math.abs(r.pistola.aps-1/0.8)<0.08, JSON.stringify(r.pistola));
 ok('P6 arco: 1 flecha cada 1,4 s (v4d §7; antes 0,536/s)', Math.abs(r.arco.aps-1/1.4)<0.04, JSON.stringify(r.arco));}

// ---------- 7. Veneno y sangrado acumulables ----------
{const r=await E(async()=>{const s=gengi.raid();__calm();__open(6);__naked();gengi.god(false);const p=s.snap.player;p.hp=100;const out={};
  s.addStatus('bleed',7);out.max=p.bleed.length;p.bleed=[];
  // 1 carga de sangrado = 7,5 en 6 s (1,25/s)
  s.statusDealt.bleed=0;s.addStatus('bleed',1);await __waitGame(2);out.b2=+(s.statusDealt.bleed+s.statusAcc.bleed).toFixed(2);await __waitGame(4.6);out.bTot=+s.statusDealt.bleed.toFixed(2);out.bLeft=p.bleed.length;
  s.statusDealt.poison=0;s.addStatus('poison',1);await __waitGame(2);out.p2=+(s.statusDealt.poison+s.statusAcc.poison).toFixed(2);await __waitGame(2.6);out.pTot=+s.statusDealt.poison.toFixed(2);out.pLeft=p.poison.length;
  // temporizador por carga
  p.hp=100;s.addStatus('bleed',1);await __waitGame(2);s.addStatus('bleed',1);await __waitGame(4.3);out.own=p.bleed.length;out.ownLeft=+(p.bleed[0]??0).toFixed(1);p.bleed=[];
  // sin hit-stop ni cancelar curaciones
  p.hp=100;let hs=0;s.addStatus('poison',2);for(let i=0;i<40;i++){await __waitGame(0.05);if(s.hitStopActive())hs++;}out.hitStop=hs;p.poison=[];
  // charco de ácido: 1 carga/s
  p.hp=100;s.snap.acid.push({x:s.player.x,y:s.player.y,t:10});s.acidStackT=0;await __waitGame(3.2);out.acid=p.poison.length;s.snap.acid.length=0;p.poison=[];
  // explosión de Hinchado
  p.hp=100;const h=s.enemies.spawn('hinchado',s.player.x+T*1,s.player.y,1);s.enemies.explode(h);await __waitGame(0.05);out.boom=p.poison.length;p.poison=[];s.enemies.kill?.(h);
  // curas: venda quita sangrado; botiquín quita ambos
  gengi.give('vendaje','comun',2);gengi.give('botiquin','comun',1);
  p.hp=60;s.addStatus('bleed',2);s.addStatus('poison',2);s.useConsumable('vendaje');await __waitGame(1.6);out.venda={b:p.bleed.length,p:p.poison.length};
  p.healLeft=0;p.hp=60;s.addStatus('bleed',2);s.useConsumable('botiquin');await __waitGame(2.6);out.botiquin={b:p.bleed.length,p:p.poison.length};
  p.bleed=[];p.poison=[];p.healLeft=0;p.hp=100;
  // golpe cuerpo a cuerpo: 33 % de sangrado (se cuenta sobre muchos golpes, con modo dios)
  gengi.god(true);let hits=0,bl=0;const od=s.damagePlayer.bind(s),oa=s.addStatus.bind(s);
  s.damagePlayer=(n,c,react=true)=>{if(react&&c==='Errante')hits++;return od(n,c,react);};s.addStatus=(k,n)=>{if(k==='bleed')bl+=n;return oa(k,n);};
  for(let i=0;i<6;i++){const a=i/6*6.283;const e=s.enemies.spawn('errante',s.player.x+Math.cos(a)*T*2,s.player.y+Math.sin(a)*T*2,1);s.enemies.becomeAlert(e,false);}
  // umbral exacto del 33 %: con el azar fijado justo por debajo (0,32) siempre sangra; justo por encima (0,34) nunca
  const rnd=Math.random;const phase=async v=>{Math.random=()=>v;hits=0;bl=0;await __waitGame(8);Math.random=rnd;return {hits,bl};};
  const lo32=await phase(0.32),hi34=await phase(0.34);
  // y con azar real, la proporción (informativa)
  hits=0;bl=0;await __waitGame(20);
  s.damagePlayer=od;s.addStatus=oa;gengi.clearEnemies();window.__pins.clear();out.melee={lo32,hi34,real:{hits,bl,rate:+(bl/Math.max(1,hits)).toFixed(2)}};
  return out;});
 ok('P7 máximo 5 cargas por tipo', r.max===5, `${r.max}`);
 ok('P7 sangrado: 1 carga = 7,5 en 6 s (1,25/s)', Math.abs(r.b2-2.5)<0.2&&Math.abs(r.bTot-7.5)<0.05&&r.bLeft===0, JSON.stringify({a2s:r.b2,total:r.bTot}));
 ok('P7 veneno: 1 carga = 7,5 en 4 s (1,9/s)', Math.abs(r.p2-3.75)<0.25&&Math.abs(r.pTot-7.5)<0.05&&r.pLeft===0, JSON.stringify({a2s:r.p2,total:r.pTot}));
 ok('P7 cada carga lleva su temporizador', r.own===1&&Math.abs(r.ownLeft-1.7)<0.3, JSON.stringify({quedan:r.own,restante:r.ownLeft}));
 ok('P7 el daño de estado no hace hit-stop', r.hitStop===0, `${r.hitStop}`);
 ok('P7 charco de ácido: 1 carga de veneno por segundo dentro', r.acid>=3&&r.acid<=4, `${r.acid} cargas en 3,2 s`);
 ok('P7 explosión de Hinchado aplica veneno', r.boom===1, `${r.boom}`);
 ok('P7 la venda quita el sangrado (no el veneno); el botiquín quita ambos', r.venda.b===0&&r.venda.p>0&&r.botiquin.b===0&&r.botiquin.p===0, JSON.stringify({venda:r.venda,botiquin:r.botiquin}));
 ok('P7 golpe cuerpo a cuerpo: 33 % de sangrado (umbral exacto; proporción real informativa)', r.melee.lo32.hits>0&&r.melee.lo32.bl===r.melee.lo32.hits&&r.melee.hi34.hits>0&&r.melee.hi34.bl===0&&r.melee.real.hits>=10&&r.melee.real.rate>0.1&&r.melee.real.rate<0.6, JSON.stringify(r.melee));}

// ---------- 8. Curación con tiempo y botón mantenido ----------
const qpos=await E(()=>{const q=gengi.raid().hud.quick.bg;return {x:q.x,y:q.y}});
// v4d §7: venda y botiquín tienen cada uno su botón fijo de 44 px (el 2.º es el botiquín)
const bpos=await E(()=>{const h=gengi.raid().hud;const q=(gengi.v4d?.().cfg.HUD4D?.layout&&h.quick2)?h.quick2.bg:h.quick.bg;return {x:q.x,y:q.y}});
{await E(()=>{const s=gengi.raid();__calm();__open(7);__naked();gengi.god(false);const p=s.snap.player;s.snap.loadout.mochila=[];gengi.give('vendaje','comun',3);gengi.give('botiquin','comun',2);p.hp=50;s.settings.rapido='vendaje';s.healStats={done:0,cancelHit:0,cancelRelease:0};});
 // vendaje mantenido hasta el final
 const v0=await E(()=>__count('vendaje'));
 const tStart=await E(()=>__gt()); await p.touchscreen.touchStart(qpos.x,qpos.y);
 const mid=await E(async()=>{const s=gengi.raid();await __waitGame(0.5);const p=s.snap.player;const st=__gt()-(s.applying?.t??0);s.addStatus('bleed',1);
   const ring=s.reloadGfx.commandBuffer.length>0;const ap=!!s.applying;const cnt=__count('vendaje');
   // movimiento al 50 %, sin atacar/apuntar/cambiar
   gengi.move(1,0);await __waitGame(0.35);const v=Math.hypot(s.vel.x,s.vel.y);gengi.move(0,0);
   const sw=s.swapWeapon();const shots=s.stats.shots;gengi.aim(1,0);await __waitGame(0.2);const aimShots=s.stats.shots-shots;const aiming=s.rig.aiming;gengi.aim(null);
   return {st,ring,ap,cnt,v,sw,aimShots,aiming,bleedDuring:p.bleed.length,hpDuring:p.hp};});
 const done=await E(async()=>{const s=gengi.raid();const t=await __until(()=>!s.applying,4);return {t,end:__gt(),hs:{...s.healStats},healLeft:s.snap.player.healLeft,bleed:s.snap.player.bleed.length};});
 const tEnd=await E(()=>__gt()); await p.touchscreen.touchEnd(); await sleep(100);
 const v1=await E(()=>__count('vendaje'));
 const vmax=await E(async()=>{const s=gengi.raid();__open(7);gengi.move(1,0);await __waitGame(0.5);const v=Math.hypot(s.vel.x,s.vel.y);gengi.move(0,0);return v;});
 const dur=+(done.end-mid.st).toFixed(2); void tStart;
 ok('P8 venda: 1,5 s manteniendo el botón; se gasta y cura al terminar', Math.abs(dur-1.5)<0.12&&mid.cnt===v0&&v1===v0-1&&done.hs.done===1&&done.healLeft>0, JSON.stringify({dur,durante:mid.cnt,antes:v0,despues:v1}));
 ok('P8 mientras aplica: anillo de progreso, movimiento al 50 %, sin disparar/apuntar/cambiar', mid.ring&&mid.ap&&Math.abs(mid.v/vmax-0.5)<0.06&&mid.sw===false&&mid.aimShots===0&&!mid.aiming, JSON.stringify({anillo:mid.ring,vel:+(mid.v/vmax).toFixed(2),cambio:mid.sw,disparos:mid.aimShots}));
 ok('P8 los estados se quitan al terminar (no antes); el daño de estado no cancela', mid.bleedDuring===1&&done.bleed===0&&done.hs.cancelHit===0, JSON.stringify({sangradoDurante:mid.bleedDuring,despues:done.bleed}));
 // botiquín mantenido: 2,5 s
 await E(()=>{const s=gengi.raid();s.snap.player.healLeft=0;s.snap.player.hp=40;s.settings.rapido='botiquin';});
 const b0=await E(()=>__count('botiquin'));
 await p.touchscreen.touchStart(bpos.x,bpos.y);
 const bt=await E(async()=>{const s=gengi.raid();await __until(()=>!!s.applying,1);const t0=s.applying?s.applying.t:0;const st=__gt()-t0;await __until(()=>!s.applying,5);return +(__gt()-st).toFixed(2);});
 await p.touchscreen.touchEnd(); await sleep(100);
 const b1=await E(()=>__count('botiquin'));
 ok('P8 botiquín: 2,5 s manteniendo el botón', Math.abs(bt-2.5)<0.12&&b1===b0-1, JSON.stringify({dur:bt,antes:b0,despues:b1}));
 // soltar antes: se cancela sin gastar
 await E(()=>{const s=gengi.raid();s.snap.player.healLeft=0;s.snap.player.hp=40;s.settings.rapido='vendaje';});
 const c0=await E(()=>({v:__count('vendaje'),hp:gengi.raid().snap.player.hp}));
 await p.touchscreen.touchStart(qpos.x,qpos.y); await E(()=>__waitGame(0.8)); await p.touchscreen.touchEnd(); await sleep(120);
 const c1=await E(async()=>{const s=gengi.raid();await __waitGame(1.2);return {v:__count('vendaje'),hp:s.snap.player.hp,ap:!!s.applying,hs:{...s.healStats},healLeft:s.snap.player.healLeft};});
 ok('P8 soltar el botón antes de tiempo cancela y NO gasta el objeto', c1.v===c0.v&&!c1.ap&&c1.hs.cancelRelease===1&&c1.healLeft===0&&c1.hp===c0.hp, JSON.stringify({antes:c0,despues:c1}));
 // un golpe cancela sin gastar
 await E(()=>{gengi.raid().settings.rapido='botiquin';});
 const h0=await E(()=>__count('botiquin'));
 await p.touchscreen.touchStart(qpos.x,qpos.y);
 const h1=await E(async()=>{const s=gengi.raid();await __waitGame(1);const was=!!s.applying;s.damagePlayer(4,'QA');const now=!!s.applying;await __waitGame(2);return {was,now,later:!!s.applying,hs:{...s.healStats},healLeft:s.snap.player.healLeft,n:__count('botiquin')};});
 await p.touchscreen.touchEnd(); await sleep(100);
 ok('P8 un golpe cancela la curación y NO gasta el objeto', h1.was&&!h1.now&&!h1.later&&h1.n===h0&&h1.hs.cancelHit===1&&h1.healLeft===0, JSON.stringify({antes:h0,...h1}));
 // un toque corto (soltar enseguida) no cura
 const q0=await E(()=>({v:__count('vendaje'),b:__count('botiquin')}));
 await p.touchscreen.tap(qpos.x,qpos.y); await E(()=>__waitGame(3));
 const q1=await E(()=>({v:__count('vendaje'),b:__count('botiquin'),done:gengi.raid().healStats.done}));
 ok('P8 un toque corto no cura (hay que mantener)', q1.v===q0.v&&q1.b===q0.b, JSON.stringify({antes:q0,despues:q1}));
 await E(()=>{gengi.god(true);});}

ok('sin errores de consola', errs.length===0, errs.slice(0,3).join(' | '));
await b.close();
const fails=res.filter(r=>r.startsWith('FAIL')).length;
console.log(`\n${res.length-fails}/${res.length} PASS`);
process.exit(fails?1:0);
