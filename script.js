"use strict";

const RE_SETS  = /[x×*]\s*(\d{1,3})\s*$|(\d{1,3})\s*sets?\s*$/i;
const RE_MINSEC= /(\d+)\s*(?:m|min|mins|minute|minutes)\s*(?:(\d+)\s*(?:s|sec|secs|second|seconds)?)?\s*$/i;
const RE_SEC   = /(\d+)\s*(?:s|sec|secs|second|seconds)?\s*$/i;

function parseLine(raw){
  const line = raw.trim();
  if(!line || line.startsWith('#')) return null;
  let rest = line, sets = 1;

  const ms = rest.match(RE_SETS);
  if(ms){ sets = parseInt(ms[1] || ms[2], 10); rest = rest.slice(0, ms.index).trim(); }
  if(!(sets >= 1)) sets = 1;

  let secs = null;
  const mm = rest.match(RE_MINSEC);
  if(mm){
    secs = parseInt(mm[1],10)*60 + (mm[2] ? parseInt(mm[2],10) : 0);
    rest = rest.slice(0, mm.index).trim();
  }else{
    const sm = rest.match(RE_SEC);
    if(sm){ secs = parseInt(sm[1],10); rest = rest.slice(0, sm.index).trim(); }
  }
  rest = rest.replace(/[\s\-–—:,]+$/,'').trim();

  if(secs === null || secs <= 0) return {error:true, text:line, why:'no duration'};
  if(!rest)                      return {error:true, text:line, why:'no name'};
  if(secs > 3600)                return {error:true, text:line, why:'over an hour'};
  return {name:rest, secs, sets};
}
const parseRoutine = t => t.split(/\r?\n/).map(parseLine).filter(Boolean);

const fmt = s => { s=Math.max(0,Math.round(s)); const m=Math.floor(s/60);
                   return m ? m+':'+String(s%60).padStart(2,'0') : String(s); };
const fmtLong = s => { s=Math.max(0,Math.round(s));
                       return Math.floor(s/60)+':'+String(s%60).padStart(2,'0'); };

const REST = 3, LEADIN = 3;
const $ = id => document.getElementById(id);
const elSrc=$('src'), elName=$('wname');

const EXAMPLE =
`Bicycle crunches 30s x 4
Hollow hold 30s x 2
Leg lifts 30s x 2
Flutter kicks 30s x 2
Plank knee taps 1m x 2
Mountain climbers 45s x 2
Scissor kicks 45s x 2`;

const esc = s => String(s).replace(/[&<>"']/g, c =>
  ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));

let items = [];

function render(){
  items = parseRoutine(elSrc.value);
  const box = $('parsed');
  box.innerHTML = '';
  if(!items.length){
    box.innerHTML = '<div class="prow"><span class="nm" style="opacity:.5">EMPTY</span><span></span><span></span></div>';
  }
  for(const it of items){
    const d = document.createElement('div');
    d.className = it.error ? 'prow bad' : 'prow';
    d.innerHTML = it.error
      ? `<span class="nm">"${esc(it.text)}" &#8212; ${esc(it.why)}</span><span></span><span></span>`
      : `<span class="nm">${esc(it.name)}</span><span class="du">${fmt(it.secs)}</span><span class="st">&#215;${it.sets}</span>`;
    box.appendChild(d);
  }
  const good = items.filter(i => !i.error);
  const n = good.reduce((a,i) => a + i.sets, 0);
  const work = good.reduce((a,i) => a + i.secs * i.sets, 0);
  $('total').textContent = fmtLong(n ? work + LEADIN + (n-1)*REST : 0);
  $('go').disabled = n === 0;
  $('go').textContent = n ? `START · ${n}` : 'START';
}
elSrc.addEventListener('input', render);
$('demo').addEventListener('click', () => {
  elSrc.value = EXAMPLE;
  if(!elName.value.trim()) elName.value = 'Abs workout';
  render();
});

const KEY='interval.nso.routines', LAST='interval.nso.last', TKEY='interval.nso.theme';
const readStore = () => { try{ return JSON.parse(localStorage.getItem(KEY)) || {}; }catch(e){ return {}; } };
const writeStore = o => { try{ localStorage.setItem(KEY, JSON.stringify(o)); }catch(e){} };

function paintSaved(){
  const st = readStore(), names = Object.keys(st), wrap = $('saved');
  $('savedwrap').style.display = names.length ? '' : 'none';
  wrap.innerHTML = '';
  for(const n of names){
    const c = document.createElement('span'); c.className='chip';
    const b = document.createElement('button'); b.textContent = n.toUpperCase();
    b.addEventListener('click', () => { elName.value=n; elSrc.value=st[n]; render(); });
    const x = document.createElement('button'); x.className='x'; x.textContent='×';
    x.setAttribute('aria-label','Delete '+n);
    x.addEventListener('click', () => { const s=readStore(); delete s[n]; writeStore(s); paintSaved(); });
    c.append(b,x); wrap.appendChild(c);
  }
}
$('save').addEventListener('click', () => {
  const s = readStore(); s[elName.value.trim() || 'Untitled'] = elSrc.value;
  writeStore(s); paintSaved();
});

function setTheme(t){
  document.documentElement.setAttribute('data-t', t);
  try{ localStorage.setItem(TKEY, t); }catch(e){}
}
$('themeBtn').addEventListener('click', () => {
  setTheme(document.documentElement.getAttribute('data-t') === 'dark' ? 'nso' : 'dark');
});

let ctx = null, audioMode = '';
const live = new Set();

async function initAudio(){
  if(ctx){ if(ctx.state === 'suspended') await ctx.resume(); return; }
  if(navigator.audioSession){
    for(const t of ['transient','ambient']){
      try{ navigator.audioSession.type = t; audioMode = t; break; }catch(e){}
    }
  }
  const AC = window.AudioContext || window.webkitAudioContext;
  ctx = new AC({latencyHint:'interactive'});
  if(ctx.state === 'suspended') await ctx.resume();
  $('aflag').textContent = audioMode === 'transient' ? 'DUCKS MUSIC'
                        : audioMode === 'ambient'   ? 'MIXES' : '';
}

function tone(at, freq, dur, peak, type){
  if(!ctx) return;
  const osc = ctx.createOscillator(), g = ctx.createGain();
  osc.type = type; osc.frequency.setValueAtTime(freq, at);
  g.gain.setValueAtTime(0.0001, at);
  g.gain.exponentialRampToValueAtTime(peak, at + 0.008);
  g.gain.exponentialRampToValueAtTime(0.0001, at + dur);
  osc.connect(g).connect(ctx.destination);
  osc.start(at); osc.stop(at + dur + 0.05);
  live.add(osc); osc.onended = () => live.delete(osc);
}
function stopScheduled(){ for(const o of live){ try{ o.stop(); }catch(e){} } live.clear(); }

const now = () => performance.now() / 1000;

const EDGE = at => { tone(at, 392, 0.30, 0.30, 'square');
                     tone(at, 196, 0.30, 0.13, 'square'); };
const TICK = at =>   tone(at, 1046, 0.07, 0.22, 'square');

let steps=[], idx=0, phaseEndsAt=0, phaseLen=0;
let paused=false, pausedLeft=0, running=false, tick=0, wakeLock=null, lastShown=-1;

function buildSteps(list){
  const out=[], flat=[];
  for(const it of list.filter(i => !i.error))
    for(let s=1; s<=it.sets; s++) flat.push({name:it.name, secs:it.secs, set:s, of:it.sets});
  if(!flat.length) return out;
  out.push({kind:'lead', secs:LEADIN, name:'GET READY', next:flat[0]});
  flat.forEach((f,i) => {
    out.push({kind:'work', secs:f.secs, name:f.name, set:f.set, of:f.of, next:flat[i+1]||null});
    if(i < flat.length-1) out.push({kind:'rest', secs:REST, name:'REST', next:flat[i+1]});
  });
  out.push({kind:'end', secs:0, name:'DONE', next:null});
  return out;
}

const SVGNS='http://www.w3.org/2000/svg';
let ringCircle=null, ringCirc=2*Math.PI*43;
function buildRing(n){
  if(ringCircle) return;
  ringCircle=$('ringProgress');
  ringCircle.style.strokeDasharray=ringCirc.toFixed(2);
  ringCircle.style.strokeDashoffset='0';
}
function paintRing(frac){
  if(!ringCircle) buildRing(0);
  const f=Math.max(0,Math.min(1,frac));
  ringCircle.style.strokeDasharray=ringCirc.toFixed(2);
  ringCircle.style.strokeDashoffset=(ringCirc*(1-f)).toFixed(2);
}

async function start(){
  steps = buildSteps(parseRoutine(elSrc.value));
  if(steps.length < 2) return;

  $('rWorkout').textContent = (elName.value.trim() || 'WORKOUT').toUpperCase();
  $('tbTitle').textContent = 'RUNNING';
  try{ localStorage.setItem(LAST, JSON.stringify({n:elName.value, s:elSrc.value})); }catch(e){}
  $('editor').classList.remove('on');
  $('runner').classList.add('on');
  $('runner').classList.remove('done');
  $('cPause').textContent = 'Pause';

  try{
    await Promise.race([initAudio(), new Promise(r => setTimeout(r, 1500))]);
  }catch(e){ }
  if(!ctx) $('aflag').textContent = 'NO AUDIO';

  await requestWake();
  idx = -1; paused = false; running = true;
  advance(); startLoop();
}

function advance(){
  idx++;
  if(idx >= steps.length || steps[idx].kind === 'end'){ finish(); return; }
  const s = steps[idx];
  phaseLen = s.secs;
  phaseEndsAt = now() + s.secs;
  lastShown = -1;
  buildRing(s.secs);
  schedule(s, s.secs);
  paint(s);

  lastShown = s.secs;
  $('digits').textContent = s.secs >= 60 ? fmt(s.secs) : s.secs;
  paintRing(1);
}

function schedule(s, left){
  if(!ctx || s.kind === 'rest') return;
  const t0 = ctx.currentTime, T = s.secs, elapsed = T - left;

  const at = off => {
    const t = t0 + (off - elapsed);
    if(t < t0 - 0.001) return null;
    return Math.max(t, t0 + 0.015);
  };

  let t;
  if(elapsed < 0.05 && (t = at(0)) !== null) EDGE(t);
  if(T - 3 > 0 && (t = at(T - 3)) !== null) TICK(t);
  if(T - 2 > 0 && (t = at(T - 2)) !== null) TICK(t);
  if(T - 1 > 0 && (t = at(T - 1)) !== null) EDGE(t);
}

function paint(s){
  const w = $('dialwrap');
  w.classList.toggle('rest', s.kind !== 'work');
  $('rCur').textContent = s.name;
  const nx = s.next;
  $('rNxt').textContent = nx ? nx.name : 'FINISH';
  $('rSet').textContent = (s.kind === 'work' && s.of > 1) ? `SET ${s.set} / ${s.of}` : '';
}

function startLoop(){ clearInterval(tick); tick = setInterval(step, 100); }
function stopLoop(){ clearInterval(tick); tick = 0; }

function step(){
  if(!running || paused) return;
  const left = phaseEndsAt - now();
  if(left <= 0){ advance(); return; }

  const shown = Math.ceil(left);
  if(shown !== lastShown){
    lastShown = shown;
    $('digits').textContent = phaseLen >= 60 ? fmt(shown) : shown;
    if(steps[idx].kind === 'work' && shown <= 3) pulse();
  }
  paintRing(phaseLen ? left/phaseLen : 0);

  let done=0, all=0;
  for(let i=0;i<steps.length;i++){
    if(steps[i].kind === 'end') continue;
    all += steps[i].secs;
    if(i < idx) done += steps[i].secs;
    else if(i === idx) done += phaseLen - Math.max(0,left);
  }
  $('bar').style.width = (all ? done/all*100 : 0) + '%';
}

let pt=0;
function pulse(){
  const w=$('dialwrap');
  w.classList.remove('pulse'); void w.offsetWidth; w.classList.add('pulse');
  clearTimeout(pt); pt = setTimeout(() => w.classList.remove('pulse'), 300);
}

function finish(){
  running=false; stopLoop();
  $('runner').classList.add('done');
  $('digits').textContent='✓';
  paintRing(1);
  $('rCur').textContent='COMPLETE';
  $('rNxt').textContent='NICE WORK';
  $('rSet').textContent=''; $('bar').style.width='100%';
  $('cPause').textContent='Done'; $('tbTitle').textContent='COMPLETE';
  releaseWake();
}

function togglePause(){
  if(!running){ quit(); return; }
  paused = !paused;
  $('cPause').textContent = paused ? 'Resume' : 'Pause';
  if(paused){
    pausedLeft = Math.max(0, phaseEndsAt - now());
    stopScheduled();
  }else{
    phaseEndsAt = now() + pausedLeft;
    schedule(steps[idx], pausedLeft);
  }
}
function jump(target){
  stopScheduled();
  paused = false; $('cPause').textContent='Pause';
  idx = target - 1; advance();
}
function skip(){
  if(!running) return;
  let j = idx+1;
  while(j < steps.length && steps[j].kind === 'rest') j++;
  jump(j);
}
function back(){
  if(!running) return;
  const w=[]; for(let i=0;i<steps.length;i++) if(steps[i].kind==='work') w.push(i);
  const pos = w.indexOf(idx);
  let t;
  if(pos > 0) t = w[pos-1];
  else if(pos === 0) t = idx;
  else { t = w.filter(i => i < idx).pop(); if(t === undefined) t = w[0]; }
  jump(t);
}
function quit(){
  running=false; paused=false;
  stopLoop(); stopScheduled(); releaseWake();
  $('cPause').textContent='Pause'; $('tbTitle').textContent='INTERVAL';
  $('runner').classList.remove('on','done');
  $('editor').classList.add('on');
}

$('go').addEventListener('click', start);
$('cPause').addEventListener('click', togglePause);
$('cSkip').addEventListener('click', skip);
$('cBack').addEventListener('click', back);
$('closeBtn').addEventListener('click', () => {
  if($('runner').classList.contains('on')) quit();
});
document.addEventListener('keydown', e => {
  if(!$('runner').classList.contains('on')) return;
  if(e.code==='Space'){ e.preventDefault(); togglePause(); }
  else if(e.code==='ArrowRight') skip();
  else if(e.code==='ArrowLeft') back();
  else if(e.code==='Escape') quit();
});

async function requestWake(){
  try{ if('wakeLock' in navigator) wakeLock = await navigator.wakeLock.request('screen'); }catch(e){}
}
function releaseWake(){ try{ wakeLock && wakeLock.release(); }catch(e){} wakeLock=null; }
document.addEventListener('visibilitychange', async () => {
  if(document.visibilityState !== 'visible') return;
  if(running) await requestWake();
  if(ctx && ctx.state === 'suspended'){ try{ await ctx.resume(); }catch(e){} }
});

(function boot(){
  let t='nso'; try{ t = localStorage.getItem(TKEY) || 'nso'; }catch(e){}
  setTheme(t);
  let last=null; try{ last = JSON.parse(localStorage.getItem(LAST)); }catch(e){}
  if(last && last.s){ elName.value = last.n||''; elSrc.value = last.s; }
  else { elName.value='Abs workout'; elSrc.value = EXAMPLE; }
  render(); paintSaved();
})();

if (location.protocol !== "file:" && "serviceWorker" in navigator) window.addEventListener("load", () => navigator.serviceWorker.register("./sw.js"));