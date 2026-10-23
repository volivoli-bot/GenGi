import puppeteer from 'puppeteer-core';
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
const b=await puppeteer.launch({executablePath:'/usr/bin/google-chrome',headless:'new',args:['--no-sandbox','--use-gl=swiftshader','--enable-unsafe-swiftshader']});
const p=await b.newPage(); await p.setViewport({width:390,height:844,isMobile:true,hasTouch:true});
const errs=[]; p.on('pageerror',e=>errs.push(e.message));
await p.goto('http://localhost:4173/?debug=1&noelite'); await p.waitForFunction(()=>window.gengi);
await p.evaluate(()=>gengi.reset()).catch(()=>{}); await sleep(600); await p.waitForFunction(()=>window.gengi);
const E=(f,...a)=>p.evaluate(f,...a);
// novato: sin god, bate, ver cuánto sobrevive a minuto 0 en 25 s quieto
await E(()=>gengi.start()); await sleep(1000);
const out=[];
for(let i=0;i<5;i++){await sleep(5000); out.push(await E(()=>{const s=gengi.raid();return s?{t:s.snap.elapsed.toFixed(0),hp:s.snap.player.hp.toFixed(0),en:s.enemies.list.length,fps:Math.round(s.game.loop.actualFps)}:'fin'}));}
console.log('novato quieto:',JSON.stringify(out));
let st=await E(()=>gengi.state()); console.log('log:',JSON.stringify(st.raidLog.at(-1)||null));
// stress minuto 12 con hordas
await E(()=>{document.querySelectorAll('button').forEach(b=>/Refugio|Continuar|Volver/.test(b.textContent)&&b.click())});
if(!(await E(()=>!!gengi.raid()?.snap))) {await E(()=>gengi.start()); await sleep(1000);}
await E(()=>{gengi.god(true);gengi.minute(12);gengi.spawn('hinchado',4);gengi.spawn('corredor',8);gengi.spawn('abominacion',1);});
const o2=[];for(let i=0;i<4;i++){await sleep(4000);o2.push(await E(()=>{const s=gengi.raid();return {t:s.snap.elapsed.toFixed(0),en:s.enemies.list.length,fps:Math.round(s.game.loop.actualFps),states:[...new Set(s.enemies.list.map(e=>e.state))].join('/')}}));}
console.log('min12:',JSON.stringify(o2));
// fog
await E(()=>{gengi.minute(15.5);}); await sleep(1500); console.log('niebla:',await E(()=>gengi.raid()?.snap.player.hp));
console.log('errores:',errs);
await b.close();
