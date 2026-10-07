/* Round 7c · Speak Up at scale x5 and Line of Sight x5, made immersive.
   Always something moving: layers at their own speeds, pieces that stretch with scroll speed and snap
   back, type that leans into the motion, and one big moment in each. Flat 2D only, no shadows.
   Captions are Brand Standards lines, verbatim. */
(function(){
const {W,H,C,E,clamp,seg,lerp,RH,WAVE,stage,bar,put,putS,SPEED,nav,headline,captions,rectOf,prepSpeak,speak,swapLetters}=TTD;
const softFloor=(v,floor,k=150)=>floor+k*Math.log(1+Math.exp((v-floor)/k));
const bump=(x,w)=>Math.exp(-(x*x)/(w*w));
// lean: type tilts a little into fast movement (pxPerP = how many px the layer moves per unit of scroll)
// lean follows the springy speed, so type tilts back the other way when you stop, then settles (follow-through)
const lean=pxPerP=>clamp(-SPEED.f*pxPerP/260,-9,9);
const sec=(f,p,e=.002)=>(f(Math.min(1,p+e))-f(p))/e;              // px per unit p, for lean and trails
// anticipation: a 0..1..0 pulse at the very start of a move (t = the move's own 0..1), to step the other way first
const ant=(t,a=.2)=>t>0&&t<a?Math.sin(Math.PI*t/a):0;
// a small spring, stepped once per frame; in stills it sits on its target
function spring(k=.2,d=.7){ let x=null,v=0; return t=>{ if(x===null||!SPEED.on){ x=t; v=0; return x; } v+=(t-x)*k; v*=d; x+=v; return x; }; }
// the full stop halting at a wall: it is carried until the wall, squashes against it, then springs back square
const halt=(raw,floor)=>{ const x=softFloor(raw,floor), push=x-raw; return {x,imp:Math.sin(Math.PI*clamp(push/520))}; };
function putSquash(el,x,bottom,S,imp,o){ const w=S*(1-.36*imp), h=S*(1+.3*imp); put(el,x,bottom-h,w,h,o); }

function local(el){ const t=el.style.transform; el.style.transform='none'; const r=rectOf(el); el.style.transform=t; return r; }
// a line of words, quiet and spoken copies cross-faded (spoken narrowed to the quiet width)
function typeLine(words,{size,left=0,top=0,color=C.quiet,dot=true,z=10,track=-.04,parent=stage}){
  const el=document.createElement('div');
  el.style.cssText=`position:absolute;left:${left}px;top:${top}px;font-size:${size}px;line-height:1;letter-spacing:${track}em;white-space:nowrap;z-index:${z};transform-origin:0 0`;
  parent.appendChild(el);
  const ws=words.map((w,i)=>{ const s=document.createElement('span'); s.style.cssText='position:relative;display:inline-block;transform-origin:50% 100%';
    s.innerHTML=`<span style="font-weight:300;color:${color}">${w}</span><span style="position:absolute;left:0;top:0;font-weight:500;color:${C.ink};opacity:0;transform-origin:0 50%;letter-spacing:-.012em">${w}</span>`;
    el.appendChild(s); if(i<words.length-1) el.appendChild(document.createTextNode(' ')); return s; });
  if(dot){ const d=document.createElement('span'); d.style.cssText=`font-weight:400;color:${C.red}`; d.textContent='.'; el.appendChild(d); el.dot=d; }
  ws.forEach(s=>prepSpeak(s,color));
  el.words=ws; el.say=(i,t)=>speak(ws[i],t);
  return el;
}
// a big word split into letters, each movable on its own (quiet and spoken copies per letter)
function letters(text,{size,left,top,color=C.quiet,z=10,track=-.045,dot=true}){
  const probe=typeLine([text],{size,left,top,color,z,track,dot}); const base=local(probe);
  const tn=probe.words[0].firstChild.firstChild, rg=document.createRange(), sr=stage.getBoundingClientRect(), k=sr.width/W;
  const L=[...text].map((ch,i)=>{ rg.setStart(tn,i); rg.setEnd(tn,i+1); const r=rg.getBoundingClientRect(); return {ch,x:(r.left-sr.left)/k-base.x,w:r.width/k}; });
  const dotR=dot?local(probe.dot):null; probe.remove();
  const el=document.createElement('div'); el.style.cssText=`position:absolute;left:${left}px;top:${top}px;font-size:${size}px;line-height:1;white-space:nowrap;z-index:${z}`;
  stage.appendChild(el);
  L.forEach(l=>{ const s=document.createElement('span'); s.style.cssText=`position:absolute;left:${l.x}px;top:0;display:block`;
    s.innerHTML=`<span style="font-weight:300;color:${color}">${l.ch}</span><span style="position:absolute;left:0;top:0;font-weight:500;color:${C.ink};opacity:0;transform-origin:50% 50%">${l.ch}</span>`;
    el.appendChild(s); l.s=s; });
  L.forEach(l=>{ const q=l.s.firstChild,m=l.s.lastChild; const qw=q.getBoundingClientRect().width,mw=m.getBoundingClientRect().width; m.style.transform=`scaleX(${qw/Math.max(1,mw)})`; });
  let dotEl=null; if(dot){ dotEl=document.createElement('span'); dotEl.style.cssText=`position:absolute;left:${dotR.x-base.x}px;top:0;font-weight:400;color:${C.red}`; dotEl.textContent='.'; el.appendChild(dotEl); }
  return {el,L,dotEl,dotX:dot?dotR.x-base.x+dotR.w*.5:0,width:base.w,
    say(t){ swapLetters(L.map(l=>l.s.firstChild),L.map(l=>l.s.lastChild),t,color); },
    spread(off){ L.forEach((l,i)=>l.s.style.transform=`translateX(${off(i)}px)`); if(dotEl) dotEl.style.transform=`translateX(${off(L.length)}px)`; }};
}
// a laid-out headline turned into separately movable words, for flying through the sentence
function floatWords(hl){
  const cs=getComputedStyle(hl), fs=parseFloat(cs.fontSize);
  const words=hl.words.map((w,i)=>{ const r=rectOf(w); const el=w.cloneNode(true);
    el.style.cssText+=`;position:absolute;left:${r.x}px;top:${r.y}px;font-size:${fs}px;line-height:${cs.lineHeight};letter-spacing:${cs.letterSpacing};white-space:nowrap;transform-origin:0 0;z-index:${i===7?14:20+i}`;
    stage.appendChild(el); return {el,r,i}; });
  const dr=rectOf(hl.dot), d=hl.dot.cloneNode(true);
  d.style.cssText+=`;position:absolute;left:${dr.x}px;top:${dr.y}px;font-size:${fs}px;line-height:${cs.lineHeight};transform-origin:0 0;z-index:15`;
  stage.appendChild(d); hl.style.visibility='hidden';
  const say=(i,t)=>speak(words[i].el,t);
  return {words,dot:{el:d,r:dr},fs,say};
}

// ---- Morse: the brand's statement and reply rows, made to carry words. A dot is one unit (a square, like the
// red full stop), a dash three; one unit between signals, three between letters, seven between words.
const MORSE={A:'.-',B:'-...',C:'-.-.',D:'-..',E:'.',F:'..-.',G:'--.',H:'....',I:'..',J:'.---',K:'-.-',L:'.-..',M:'--',N:'-.',O:'---',P:'.--.',Q:'--.-',R:'.-.',S:'...',T:'-',U:'..-',V:'...-',W:'.--',X:'-..-',Y:'-.--',Z:'--..','.':'.-.-.-'};
function morse(text){ const runs=[]; let x=0, li=0;
  text.toUpperCase().split(' ').forEach((w,wi)=>{ if(wi) x+=7; [...w].forEach((ch,ci)=>{ if(ci) x+=3;
    [...MORSE[ch]].forEach((sg,si)=>{ if(si) x+=1; const l=sg==='.'?1:3; runs.push({x,l,ch,wi,li}); x+=l; }); li++; }); });
  return {runs,len:x}; }
const snap=(v,u)=>Math.round(v/u)*u;

// ---- signals on one grid. U is the unit: a dot is one unit long, a dash three. Marks are strokes, not
// squares. Nothing drifts: things key on and off, grow by whole units, or step along one axis and lock.
const U=20, DH=12;
const mk=(c,z=10)=>{ const e=bar(c); e.style.zIndex=z; return e; };
function sg(q,x,y,l=q.l,h=DH){ if(l<=0){ put(q.el,0,0,0,0); return; } put(q.el,x,y-h/2,l*U,h); }
// a row of signals for some words; kn adds the telegraph "over to you" (-.--.), red adds the full stop
function mrow(text,{col=C.ink,red=false,kn=false}={}){ const m=morse(text); let len=m.len;
  const runs=m.runs.map(r=>({...r,el:mk(col)}));
  if(kn){ len+=7; [...'-.--.'].forEach((s,i)=>{ if(i) len+=1; const l=s==='.'?1:3; runs.push({x:len,l,el:mk(col)}); len+=l; }); }
  if(red){ runs.push({x:len+3,l:1,el:mk(C.red,14),red:true}); len+=4; }
  return {runs,len}; }
// the hero line as four rows, statements ink and replies tan, set flush right on one column so the red
// full stop is on screen and the starts run off the left edge
function heroRows(COL=1640){ const ys=[372,492,612,732];
  return [['THE RIGHT PERSON',C.ink],['CAN CHANGE',C.tan],['THE WHOLE',C.ink],['CONVERSATION',C.tan]].map(([t,col],i)=>{
    const r=mrow(t,{col,red:i===3}); r.y=ys[i]; r.x0=COL-r.len*U; return r; }); }
// a move in whole units from D to 0: one unit back first, the move, one unit past, settle.
// coarse: big steps while far, smaller as it closes in, like the tumblers of a lock
function stepTo(D,t,coarse=false){ if(!D) return 0; if(t<=0) return D; if(t>=1) return 0; const s=Math.sign(D);
  if(t<.1) return D+s; if(t>.88) return t<.96?-s:0;
  const v=D*(1-E.inOut((t-.1)/.78)), a=Math.abs(v), st=coarse?(a>24?8:a>8?4:a>3?2:1):1; return Math.round(v/st)*st; }

// ---- the waveform: the brand book's bar wall, 21 bars running past both edges, on one axis
const WH=[...WAVE.slice(9),...WAVE], WN=WH.length, WAX=600, WSC=1.6, WP=140, WW=50;
const wbx=i=>960+(i-(WN-1)/2)*WP;
function wput(b,x,w=WW,h=b.h){ put(b.el,x-w/2,WAX-h/2,w,h); }
// a waveform study: the headline small, set so its red full stop sits right above the presence's slot;
// the bars; and the presence. arrive(): the full stop drops straight down out of the sentence in whole
// units (a unit up first), lands on the row's axis, grows to a square in three steps, then stretches into
// a bar, one step past, then settles. It never crosses the type.
function waveStudy({bars=true,slot=960}={}){
  nav();
  const hl=headline({x:72,y:150,size:56,lines:[['The','right','person','can','change'],['the','whole','conversation']]});
  const d=rectOf(hl.dot); hl.style.left=(72+snap(slot,U)-(d.x+d.w/2))+'px';
  const dr=rectOf(hl.dot), d0={x:dr.x+dr.w/2,y:dr.y+dr.h*.83,s:56*.11};
  const pr=mk(C.red,16);
  const B=bars?WH.map((h,i)=>({h:h*WSC,i,el:mk(C.ink)})):[];
  const SQ=80;
  function arrive(p,{go,w=WW,h=362*WSC},follow=null,hide=false){
    if(hide){ put(pr,0,0,0,0); return; }
    const t=seg(p,go[0],go[1]), td=seg(t,0,.45), tg=seg(t,.45,.7), tb=seg(t,.7,1);
    hl.dot.style.opacity=t>0?0:1;
    const DY=Math.round((d0.y-WAX)/U), cy=t>=.45?WAX:WAX+stepTo(DY,td)*U;
    let cx=d0.x; if(follow!==null&&t>=1) cx=follow;
    let ww=d0.s, hh=d0.s;
    if(t>=.45){ const g=[22,44,SQ][Math.min(2,Math.floor(tg*3))]; ww=hh=g; }
    if(tb>0){ const k=Math.min(4,Math.floor(tb*5)); ww=[SQ,70,58,w,w][k]; hh=[SQ,220,480,h*1.06,h][k]; }
    if(t>=1){ ww=w; hh=h; }
    put(pr,cx-ww/2,cy-hh/2,ww,hh,t>0?1:0);
  }
  return {hl,bars:B,arrive};
}

const SU_LINE=['The','right','person','can','change','the','whole'];
window.LIST=[['01','SU1','Grow'],['02','SU2','Pan'],['03','SU3','Read aloud'],['04','SU4','Three scales'],['05','SU5','Into the o'],
             ['06','LS0','Walk through'],['07','LS1','Unison'],['08','LS2','Over to you'],['09','LS3','Me to we'],['10','LS4','Lines'],['11','LS5','Gather'],
             ['12','W1','Pace'],['13','W2','Gather'],['14','W3','Weight'],['15','W4','Step in']];
window.GROUPS=[['Speak Up',0,5],['Line of Sight',5,11],['Waveform',11,15]];
window.PRINCIPLES={
  SU1:['Anticipation','Arcs','Squash and stretch'], SU2:['Anticipation','Drag and follow-through','Squash and stretch'],
  SU3:['Squash and stretch','Overlapping action','Secondary action'], SU4:['Anticipation','Overshoot and settle','Overlapping action'],
  SU5:['Anticipation','Arcs','Exaggeration'], LS0:['Slow in and slow out','Staging','Timing'], LS1:['Anticipation','Overshoot and settle','Timing'],
  LS2:['Timing','Staging','Overlapping action'], LS3:['Overlapping action','Overshoot and settle','Staging'],
  LS4:['Slow in and slow out','Overlapping action','Staging'], LS5:['Anticipation','Overshoot and settle','Follow-through'],
  W1:['Anticipation','Overlapping action','Staging'], W2:['Overlapping action','Overshoot and settle','Staging'],
  W3:['Timing','Follow-through','Staging'], W4:['Timing','Exaggeration','Staging']};

window.OPTS={

// 01 · GROW.  You fly into the sentence. Every other word rushes past you at its own speed, the far ones
// first, crossing over each other, while "conversation" grows to fill the screen and past it. Then you
// travel along it; it leans into the speed. The word runs on and out; the full stop stays, alone.
SU1:{init(){
  nav(); const hl=headline(); const F=floatWords(hl);
  const cap=captions([[.03,.3,'Every detail speaks.'],[.3,.66,'One clear voice, shaped by scale.'],[.66,1.1,'Leave space to respond.']],{x:1250,y:104,w:620,size:28});
  const c=F.words[7], fx=c.r.x, fy=c.r.y+.8895*F.fs;
  const D=[1.9,1.78,1.66,1.55,1.46,1.3,1.2];                         // how near each word is: nearer flies faster
  // the final size, measured once, so the pan knows how long the word is
  c.el.style.transform='scale(8.75)'; const Wbig=c.el.getBoundingClientRect().width/(stage.getBoundingClientRect().width/W); c.el.style.transform='';
  const dotRel=(F.dot.r.x-c.r.x)+F.dot.r.w*.5;                      // at 112px
  const sq=bar(C.red); sq.style.zIndex=30; const STOP=1180;
  const panX=p=>-(Wbig-1560)*E.inOut(seg(p,.5,.82))-(Wbig*.5+700)*E.in(seg(p,.84,1));
  return p=>{
    const g=E.back(seg(p,.1,.46)), S=Math.exp(Math.log(8.75)*g);    // anticipation: the sentence draws back before you dive
    const Fx=lerp(fx,40,g)+panX(p), Fy=lerp(fy,1010,g)-150*Math.sin(Math.PI*clamp(g));   // an arc, not a straight line
    F.say(7,E.house(seg(p,.03,.12)));
    F.words.forEach((w,i)=>{ const d=i===7?1:D[i], sc=Math.pow(S,d);
      const x=Fx+(w.r.x-fx)*sc, y=Fy+(w.r.y-fy)*sc;
      w.el.style.transform=`translate(${x-w.r.x}px,${y-w.r.y}px) scale(${sc})${i===7?` skewX(${lean(sec(panX,p))}deg)`:''}`; });
    // the full stop: part of the word until the word runs on, then it halts and stays
    const dx=Fx+dotRel*S, S2=.13*F.fs*S, held=p>.8;
    F.dot.el.style.transform=`translate(${Fx+(F.dot.r.x-fx)*S-F.dot.r.x}px,${Fy+(F.dot.r.y-fy)*S-F.dot.r.y}px) scale(${S})`; F.dot.el.style.opacity=held?0:1;
    const hs=halt(dx-S2/2,STOP); putSquash(sq,hs.x,Fy,S2,held?hs.imp:0,held?1:0);
    cap(p);
  };
}},

// 02 · PAN.  "conversation." is too big for the screen and runs past. Its letters are on a chain: when you
// scroll fast they stretch apart, when you slow they close up. A huge tan waveform moves far behind, the
// first line drifts above at a fifth of the speed. The full stop halts. The waveform arrives, bar by bar, and makes room.
SU2:{init(){
  nav();
  const top=typeLine(SU_LINE,{size:84,left:72,top:150,dot:false,track:-.03});
  const cap=captions([[.02,.24,'One clear voice, shaped by scale.'],[.55,.77,'Every detail speaks.'],[.77,1.1,'Every conversation has a rhythm.']],{x:1250,y:104,w:620,size:28});
  const G=980, Lw=letters('conversation',{size:G,left:40,top:H-G*.98+70,z:10});
  const S=G*.13, dotY=H-G*.98+70+G*.79-S;
  Lw.dotEl.style.opacity=0; const sq=bar(C.red); sq.style.zIndex=30;
  const STOP=660, AX=560;
  const bars=WAVE.map((h,i)=>{ const side=i<5?-1:1; return {h:h*2,x1:i<5?STOP-150-(4-i)*96:STOP+120+(i-5)*96,side,el:bar(C.ink),i}; });
  const off=p=>-(Lw.width+300)*E.inOut(seg(p,.1,.7))+90*ant(seg(p,.1,.7),.16);   // anticipation: a nudge right, then it runs
  return p=>{
    Lw.say(E.house(seg(p,.03,.16)));
    const o=off(p), v=sec(off,p)*SPEED.f;                              // px per second, springy
    Lw.el.style.transform=`translateX(${o}px) skewX(${lean(sec(off,p))}deg)`;
    const chain=clamp(-v*.03,-50,170); Lw.spread(i=>chain*i/11);          // the chain: letters stretch apart, bunch up when you stop, settle
    top.style.transform=`translateX(${o*.2}px)`;
    const hs=halt(40+o+Lw.dotX-S/2,STOP), y=lerp(dotY,AX-S/2,E.house(seg(p,.6,.8)));
    const grow=E.over(seg(p,.84,.98)), w=lerp(S,26,grow), h=lerp(S,360,grow);
    if(p>.84) put(sq,hs.x+S/2-w/2,AX-h/2,w,h); else putSquash(sq,hs.x,y+S,S,hs.imp);
    const part=E.over(seg(p,.8,.95));
    bars.forEach(b=>{ const tr=seg(p,.62+b.i*.014,.84+b.i*.014), tt=E.over(tr); putS(b.el,lerp(W+80+b.i*70,b.x1,tt)+b.side*70*part-(b.side<0?40:0)*(1-part)-13,AX-b.h/2-110*Math.sin(Math.PI*tr),26,b.h); });   // each bar arrives on an arc
    cap(p);
  };
}},

// 03 · READ ALOUD.  The sentence is a road. It runs past, monumental, and each word crouches, then stretches
// up and speaks as it reaches you, and settles back. The same sentence sits small at the top and speaks in
// step, so you always know where you are. The full stop is the last thing left.
SU3:{init(){
  nav();
  const cap=captions([[.02,.14,'One clear voice, shaped by scale.'],[.86,1.1,'Say less. Mean more.']],{x:1250,y:104,w:620,size:28});
  const G=560, base=830, words=[...SU_LINE,'conversation'];
  const small=typeLine(words,{size:56,left:72,top:170,z:3,dot:false,track:-.03});
  const ln=typeLine(words,{size:G,left:72,top:base-.8695*G,z:10});
  const lr=local(ln), dr=local(ln.dot), S=G*.13, dotRel=dr.x-lr.x+dr.w*.5-S/2;
  const cs=ln.words.map(w=>{ const r=local(w); return {c:r.x-lr.x+r.w/2,w:r.w}; });
  const rule=bar(C.quiet); rule.style.zIndex=4; const mark=bar(C.ink); mark.style.zIndex=11;
  ln.dot.style.opacity=0; const sq=bar(C.red); sq.style.zIndex=30;
  const XR=760, STOP=1240, END=-(dotRel-1100);
  const off=p=>lerp(0,END,E.inOut(seg(p,.03,.84)))-lr.w*E.in(seg(p,.88,1));
  const mwS=spring(.2,.68);
  return p=>{
    const o=off(p);
    ln.style.transform=`translateX(${o}px) skewX(${lean(sec(off,p))*.7}deg)`;
    let best=0, bw=200;
    cs.forEach((c,i)=>{ const x=72+o+c.c, d=Math.abs(x-XR)/(c.w*.55+260); let s=E.house(clamp(1-d)); if(i===7&&p>.8) s=Math.max(s,E.house(seg(p,.78,.86)));
      const pre=x>XR?bump(d-1.12,.2):0;                                 // anticipation: a word crouches just before it speaks
      ln.say(i,s); small.say(i,s);
      ln.words[i].style.transform=`translateY(${-12*s+5*pre}px) scale(${1+.05*s+.03*pre},${1+.12*s-.06*pre})`;   // then stretches up as it speaks
      if(s>best){ best=s; bw=c.w; } });
    const mw=Math.max(0,mwS(bw*best));                                   // the mark overshoots each new width, then settles
    put(mark,XR-mw/2,base+32,mw,4,best>.05?1:0);
    put(rule,0,base+40,W*E.house(seg(p,.02,.2)),1.5);
    const hs=halt(72+o+dotRel,STOP); putSquash(sq,hs.x,base,S,hs.imp);
    cap(p);
  };
}},

// 04 · THREE SCALES.  The sentence on three layers, far, middle and near, each in its own band (they never
// overlap), each moving at the speed of its size. The far one leaves first and lands first; each overshoots
// and settles so the three full stops stand in one line. Then "conversation" speaks on all three, in turn.
SU4:{init(){
  nav();
  const cap=captions([[.03,.36,'Different perspectives.'],[.62,1.1,'One conversation.']],{x:1250,y:104,w:620,size:28});
  const far=typeLine([...SU_LINE,'conversation'],{size:56,left:72,top:150,z:6,track:-.03});
  const mid=typeLine(['the','whole','conversation'],{size:240,left:72,top:432-.8695*240,z:8,color:C.tan});
  const near=typeLine(['conversation'],{size:820,left:40,top:1090-.8695*820,z:12,color:C.quiet});
  [far,mid,near].forEach(el=>{ el.dot.style.display='inline-block'; el.dot.style.transformOrigin='50% 85%'; });
  const XA=1560, L=[[far,.04,.6],[mid,.07,.64],[near,.1,.68]].map(([el,a,b])=>{ const r=local(el), d=local(el.dot); return {el,x0:r.x,dot:d.x+d.w*.5-r.x,a,b}; });
  L.forEach(l=>{ l.D=Math.max(0,l.x0+l.dot-XA); });
  return p=>{
    L.forEach((l,i)=>{ const f=pp=>-l.D*E.backOver(seg(pp,l.a,l.b));    // anticipation, travel, overshoot, settle
      l.el.style.transform=`translateX(${f(p)}px) skewX(${lean(sec(f,p))*(l.el===far?0:1)}deg)`;
      l.el.say(l.el.words.length-1,E.house(seg(p,.62+i*.04,.72+i*.04)));   // speaks far, then middle, then near
      const k=Math.sin(Math.PI*seg(p,.66+i*.04,.74+i*.04)); l.el.dot.style.transform=`scale(${1+.6*k})`; });   // and each full stop pops as it does
    cap(p);
  };
}},

// 05 · INTO THE O.  You dive into the sentence. The other words fly past you, the nearest fastest. The
// last "o" of "conversation" opens around you, and inside it is the same word as a signal: in Morse an O
// is three dashes. The rest of the word keys on outward from it, whole units at a time, and the full stop lands.
SU5:{init(){
  nav(); const hl=headline(); const F=floatWords(hl);
  const cap=captions([[.03,.22,'One clear voice, shaped by scale.'],[.7,1.1,'The rhythm becomes the message.']],{plate:true});
  const c=F.words[7], tn=c.el.firstChild.firstChild, rg=document.createRange(); rg.setStart(tn,10); rg.setEnd(tn,11);
  const sr=stage.getBoundingClientRect(), k=sr.width/W, orc=rg.getBoundingClientRect();
  const ox=(orc.left-sr.left)/k+(orc.width/k)/2, oy=c.r.y+.8895*F.fs-.517*F.fs/2;
  const D=[2.1,1.95,1.8,1.7,1.6,1.45,1.3];
  const R=mrow('CONVERSATION',{col:C.ink,red:true});
  const O=R.runs.filter(q=>q.li===10), oc=(O[0].x+O[2].x+O[2].l)/2;     // the last O: three dashes
  R.x0=snap(960-oc*U,U); R.y=540;
  // inside the o you are close: the signal row is set at twice the size, around the centre of the screen
  const grp=document.createElement('div'); grp.style.cssText='position:absolute;inset:0;transform-origin:960px 540px;transform:scale(2);z-index:4'; stage.appendChild(grp);
  R.runs.forEach(q=>grp.appendChild(q.el));
  return p=>{
    F.say(7,E.house(seg(p,.03,.14)));
    const t5=seg(p,.14,.76), go=E.inOut(t5)-.03*ant(t5,.2), S=Math.exp(Math.log(90)*go);   // anticipation: the sentence draws back, then you dive
    const m=E.inOut(seg(p,.14,.5)), tx=lerp(ox,960,m), ty=lerp(oy,540,m)-130*Math.sin(Math.PI*m);   // on an arc
    F.words.forEach((w,i)=>{ const sc=Math.pow(S,i===7?1:D[i]); w.el.style.transform=`translate(${tx+(w.r.x-ox)*sc-w.r.x}px,${ty+(w.r.y-oy)*sc-w.r.y}px) scale(${sc})`; });
    F.dot.el.style.transform=`translate(${tx+(F.dot.r.x-ox)*S-F.dot.r.x}px,${ty+(F.dot.r.y-oy)*S-F.dot.r.y}px) scale(${S})`;
    // inside: the O's three dashes first, then the word keys on outward from them, one unit per step
    const inside=p>.66, Fr=Math.floor(E.inOut(seg(p,.7,.94))*110);
    R.runs.forEach(q=>{ if(!inside){ sg(q,0,0,0); return; }
      if(q.red){ sg(q,R.x0+q.x*U,R.y,p>.95?1:0); return; }
      const a=Math.max(q.x,Math.ceil(oc-4-Fr)), b=Math.min(q.x+q.l,Math.floor(oc+4+Fr));
      sg(q,R.x0+a*U,R.y,q.li===10?q.l:Math.max(0,b-a)); });
    cap(p);
  };
}},

// LINE OF SIGHT, AS IN THE DECK.  The Round 6 frames, exactly, now scrubbed by scroll: you move forward
// through the brand's four statement and reply rows, every dash at its own depth. From far away a loose
// cluster; moving in, the near ones grow fastest; at one point they lock into the rows, running past both
// edges, one red dash where the reply meets (held); keep going and you pass through. Nothing is added.
LS0:{init(){
  nav();
  const K=1.92*1920/2000, DX=-300, VX0=960, VY0=560;
  const ROWS=[[RH.statementA,330,'ink'],[RH.replyA,500,'tan'],[RH.statementB,670,'ink'],[RH.replyB,840,'tan']];
  const rnd=(s=>()=>{s=(s*16807)%2147483647;return (s-1)/2147483646;})(7), P=[];
  ROWS.forEach(([segs,y,c])=>[0,1].forEach(rep=>segs.forEach(([sx,w])=>P.push({x:DX+(sx-100)*K+rep*1290*K,y,w:w*K,h:16*K*1.15,c,z:.16+Math.pow(rnd(),1.3)*3.1}))));
  let best=null; P.filter(q=>q.c==='tan'&&q.y===500).forEach(q=>{ if(!best||Math.abs(q.x+q.w/2-1080)<Math.abs(best.x+best.w/2-1080)) best=q; }); best.c='sig'; best.z=1.2;
  P.forEach(q=>q.el=bar(q.c==='ink'?C.ink:q.c==='tan'?C.tan:C.red));
  P.slice().sort((a,b)=>b.z-a.z).forEach((q,i)=>q.el.style.zIndex=10+i);   // far ones first, near ones over them
  // the deck's frames are the keys: c -2.6 far, -1.15 moving in, -.3 nearly, 0 the point (held), .34 and .9 through
  const cam=p=> p<.5 ? lerp(-2.6,0,E.house(seg(p,.03,.5))) : p<.66 ? 0 : lerp(0,.9,E.in(seg(p,.66,.98)));
  return p=>{ const c=cam(p);
    P.forEach(q=>{ if(q.z<=c+.002){ put(q.el,0,0,0,0); return; }
      const r=q.z/(q.z-c), x=VX0+(q.x-VX0)*r, y=VY0+(q.y-VY0)*r, w=q.w*r, h=q.h*r;
      if(x>1960||x+w<-40||y>1120||y+h<-40){ put(q.el,0,0,0,0); return; }
      put(q.el,x,y-h/2,w,h); }); };
}},

// 06 · UNISON.  Six rows of the same word, CONVERSATION in Morse, out of time with each other and
// running like belts in opposite directions as you scroll. One by one each row steps into time:
// big steps, then smaller, one unit back first and one unit past at the end. In unison, every row's
// pause lines up into one clear aisle, and the red full stop lands in it.
LS1:{init(){
  nav();
  const cap=captions([[.04,.36,'Different perspectives.'],[.36,.68,'One conversation.'],[.68,1.1,'Leave space to respond.']],{plate:true});
  const base=morse('CONVERSATION'), P=base.len+7, AISLE=1060, X0=AISLE-base.len*U;
  const offs=[0,23,-31,41,-17,29], ys=[290,390,490,590,690,790];
  const rows=ys.map((y,ri)=>{ const col=ri%2?C.tan:C.ink, runs=[];
    [-2,-1,0,1].forEach(k=>base.runs.forEach(r=>runs.push({x:k*P+r.x,l:r.l,el:mk(col)}))); return {y,runs,off:offs[ri],dir:ri%2?-1:1}; });
  const red=mk(C.red,14);
  return p=>{
    rows.forEach((r,ri)=>{
      const a=.05+Math.max(0,ri-1)*.1, b=a+.15;
      const drift=pp=>r.off+r.dir*Math.round(Math.min(pp,a)*70);           // out of time, running as a belt until its turn
      const d= ri===0?0 : p<a ? drift(p) : stepTo(drift(a),seg(p,a,b),true);
      r.runs.forEach(q=>sg(q,X0+(q.x+d)*U,r.y)); });
    sg({el:red,l:1},AISLE+3*U,490,p>.7?1:0);
    cap(p);
  };
}},

// 07 · OVER TO YOU.  A statement is sent in Morse, like tape past a fixed key: each unit of scroll is one
// unit of time, so a dash takes three times as long as a dot and a pause takes scroll where nothing
// happens. It ends with KN, the telegraph sign for "over to you", and only then does the reply answer.
LS2:{init(){
  nav();
  const KX=1360, ys=[330,430,650,750];
  const R=[mrow('SAY LESS',{col:C.ink,kn:true}),mrow('MEAN MORE',{col:C.tan}),mrow('A STATEMENT',{col:C.ink,kn:true}),mrow('A REPLY',{col:C.tan,red:true})];
  R.forEach((r,i)=>r.y=ys[i]);
  // the schedule: scroll in proportion to Morse time, with real pauses between turns
  const gaps=[0,14,30,22], tot=R.reduce((s,r)=>s+r.len,0)+gaps.reduce((a,b)=>a+b,0); let acc=0;
  R.forEach((r,i)=>{ acc+=gaps[i]; r.a=.04+.86*acc/tot; acc+=r.len; r.b=.04+.86*acc/tot; });
  const cap=captions([[R[0].a,R[0].b+.02,'Say less.'],[R[1].a,R[1].b+.04,'Mean more.'],[R[2].a,R[2].b+.01,'A statement.'],[R[2].b+.01,R[3].a,'A pause.'],[R[3].a,1.1,'A reply.']],{plate:true});
  const key=mk(C.quiet,13);
  return p=>{
    let live=null;
    R.forEach(r=>{ const T=Math.floor(r.len*seg(p,r.a,r.b)+1e-6); if(p>r.a&&p<r.b) live=r;
      r.runs.forEach(q=>sg(q,KX+(q.x-T)*U,r.y,clamp(T-q.x,0,q.l))); });
    if(live) put(key,KX+4,live.y-16,2,32,1); else put(key,0,0,0,0);
    cap(p);
  };
}},

// 08 · ME TO WE.  Rows of ME in Morse (two dashes, a dot). The red dot keys on in front of one M, and in
// Morse a dot and an M make a W: ME becomes WE. The line makes room, the words beside it stepping out two
// units in a ripple, and the change spreads word by word, row by row, until the whole field says WE.
LS3:{init(){
  nav();
  const cap=captions([[.04,.18,'Every conversation has a rhythm.'],[.18,.46,'The accent is discovered, never announced.'],[.5,1.1,'Relationships create the conversation.']],{plate:true});
  const N=11, K0=5, RC=2, ys=[340,440,540,640,740], ph=[-7,4,0,-4,7];
  const X0=snap(960-(K0*18+5)*U,U);
  const rows=ys.map((y,ri)=>{ const col=ri%2?C.tan:C.ink;
    const words=[...Array(N)].map((_,i)=>({i,dot:mk(ri===RC&&i===K0?C.red:col,ri===RC&&i===K0?14:10),m1:mk(col),m2:mk(col),e:mk(col),
      t:ri===RC&&i===K0?.2:ri===RC?.27+Math.abs(i-K0)*.022:.36+Math.abs(ri-RC)*.08+Math.abs(i-K0)*.022}));
    return {y,words,ph:ph[ri]}; });
  const DL=.007;
  return p=>{
    rows.forEach(r=>{
      r.words.forEach(w=>{
        let sh=0;      // how far this word has been pushed, in units, by changes beside it (arriving as a ripple)
        r.words.forEach(j=>{ const at=j.t+Math.abs(w.i-j.i)*DL; if(p<at) return; const v=p<at+.006?3:2;   // one unit past, then back
          if(j.i>=K0&&w.i>j.i) sh+=v; if(j.i<K0&&w.i<j.i) sh-=v; });
        const on=p>=w.t, bx=X0+(w.i*18+r.ph+sh)*U, inner=on&&w.i>=K0?2:0;
        sg({el:w.dot,l:1},w.i>=K0?bx:bx-2*U,r.y,on?1:0);
        sg({el:w.m1,l:3},bx+inner*U,r.y); sg({el:w.m2,l:3},bx+(inner+4)*U,r.y); sg({el:w.e,l:1},bx+(inner+10)*U,r.y);
      }); });
    cap(p);
  };
}},

// 09 · LINES.  The line in Morse, but every signal starts as a single dot. Scroll and each one grows,
// a unit at a time, until the gaps close and the rows are four clean lines. Then the pauses open again,
// left to right, unit by unit, and the lines become the message, ending on the red full stop.
LS4:{init(){
  nav();
  const cap=captions([[.04,.36,'Every conversation has a rhythm.'],[.4,.74,'Leave space to respond.'],[.74,1.1,'The rhythm becomes the message.']],{plate:true});
  const R=heroRows();
  R.forEach(r=>r.runs.forEach((q,j)=>{ const nx=r.runs[j+1]; q.Lmax=nx?nx.x-q.x:q.l; }));
  return p=>{
    R.forEach((r,ri)=>{
      const g=Math.floor(E.inOut(seg(p,.04+ri*.04,.26+ri*.04))*8);      // phase one: each dot grows into the gap
      const Fr=r.len*E.inOut(seg(p,.44+ri*.08,.66+ri*.08));              // phase two: the pauses open, left to right
      r.runs.forEach(q=>{ let l=Math.min(1+g,q.Lmax);
        if(Fr>0) l=Fr>=q.x+q.Lmax?q.l:Fr>q.x+q.l?Math.max(q.l,Math.ceil(q.Lmax-(Fr-q.x-q.l))):Math.max(l,q.Lmax);
        if(q.red) l=1;
        sg(q,r.x0+q.x*U,r.y,l); }); });
    cap(p);
  };
}},

// 10 · GATHER.  The signals start scattered across the grid as single units, with the red full stop
// already in place. Nearest first, each one steps home across the grid, along then down, never on a
// diagonal: one unit back, the move, one unit past, settle. Once home its tail follows, growing to its
// length. Many become one conversation, gathered around the one red dot.
LS5:{init(){
  nav();
  const cap=captions([[.04,.3,'Every detail speaks.'],[.3,.7,'Relationships create the conversation.'],[.7,1.1,'Close enough to feel in-house.']],{plate:true});
  const R=heroRows(), all=R.flatMap(r=>r.runs.map(q=>({q,r}))), rnd=(s=>()=>{s=(s*16807)%2147483647;return (s-1)/2147483646;})(17);
  const red=all.find(o=>o.q.red);
  all.forEach(o=>{ o.hx=o.r.x0+o.q.x*U; o.hy=o.r.y; });
  all.forEach(o=>{
    o.sx=snap(160+rnd()*1600,U); o.sy=snap(220+rnd()*620,U);
    if(o.q.red){ o.sx=o.hx; o.sy=o.hy; }
    o.d=Math.abs(o.hx-red.hx)/U+Math.abs(o.hy-red.hy)/U*1.5; });
  const md=Math.max(...all.map(o=>o.d));
  return p=>{
    all.forEach(o=>{
      const a=.05+.55*(o.d/md), t=seg(p,a,a+.14), tl=seg(p,a+.14,a+.2);
      const DX=Math.round((o.sx-o.hx)/U), DY=Math.round((o.sy-o.hy)/U);
      const tx=seg(t,0,.55), ty=seg(t,.45,1);                          // along first, then down
      const x=o.hx+stepTo(DX,tx)*U, y=o.hy+stepTo(DY,ty)*U;
      sg(o.q,x,y,o.q.red?1:1+Math.floor((o.q.l-1)*tl));
    });
    cap(p);
  };
}},

// ---- Waveform studies (from Round 6): if one presence enters the composition, can it change the whole
// thing? The bar wall from the brand book, heights never change (so it never reads as an equaliser), and
// the presence is the headline's own red full stop. It steps out of the sentence and into the row.
W1:{init(){
  const cap=captions([[.04,.3,'Every conversation has a rhythm.'],[.3,.62,'A statement. A pause. A reply.'],[.62,1.1,'The rhythm becomes the message.']],{plate:true});
  // PACE: the even row regroups into phrases and pauses; the presence lands in the pause
  const groups=[3,2,4,2,3,1,3,3], gap=WP*.5, pause=WP*2.2; let xs=[], x=0, k=0, slot=0;
  groups.forEach((g,gi)=>{ const st=xs.length; for(let j=0;j<g&&k<WN;j++,k++){ xs.push(x); x+=gap; } x+=pause-gap; if(gi===3){ slot=x-pause/2+gap/2; x+=WP*1.4; } });
  while(xs.length<WN){ xs.push(x); x+=gap; }
  const mid=(xs[0]+xs[WN-1])/2; xs=xs.map(v=>snap(v-mid+960,U)); slot=snap(slot-mid+960+WP*.7,U);
  const gi=[]; groups.forEach((g,i)=>{ for(let j=0;j<g;j++) gi.push(i); }); while(gi.length<WN) gi.push(groups.length);
  const S=waveStudy({slot});
  return p=>{
    S.bars.forEach((b,i)=>{ const a=.18+gi[i]*.025, D=Math.round((wbx(i)-xs[i])/U);   // each phrase moves as one, left to right
      wput(b,xs[i]+stepTo(D,seg(p,a,a+.18),true)*U); });
    S.arrive(p,{go:[.5,.72]});
    S.hl.say(4,E.house(seg(p,.7,.78)));
    cap(p);
  };
}},
W2:{init(){
  const cap=captions([[.04,.34,'The accent is discovered, never announced.'],[.38,.72,'Relationships create the conversation.'],[.74,1.1,'One clear voice, shaped by scale.']],{plate:true});
  // GATHER: the presence lands between two bars; then the bars swap places, tallest first, so the tallest
  // stand nearest it and the whole shape centres on it
  const all=[...Array(WN+1).keys()].map(i=>960+(i-WN/2)*WP), own=all.reduce((b,v)=>Math.abs(v-1240)<Math.abs(b-1240)?v:b,all[0]);
  const slots=all.filter(v=>v!==own).sort((a,b)=>Math.abs(a-own)-Math.abs(b-own));
  const order=WH.map((h,i)=>i).sort((a,b)=>WH[b]-WH[a]), to=[], rank=[]; order.forEach((bi,r)=>{ to[bi]=snap(slots[r],U); rank[bi]=r; });
  const S=waveStudy({slot:own});
  return p=>{
    S.bars.forEach((b,i)=>{ const a=.36+rank[i]*.017, D=Math.round((wbx(i)-to[i])/U);
      wput(b,to[i]+stepTo(D,seg(p,a,a+.12),true)*U); });
    S.arrive(p,{go:[.08,.32]});
    S.hl.say(4,E.house(seg(p,.32,.4)));
    cap(p);
  };
}},
W3:{init(){
  const cap=captions([[.04,.28,'Every detail speaks.'],[.28,.7,'One clear voice, shaped by scale.'],[.7,1.1,'Close enough to feel in-house.']],{plate:true});
  // WEIGHT: the same rule as the type. The presence hops along the row, slot by slot, holding at each;
  // the bars beside it turn heavy, the far ones light, in three weights, the nearest first
  const first=9, last=16, WT=[14,44,96];
  const pos=pp=>{ const t=seg(pp,.3,.92)*(last-first); const k=Math.floor(t), f=t-k; return first+k+E.inOut(clamp(f/.35)); };   // hop, then hold
  const px=pp=>wbx(0)+(pos(pp)-.5)*WP;
  const S=waveStudy({slot:px(.3)});
  return p=>{
    S.bars.forEach((b,i)=>{ const lag=p-Math.abs(wbx(i)-px(p))/WP*.004, d=Math.abs(wbx(i)-px(lag))/WP;   // farther bars answer a beat later
      const w=p<.27?WW:d<1.2?WT[2]:d<3.2?WT[1]:WT[0]; wput(b,wbx(i),w); });
    S.arrive(p,{go:[.06,.28],w:18},snap(px(p),U));
    S.hl.say(4,E.house(seg(p,.25,.32)));
    cap(p);
  };
}},
W4:{init(){
  const S=waveStudy({bars:false,slot:960});
  const cap=captions([[.04,.24,'One clear voice, shaped by scale.'],[.56,1.1,'Close enough to feel in-house.']],{plate:true});
  // STEP IN: the presence takes the middle bar's place, then you step into the waveform around it, one
  // scale at a time (a quick move, then a hold, like a railway clock) until the bars are architecture
  const B=WAVE.map((h,i)=>({h:h*1.5,i,el:mk(i===7?C.red:C.ink,i===7?14:10)})), Z=[.46,.62,.84,1.15,1.6,2.3,3.3,4.8,7.2];
  const zoom=pp=>{ const t=seg(pp,.3,.94)*(Z.length-1), k=Math.min(Z.length-2,Math.floor(t)); return lerp(Z[k],Z[k+1],E.inOut(clamp((t-k)/.35))); };
  return p=>{
    const z=zoom(p);
    B.forEach(b=>{ const x0=960+(b.i-7)*WP*.95, x=960+(x0-960)*z, w=WW*.95*z, h=b.h*z;
      if(b.i===7&&p<.25){ put(b.el,0,0,0,0); return; }
      put(b.el,x-w/2,WAX-h/2,w,h); });
    S.arrive(p,{go:[.06,.25],w:WW*.95*.46,h:WAVE[7]*1.5*.46},null,p>=.25);
    S.hl.say(4,E.house(seg(p,.23,.28)));
    // the headline steps away word by word as you step in, so nothing sits over the columns
    S.hl.words.forEach((w,i)=>w.style.visibility=p>.3+i*.012?'hidden':'visible'); S.hl.dot.style.visibility=p>.4?'hidden':'visible';
    cap(p);
  };
}}

};
})();
