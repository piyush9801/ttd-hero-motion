/* TTD hero motion test · shared engine.
   One 1920x1080 stage, scaled to fit the window. Scroll drives everything (no idle motion):
   the page is tall, the stage is pinned, and progress p (0..1) follows the scroll with a soft
   critically-damped lag (the house "pour, never snap"). ?rec=1 exposes window.__draw(p) for recording.
   Flat 2D only: depth comes from scale, crop, overlap and speed. No shadows. */
(function(){
const W=1920, H=1080;
const C={cream:'#F2EEE5',paper:'#FBF9F4',ink:'#171614',tan:'#C7B394',red:'#D65A4A',quiet:'#96938D'};
const clamp=(v,a=0,b=1)=>Math.min(b,Math.max(a,v));
const seg=(p,a,b)=>clamp((p-a)/(b-a));
const lerp=(a,b,t)=>a+(b-a)*t;
// cubic-bezier solver, so the house curves can be used on scrubbed values
function bez(x1,y1,x2,y2){
  const cx=3*x1, bx=3*(x2-x1)-cx, ax=1-cx-bx, cy=3*y1, by=3*(y2-y1)-cy, ay=1-cy-by;
  const X=t=>((ax*t+bx)*t+cx)*t, Y=t=>((ay*t+by)*t+cy)*t, dX=t=>(3*ax*t+2*bx)*t+cx;
  return x=>{ if(x<=0) return 0; if(x>=1) return 1; let t=x; for(let i=0;i<7;i++){ const d=dX(t); if(Math.abs(d)<1e-6) break; t-= (X(t)-x)/d; } return Y(clamp(t)); };
}
const E={
  house: bez(.22,1,.36,1),          // the house ease: pours in, settles long
  inOut: bez(.65,0,.35,1),
  in:    bez(.55,0,.85,.35),
  over:  bez(.3,1.3,.4,1),          // overshoot, for landings
  pop:   bez(.34,1.56,.64,1),       // anticipation pop
  back:  bez(.5,-.32,.3,1),         // anticipation: a small step back, then it pours forward
  backOver: bez(.6,-.38,.3,1.32),   // anticipation and overshoot together
  lin:   t=>t
};
// brand data: the waveform (bar wall, measured) and the four rows of "The pause is the idea"
const WAVE=[191,213,245,307,334,362,282,209,313,350,250,308,278,247,193];
const RH={
  statementA:[[100,127],[256,48],[436,111],[572,44],[704,183],[912,18]],
  replyA:[[620,104],[752,35],[872,52],[956,148],[1276,31]],
  statementB:[[100,27],[160,144],[392,92],[508,18],[654,96],[777,109]],
  replyB:[[620,67],[716,18],[870,112],[1014,63],[1106,60],[1257,19]]
};

// ---- stage
const rec=/rec=1/.test(location.search);
document.documentElement.style.cssText='margin:0;background:'+C.cream;
document.body.style.cssText='margin:0;background:'+C.cream+';font-family:"Helvetica Neue",Helvetica,Arial,sans-serif;-webkit-font-smoothing:antialiased;'+(rec?'overflow:hidden':'height:760vh');
const pin=document.createElement('div');
pin.style.cssText='position:fixed;inset:0;overflow:hidden;background:'+C.cream;
const stage=document.createElement('div');
stage.style.cssText=`position:absolute;left:0;top:0;width:${W}px;height:${H}px;overflow:hidden;background:${C.cream};transform-origin:0 0`;
pin.appendChild(stage); document.body.appendChild(pin);
function fit(){ const s=rec?1:Math.min(innerWidth/W, innerHeight/H); stage.style.transform=`translate(${(innerWidth-W*s)/2}px,${(innerHeight-H*s)/2}px) scale(${s})`; }
fit(); addEventListener('resize',fit);

// ---- small factories
function box(css,parent=stage){ const d=document.createElement('i'); d.style.cssText='position:absolute;display:block;'+css; parent.appendChild(d); return d; }
function bar(color,parent=stage){ return box(`background:${color};left:0;top:0;width:0;height:0;will-change:transform`,parent); }
// place a bar by its box (fast path: transform + size)
function put(d,x,y,w,h,o){ d.style.transform=`translate(${x}px,${y}px)`; d.style.width=Math.max(0,w)+'px'; d.style.height=Math.max(0,h)+'px'; if(o!==undefined) d.style.opacity=o; }

// the site's top bar, quiet and static
function nav(){
  const n=document.createElement('div');
  n.style.cssText='position:absolute;left:72px;right:72px;top:40px;display:flex;justify-content:space-between;align-items:flex-start;z-index:50';
  n.innerHTML=`<img src="${window.TTD_LOGO||'../assets/logo-dark.svg'}" style="height:46px;display:block" alt=""><div style="display:flex;gap:6px">${['The Work','The Dept.','Contact'].map(t=>`<span style="font-size:14px;line-height:1;padding:9px 12px 8px;border-radius:3px;background:#E2D9C9;color:${C.ink}">${t}</span>`).join('')}</div>`;
  stage.appendChild(n); return n;
}
// the option's name, small, bottom left (it is a test, so it says which one)
function tag(t){ if(window.TTD_SITE) return; const p=document.createElement('p'); p.style.cssText=`position:absolute;left:72px;bottom:34px;margin:0;font-size:14px;color:${C.quiet};z-index:50;letter-spacing:.01em`; p.textContent=t; stage.appendChild(p); }

// The headline, set word by word. Each word has a quiet copy (Light 300, grey) and a spoken copy
// (Medium 500, ink, narrowed to the quiet width the way a variable Helvetica's width axis would),
// cross-faded, so weight can change smoothly and the line never reflows.
function headline({x=72,y=150,size=112,lines=[['The','right','person','can','change'],['the','whole','conversation']],lh=1.04,quiet=C.quiet,parent=stage,dot=true}={}){
  const root=document.createElement('div'); root.style.cssText=`position:absolute;left:${x}px;top:${y}px;z-index:20;white-space:nowrap;font-size:${size}px;line-height:${lh};letter-spacing:-.03em`;
  parent.appendChild(root);
  const words=[];
  lines.forEach((ln,li)=>{
    const row=document.createElement('div'); root.appendChild(row);
    ln.forEach((w,wi)=>{
      const s=document.createElement('span'); s.style.cssText='position:relative;display:inline-block';
      s.innerHTML=`<span class="q" style="font-weight:300;color:${quiet}">${w}</span><span class="m" style="position:absolute;left:0;top:0;font-weight:500;color:${C.ink};opacity:0;transform-origin:0 50%;letter-spacing:-.012em">${w}</span>`;
      row.appendChild(s);
      if(wi<ln.length-1) row.appendChild(document.createTextNode(' '));
      words.push(s);
    });
    if(dot&&li===lines.length-1){ const d=document.createElement('span'); d.className='dot'; d.style.cssText=`display:inline-block;font-weight:400;color:${C.red}`; d.textContent='.'; row.appendChild(d); root.dot=d; }
  });
  words.forEach(s=>prepSpeak(s,quiet));
  root.words=words;
  // t: 0 quiet .. 1 spoken
  root.say=(i,t)=>{ const s=words[i]; if(s) speak(s,t); };
  root.hush=()=>words.forEach((_,i)=>root.say(i,0));
  return root;
}


// Story captions: lines from the brand book, one per beat, bottom left. Each rises in from behind a
// mask as its beat starts and leaves upward as it ends (block reveal, house ease).
function captions(beats,{x=72,y=928,w=1500,size=32,plate=false}={}){
  const box=document.createElement('div');
  box.style.cssText=`position:absolute;left:${x}px;top:${y}px;width:${w}px;height:48px;overflow:hidden;z-index:45`;
  if(plate){ box.style.width='auto'; box.style.minWidth='560px'; box.style.paddingRight='18px'; box.style.background=C.cream; box.style.left=(x-14)+'px'; box.style.paddingLeft='14px'; }
  stage.appendChild(box);
  const els=beats.map(([a,b,t],i)=>{ const e=document.createElement('p');
    e.style.cssText=`position:absolute;left:0;top:0;margin:0;white-space:nowrap;font-size:${size}px;line-height:48px;font-weight:300;letter-spacing:-.012em;color:${C.ink};will-change:transform`;
    e.innerHTML=`<span style="display:inline-block;width:${size*1.8}px;color:${C.quiet}">${String(i+1).padStart(2,'0')}</span>${t}`;
    box.appendChild(e); return {a,b,e}; });
  return p=>{ let any=false; els.forEach(({a,b,e})=>{
    const i=E.house(seg(p,a,a+.04)), o=b>1?0:E.house(seg(p,b-.035,b)), hid=p<a||(b<=1&&p>b);
    e.style.transform=`translateY(${((1-i)*110-o*110).toFixed(2)}%)`; e.style.visibility=hid?'hidden':'visible'; if(!hid) any=true;
  }); if(plate) box.style.visibility=any?'visible':'hidden'; };
}
// a row of brand dashes, repeated to run past the screen
function rowsOf(segs,{x0,K,reps=3,period=1290}){ const out=[]; for(let r=0;r<reps;r++) segs.forEach(([sx,w])=>out.push({x:x0+(sx-100+r*period)*K,w:w*K})); return out; }
// where a headline word or the full stop sits on the stage
function rectOf(el){ const s=stage.getBoundingClientRect(), r=el.getBoundingClientRect(), k=s.width/W; return {x:(r.left-s.left)/k,y:(r.top-s.top)/k,w:r.width/k,h:r.height/k}; }
// the voice: one stressed word travels along the line as k goes from -1 to 8
// Speaking without a double image. A word's quiet copy is re-set letter by letter (at the positions the shaped
// text had, so kerning is kept), with a Medium copy of each letter narrowed to that letter's Light width.
// speak(): the letters darken from quiet to ink first, then the weight steps letter by letter in reading
// order (each letter flips outright), so two weights are never seen on top of each other.
function prepSpeak(s,quiet){
  const q=s.firstChild, m=s.lastChild, tn=q.firstChild, rg=document.createRange();
  const sr=s.getBoundingClientRect(), ratio=s.offsetWidth/Math.max(1e-6,sr.width);
  const L=[...tn.textContent].map((ch,i)=>{ rg.setStart(tn,i); rg.setEnd(tn,i+1); const r=rg.getBoundingClientRect(); return {ch,x:(r.left-sr.left)*ratio,w:r.width*ratio}; });
  q.style.color='transparent'; if(m!==q) m.remove();
  const mk=(ch,x,wt,col)=>{ const e=document.createElement('span'); e.textContent=ch; e.style.cssText=`position:absolute;left:${x}px;top:0;font-weight:${wt};color:${col};letter-spacing:0;transform-origin:0 50%;white-space:pre`; s.appendChild(e); return e; };
  L.forEach(l=>{ const a=mk(l.ch,l.x,300,quiet); a.dataset.q=quiet; const b=mk(l.ch,l.x,500,C.ink); b.dataset.m=1; b.style.opacity=0;
    const bw=b.getBoundingClientRect().width*ratio; b.style.transform=`scaleX(${l.w/Math.max(1,bw)})`; });
}
const hex=h=>[1,3,5].map(i=>parseInt(h.slice(i,i+2),16));
function mix(a,b,t){ const A=hex(a),B=hex(b); return `rgb(${A.map((v,i)=>Math.round(v+(B[i]-v)*t)).join(',')})`; }
function swapLetters(Q,M,t,quiet){ const n=Q.length, c=clamp(t/.45), u=clamp((t-.4)/.6);
  for(let j=0;j<n;j++){ const f=u*n-j>=.5?1:0;   // each letter flips outright, in reading order: never two weights at once
    Q[j].style.color=mix(quiet||Q[j].dataset.q,C.ink,c); Q[j].style.opacity=1-f; M[j].style.opacity=f; } }
function speak(s,t){ if(s._t===t) return; s._t=t; const Q=s._Q||(s._Q=[...s.querySelectorAll('[data-q]')]), M=s._M||(s._M=[...s.querySelectorAll('[data-m]')]); swapLetters(Q,M,t); }

function voice(hl,k,keepLast){ for(let i=0;i<8;i++){ const t=(keepLast&&i===7&&k>7.4)?1:E.house(clamp(1-Math.abs(k-i-.5)*1.6)); hl.say(i,t); } }


// ---- speed: how fast the story is moving right now (p per second), so things can stretch and lean
let lastP=0, lastT=0, lastQ=0, hv=0, fv=0; const SPEED={v:0,f:0};
// SPEED.f is a springy reading of the hand's scroll speed (the scroll itself, before the soft lag): it trails
// while you scroll and swings past zero when you stop, so anything driven by it drags behind, then follows
// through and settles. Still caused only by scroll.
function trackSpeed(p,dt,q=p){ const k=Math.max(dt,1/240), raw=(p-lastP)/k; SPEED.v+= (raw-SPEED.v)*.25; lastP=p;
  hv+=((q-lastQ)/k-hv)*.2; lastQ=q;
  if(!SPEED.on){ SPEED.f=0; fv=0; hv=0; return; } fv+=(hv-SPEED.f)*.1; fv*=.82; SPEED.f+=fv; }
// put() with a speed trail: an element moving fast stretches back along its path, and snaps back when it stops
function putS(d,x,y,w,h,o,{k=1.1,max=1.8,vert=false}={}){
  const px=d._px, py=d._py; d._px=x; d._py=y;
  if(px===undefined||!SPEED.on){ put(d,x,y,w,h,o); return; }
  const dx=x-px, dy=y-py;
  if(Math.abs(dx)>700||Math.abs(dy)>700){ put(d,x,y,w,h,o); return; }
  if(!vert){ const sm=Math.min(Math.abs(dx)*k,w*max); put(d,dx>0?x-sm:x,y,w+sm,h,o); }
  else { const sm=Math.min(Math.abs(dy)*k,h*max); put(d,x,dy>0?y-sm:y,w,h+sm,o); }
}

// ---- the loop: scroll -> target -> soft follow -> draw
let draw=()=>{}, cur=0, target=0;
window.TTD={W,H,C,E,clamp,seg,lerp,bez,prepSpeak,speak,swapLetters,mix,WAVE,RH,stage,box,bar,put,putS,SPEED,nav,tag,headline,captions,rowsOf,rectOf,voice,
  run(fn){ draw=fn;
    if(rec){ window.__draw=(p,seq)=>{ SPEED.on=!!seq; trackSpeed(p,1/30); draw(p); return true; }; draw(0); document.documentElement.dataset.ready='1'; return; }
    SPEED.on=true; let t0=performance.now();
    const tick=()=>{ const max=document.documentElement.scrollHeight-innerHeight; target=clamp(scrollY/Math.max(1,max)); cur+=(target-cur)*.075; if(Math.abs(target-cur)<1e-4) cur=target; const t1=performance.now(); trackSpeed(cur,(t1-t0)/1000,target); t0=t1; draw(cur); window.TTD.p=cur; requestAnimationFrame(tick); };
    draw(0); requestAnimationFrame(tick);
  }};
})();
