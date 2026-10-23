import puppeteer from 'puppeteer-core';
const URL='http://localhost:4173/?debug=1';
const res=[]; const ok=(name,cond,info='')=>{res.push(`${cond?'PASS':'FAIL'} ${name} ${info}`);};
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
const b=await puppeteer.launch({executablePath:'/usr/bin/google-chrome',headless:'new',args:['--no-sandbox','--use-gl=swiftshader','--enable-unsafe-swiftshader','--window-size=390,844']});
let p=await b.newPage(); await p.setViewport({width:390,height:844,isMobile:true,hasTouch:true});
const errs=[]; p.on('pageerror',e=>errs.push(e.message)); p.on('console',m=>{if(m.type()==='error')errs.push(m.text())});
await p.goto(URL); await p.waitForFunction(()=>window.gengi,{timeout:15000});
const E=(f,...a)=>p.evaluate(f,...a);
await E(()=>gengi.reset()).catch(()=>{}); await sleep(500); await p.waitForFunction(()=>window.gengi);
// legacy migration
await E(()=>gengi.loadLegacy()).catch(()=>{}); await sleep(800); await p.waitForFunction(()=>window.gengi);
let st=await E(()=>gengi.state()); ok('1.5 guardado antiguo migra', st.saveVersion===2 && typeof st.seenExits==='object', `chapas=${st.chapas} alijo=${st.stash.length}`);
// free gear unsellable
ok('2.1 equipo gratis presente', st.loadout.arma?.free && st.loadout.torso?.free);
// export/import
const ex=await E(()=>gengi.exportStr()); const imp=await E(s=>gengi.importStr(s),ex);
ok('1.4 exportar/importar ida y vuelta', JSON.stringify(imp.stash)===JSON.stringify(st.stash)&&imp.chapas===st.chapas);
ok('4.4 registro incluido en exportación', 'raidLog' in JSON.parse(ex));
// exits
const xc=await E(()=>gengi.exitCheck(300)); ok('3.1 salida garantizada (300 mapas)', xc.bad===0, JSON.stringify(xc.seen));
// start raid
// equipa la pistola y lleva 20 balas en la mochila, como haría el jugador en el refugio
await E(()=>{gengi.give('pistola','reforzado');gengi.give('municion','comun',20);});
await E(()=>gengi.equipFromStash('pistola')); await E(()=>gengi.stashToBackpack('municion'));
await E(()=>gengi.start()); await sleep(1500);
await E(()=>{gengi.god(true);gengi.clearEnemies();});
st=await E(()=>gengi.state()); ok('equipo sale del refugio al entrar (1 escritura)', st.activeRaid && !st.loadout.arma);
{const lo=st.activeRaid.loadout; const ammo=lo.mochila.filter(i=>i.def==='municion').reduce((n,i)=>n+i.qty,0);
 ok('2b se entra con el cargador lleno desde la mochila', lo.arma.def==='pistola'&&lo.arma.mag===12&&ammo===8, `mag=${lo.arma.mag} municion_mochila=${ammo}`);}
// inventario compacto: los toques sobre el panel nunca pasan al joystick ni a los botones
{
  await E(()=>{gengi.clearEnemies();gengi.give('vendaje','comun',3);gengi.god(false);gengi.hurt(40);gengi.god(true);gengi.inventory();}); await sleep(300);
  const geo=await E(()=>{const r=document.querySelector('.sheet').getBoundingClientRect();return {l:r.left,t:r.top,r:r.right,b:r.bottom,W:innerWidth,H:innerHeight}});
  const snapState=()=>E(()=>{const s=gengi.raid();return JSON.stringify({cds:s.snap.player.cds,bag:s.snap.loadout.mochila.map(i=>i.def+i.qty),joy:s.joy.pointerId})});
  const s0=await snapState();
  // 1) toque en la parte izquierda del panel (mitad izquierda de pantalla = zona del joystick)
  await p.touchscreen.touchStart(geo.l+12, geo.t+60); await sleep(120);
  const joyDuring=await E(()=>gengi.raid().joy.pointerId); await p.touchscreen.touchEnd(); await sleep(100);
  // 2) se fuerza el panel encima de los botones de habilidad y se toca justo sobre uno de ellos
  const btn=await E(()=>{const h=gengi.raid().hud;const b=h.abilities[0].bg;const q=h.quick.bg;const el=document.querySelector('.sheet');Object.assign(el.style,{top:(q.y-60)+'px',height:'200px'});return {x:b.x,y:b.y,qx:q.x,qy:q.y}});
  await p.touchscreen.tap(btn.x, btn.y); await sleep(100); await E(()=>document.querySelector('.ctx')?.remove()); /* v2: el toque abre el menú contextual del objeto; se cierra para que el 2º toque pruebe el botón de debajo */ await p.touchscreen.tap(btn.qx, btn.qy); await sleep(150);
  const s1=await snapState(); const stillOpen=await E(()=>!!document.querySelector('.sheet'));
  // control positivo: sin panel, el mismo toque SÍ usa el consumible rápido (el test es sensible)
  await E(()=>document.querySelector('.sheet .btn.x')?.click()); await sleep(100);
  await p.touchscreen.tap(btn.qx, btn.qy); await sleep(150); const s2=await snapState();
  ok('1b control: sin panel el toque llega al botón', s2!==s1, s2);
  ok('1b toques sobre el panel no llegan a joystick/botones', joyDuring===null && s0===s1 && stillOpen, `joy=${joyDuring} antes=${s0} despues=${s1}`);
  // 3) con el panel abierto, el joystick (abajo-izquierda) sigue funcionando: se puede huir
  await E(()=>{gengi.inventory();document.querySelector('.sheet .btn.x')?.click();gengi.inventory();}); await sleep(200);
  const x0=await E(()=>gengi.raid().player.x);
  await p.touchscreen.touchStart(60, geo.H-120); await sleep(50); await p.touchscreen.touchMove(120, geo.H-120); await sleep(900);
  const moved=await E(()=>({x:gengi.raid().player.x,open:!!document.querySelector('.sheet'),paused:gengi.raid().paused}));
  await p.touchscreen.touchEnd();
  ok('1c con el inventario abierto el joystick mueve al jugador (sin pausa)', moved.open && !moved.paused && moved.x-x0>20, `dx=${(moved.x-x0).toFixed(0)}`);
  await E(()=>document.querySelector('.sheet .btn.x')?.click());
}
// pause stops clock
await E(()=>gengi.minute(3)); await E(()=>gengi.pause());
const t0=await E(()=>gengi.raid().snap.elapsed); await sleep(2000); const t1=await E(()=>gengi.raid().snap.elapsed);
ok('1.3 reloj parado en pausa', t0===t1, `${t0}->${t1}`);
await E(()=>gengi.inventory()); ok('1.3 inventario bloqueado en pausa', !(await E(()=>document.querySelector('.sheet.open, .inv.open')!==null && gengi.raid().paused===false)) && await E(()=>!gengi.raid().canEditInventory()));
await E(()=>gengi.resume()); await sleep(1500);
const t2=await E(()=>gengi.raid().snap.elapsed); ok('reloj sigue tras reanudar', t2>t1, `${t2}`);
// background via freeze lifecycle
await E(()=>gengi.raid().player.setPosition(1500,1500));
const cdp=await p.target().createCDPSession();
await cdp.send('Page.setWebLifecycleState',{state:'frozen'}); await sleep(300); await cdp.send('Page.setWebLifecycleState',{state:'active'}); await sleep(300);
let ls=await E(()=>JSON.parse(localStorage.getItem('gengi.save')).activeRaid);
const paused=await E(()=>gengi.raid().paused);
ok('1.1 guardado al congelar/segundo plano', ls && ls.player.x===1500 && paused, `x=${ls?.player.x} paused=${paused} el=${ls?.elapsed.toFixed(2)}`);
// visibilitychange: simulate hidden
await E(()=>gengi.resume()); await sleep(700);
await E(()=>{Object.defineProperty(document,'visibilityState',{configurable:true,get:()=>'hidden'});Object.defineProperty(document,'hidden',{configurable:true,get:()=>true});document.dispatchEvent(new Event('visibilitychange'));});
const elHidden=await E(()=>gengi.raid().snap.elapsed); ls=await E(()=>JSON.parse(localStorage.getItem('gengi.save')).activeRaid);
ok('1.1 guardado en visibilitychange=hidden', Math.abs(ls.elapsed-elHidden)<0.001 && await E(()=>gengi.raid().paused), `${ls.elapsed} vs ${elHidden}`);
// reload -> resume exactly
// recarga = abrir la app de nuevo (pestaña nueva, mismo almacenamiento). Chrome headless deja la pestaña congelada como 'hidden' sin rAF tras Page.setWebLifecycleState, así que no se reutiliza.
{const old=p; p=await b.newPage(); await p.setViewport({width:390,height:844,isMobile:true,hasTouch:true}); p.on('pageerror',e=>errs.push(e.message)); p.on('console',m=>{if(m.type()==='error')errs.push(m.text())}); await old.close(); await p.goto(URL);} {let okr=false; const rt0=Date.now(); for(let i=0;i<80&&!okr;i++){await sleep(250); okr=await E(()=>!!(window.gengi&&gengi.raid()&&gengi.raid().snap)).catch(()=>false);} if(!okr){console.log('RELOAD FAIL',errs);process.exit(1);} } await sleep(800);
const r2=await E(()=>({el:gengi.raid().snap.elapsed,x:gengi.raid().player.x,paused:gengi.raid().paused}));
ok('1.1 retoma en el punto exacto tras recarga', Math.abs(r2.el-elHidden)<0.001 && Math.round(r2.x)===Math.round(ls.player.x) && r2.paused, JSON.stringify(r2));
ok('1.2 sin rollback: recargar no reinicia la raid', r2.el>100);
await E(()=>{gengi.resume();gengi.god(true);gengi.clearEnemies();});
// flare window
await E(()=>gengi.give('bengala'));
const fl=await E(async()=>{const s=gengi.raid();const e=s.snap.exits;const ext=s.extraction;let b=e.find(x=>x.type==='bengala');const fake=b||{loc:9,type:'bengala',x:s.player.x,y:s.player.y,gen:0,unlocked:false,flareAt:null};if(!b){ext.exits.push(fake);} s.player.setPosition(fake.x,fake.y);const out={};for(const m of [7.9,8.2,9.9,10.1]){s.snap.elapsed=m*60;ext.current=null;const st=ext.update(0.016);out[m]=!!(st.action);} if(!b) ext.exits.pop(); return out;});
ok('3.3 bengala solo minutos 8–10', !fl['7.9']&&fl['8.2']&&fl['9.9']&&!fl['10.1'], JSON.stringify(fl));
// hit penalty
const hp=await E(()=>{const s=gengi.raid();const ext=s.extraction;const e=s.snap.exits[0];e.unlocked=true;e.flareAt=s.snap.elapsed;s.player.setPosition(e.x,e.y);ext.update(0.016);ext.hold=5;ext.onHit();const a=ext.hold;ext.hold=1;ext.onHit();return [a,ext.hold];});
ok('3.2 golpe resta 2 s y no baja de 0', hp[0]===3&&hp[1]===0, JSON.stringify(hp));
// paid exit takes exactly 1 reforzado+
const pay=await E(()=>{const s=gengi.raid();gengi.give('machete','militar');gengi.give('tablas','reforzado');gengi.give('vendaje','comun',2);const cnt=()=>{const l=s.snap.loadout;return [l.arma,l.torso,l.cabeza,l.bolsillo,...l.mochila].filter(Boolean).length};const before=cnt();const ok=s.pay();const after=cnt();return {ok,before,after,machete:s.snap.loadout.mochila.some(i=>i.def==='machete')}});
ok('2.3 salida de pago quita exactamente 1 objeto Reforzado+ (el más barato)', pay.ok&&pay.before-pay.after===1&&pay.machete, JSON.stringify(pay));
// extraction with full stash -> overflow
await E(()=>{const d=gengi.state();});
const before=await E(()=>gengi.state());
await E(()=>{const s=gengi.raid();for(let i=0;i<3;i++)gengi.give('arco','comun');});
const bag=await E(()=>gengi.raid().snap.loadout.mochila.reduce((n,i)=>n+i.qty,0));
// fill stash via host save directly
await E(()=>{const a=gengi.raid().host; for(let i=a.save.data.stash.length;i<30;i++){a.save.data.stash.push({uid:'f'+i,def:'tablas',rarity:'comun',qty:1});}});
const q0=await E(()=>{const d=gengi.raid().host.save.data;return [...d.stash,...d.overflow].reduce((n,i)=>n+i.qty,0)});
await E(()=>{const s=gengi.raid();const e=s.snap.exits[0];s.host.endRaid('extraido',{exit:e});}); await sleep(300);
const afterX=await E(()=>gengi.state());
const q1=[...afterX.stash,...afterX.overflow].reduce((n,i)=>n+i.qty,0)+0;ok('1.7 extracción con alijo lleno: nada se pierde (excedente)', afterX.stash.length===30 && q1-q0===bag, `q ${q0}+${bag}=${q1}`, `mochila=${bag} excedente=${afterX.overflow.length} log=${afterX.raidLog.length}`);
ok('4.4 entrada de registro', afterX.raidLog.at(-1).result==='extraido');
// death keeps only pocket
await E(()=>{document.querySelectorAll('.overlay button, .card button').forEach(b=>b.textContent.includes('Refugio')||b.textContent.includes('Continuar')?b.click():0)});
await E(()=>{const a=gengi.raid()?.host;}); 
await E(()=>gengi.start()); await sleep(1200);
const pk=await E(()=>{const s=gengi.raid();gengi.god(true);gengi.give('botiquin','comun');const it=s.snap.loadout.mochila.find(i=>i.def==='botiquin');s.invToPocket(it.uid);gengi.give('machete','militar');return s.snap.loadout.bolsillo?.def});
const stashBefore=(await E(()=>gengi.state())).stash.length;
await E(()=>{gengi.god(false);gengi.kill();}); await sleep(400);
const d=await E(()=>gengi.state());
ok('1.6 muerte conserva solo el bolsillo', pk==='botiquin'&&d.loadout.bolsillo?.def==='botiquin'&&d.loadout.arma?.free&&d.stash.length===stashBefore&&!d.activeRaid, `bolsillo=${d.loadout.bolsillo?.def} arma=${d.loadout.arma?.def}(gratis) causa=${d.raidLog.at(-1).killedBy}`);
// free gear can't be sold
console.log(res.join('\n')); console.log('ERRORES:',errs.slice(0,10));
await b.close();
