/* The client site layer: runs one option full screen, with a quiet switcher to move between options.
   The switcher sits outside the scaled stage, so it stays the same size on any screen. */
(function(){
const LIST=window.LIST||[['01','H1','Pause and reply'],['02','H2','Blinds'],['03','H3','Spoken'],['04','H4','Strata'],
            ['05','V1','Listening'],['06','V2','Pace'],['07','V3','Step in'],['08','V4','The full stop']];
const GROUPS=window.GROUPS||[['Lines',0,4],['Waveform',4,8]];
const id=window.TTD_OPT, me=LIST.find(o=>o[1]===id);
document.title='Option '+me[0]+' · '+me[2]+' · The Talent Dept.';
TTD.run(OPTS[id].init());

const css=document.createElement('style');
css.textContent=`
.sw{position:fixed;left:50%;bottom:18px;transform:translateX(-50%);z-index:100;display:flex;align-items:center;gap:6px;flex-wrap:wrap;justify-content:center;
  font:14px/1 "Helvetica Neue",Helvetica,Arial,sans-serif;color:#171614;padding:6px;border-radius:6px;background:rgba(242,238,229,.92)}
.sw a{color:inherit;text-decoration:none;padding:9px 11px 8px;border-radius:3px;background:#E2D9C9;transition:background .4s cubic-bezier(.22,1,.36,1)}
.sw a:hover{background:#D5CAB5}
.sw a.on{background:#171614;color:#F2EEE5}
.sw .lab{color:#96938D;padding:0 4px 0 8px;font-size:13px}
.sw .all{background:none;border-bottom:1px solid rgba(23,22,20,.25);border-radius:0;padding:4px 2px 3px;margin-left:10px}
.hint{position:fixed;left:16px;bottom:78px;z-index:100;font:14px/1.3 "Helvetica Neue",Helvetica,Arial,sans-serif;color:#96938D;padding:10px 14px 9px;border-radius:6px;background:rgba(242,238,229,.94);transition:opacity .8s cubic-bezier(.22,1,.36,1)}
.hint b{display:block;color:#171614;font-weight:500}
.hint i{display:block;font-style:normal;color:#5b5853;margin:3px 0 2px}
@media (max-width:820px){ .hint{display:none} .sw .lab{display:none} .sw{bottom:10px;max-width:96vw} }`;
document.head.appendChild(css);
const sw=document.createElement('nav'); sw.className='sw';
sw.innerHTML=GROUPS.map(([g,a,b])=>`<span class="lab">${g}</span>${LIST.slice(a,b).map(o=>`<a href="${o[0]}.html" class="${o[1]===id?'on':''}" title="${o[2]}">${o[0]}</a>`).join('')}`).join('')+`<a class="all" href="index.html">All options</a>`;
document.body.appendChild(sw);
const hint=document.createElement('div'); hint.className='hint'; const pr=(window.PRINCIPLES||{})[id];
hint.innerHTML=`<b>Option ${me[0]} · ${me[2]}</b>${pr?`<i>${pr.join(' · ')}</i>`:''}Scroll slowly`;
document.body.appendChild(hint);
// the hint steps aside once scrolling starts, and comes back at the top
const watch=()=>{ hint.style.opacity=(window.TTD.p||0)<.015?1:0; requestAnimationFrame(watch); }; watch();
// arrow keys move between options
addEventListener('keydown',e=>{ const i=LIST.indexOf(me); if(e.key==='ArrowRight'&&i<LIST.length-1) location.href=LIST[i+1][0]+'.html'; if(e.key==='ArrowLeft'&&i>0) location.href=LIST[i-1][0]+'.html'; });
})();
