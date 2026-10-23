// Capturas a 390×844 (móvil, táctil). Uso: node shots.mjs <dir>
import puppeteer from 'puppeteer-core';
const dir=process.argv[2]||'/workspace/gengi/shots';
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
const b=await puppeteer.launch({executablePath:'/usr/bin/google-chrome',headless:'new',args:['--no-sandbox','--use-gl=swiftshader','--enable-unsafe-swiftshader']});
for (const [name,q,wait] of [['hub','',2500],['raid','&shot=raid',4500],['inventario','&shot=inv',4500]]) {
  const ctx=await b.createBrowserContext(); const p=await ctx.newPage();
  await p.setViewport({width:390,height:844,isMobile:true,hasTouch:true,deviceScaleFactor:1});
  await p.goto('http://localhost:4173/?debug=1&noelite'+q); await sleep(wait);
  if (name!=='hub') await p.evaluate(()=>gengi.god(true));
  if (name==='raid') { await p.evaluate(()=>{const s=gengi.raid();for(const [k,dx,dy] of [['corredor',6,-2],['hinchado',-5,-10],['errante',2,11]]){const e=s.spawnAt(k,s.player.x+dx*48,s.player.y+dy*48);e.state='chase';}}); await sleep(250); }
  await p.screenshot({path:`${dir}/${name}.png`}); await ctx.close();
}
await b.close(); console.log('ok');
