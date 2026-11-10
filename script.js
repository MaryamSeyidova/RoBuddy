'use strict';
/* RoBuddy v3 – Pou-style buddy that makes you finish 3 tasks a day.
   Test fast: open index.html?fast  (1 "minute" = 6 seconds, break zone = 18 s) */

const $ = s => document.querySelector(s), $$ = s => [...document.querySelectorAll(s)];
if (location.search.includes('fast')) localStorage.setItem('rb-fast', '1');
if (location.search.includes('slow')) localStorage.removeItem('rb-fast');
const FAST = localStorage.getItem('rb-fast') === '1';
const DEFAULT_BREAK = 'break.html';
const VISION_ENDPOINT = '';                 // optional: your server that judges photos → {ok:boolean, comment:string}
const BW = 200, BH = 250, TASKS_PER_DAY = 3;

/* ---------- content ---------- */
const TASKS = [
  {t:'Open your project', min:1, s:['Open the file you need.','Do not edit yet.','Look at it for five minutes.']},
  {t:'Improve one tiny detail', min:1, s:['Pick one small detail.','Make it better.','Save your work.']},
  {t:'Learn one useful thing', min:1, s:['Find one short tutorial.','Learn one idea only.','Write it in one sentence.']},
  {t:'Make a rough first draft', min:1, s:['Start a timer-free sketch.','Do not judge it.','Save it as draft one.']},
  {t:'Reset your workspace', min:1, s:['Put five things away.','Close five tabs.','Keep only what you need.']},
  {t:'Collect three references', min:1, s:['Find three examples.','Save one detail from each.','Write the pattern you see.']},
  {t:'Finish one open loop', min:1, s:['Pick something almost done.','Remove the last obstacle.','Mark it complete.']},
  {t:'Practice out loud', min:1, s:['Pick one idea or pitch.','Say it out loud once.','Say it again, a bit better.']}
];
const PENALTIES = ['Do 10 jumping jacks.','Drink a full glass of water.','Stand up and stretch for 30 seconds.','Put 5 things back where they belong.','Do 10 slow squats.'];
const L = {
  pause:['Pause?! Already?! No.','I did not say you could stop.','The timer is paused. I am not.'],
  nag:['Resume. Now.','I am watching you.','Tick tock. Press resume.'],
  back:['Good. Back to work.','Finally. Continue.','Good. Do not stop again.'],
  early:['No. Too early. You are not done.','Nice try. Keep working.','Finish early? I do not think so.'],
  pass:['Good job. That looks right.','Yes. That is real work. I am proud.','Approved. Nicely done.'],
  sad:['Ow. Why did you drop me?','That hurt. I am sad.','Please be gentle with me.'],
  angry:['WHO DROPPED ME FROM UP THERE?!','That was way too high! I am angry!'],
  giggle:['Hehe, that tickles.','Hey! That is my belly.','Stop it. Okay, do not stop.']
};
const ITEMS = {
  c:[{id:'peach',n:'Peach',v:'#f1d6c1',p:0},{id:'lav',n:'Lavender',v:'#c4b4f2',p:40},{id:'mint',n:'Mint',v:'#a7dfc2',p:40},{id:'blue',n:'Cloud',v:'#9bc8ee',p:50},{id:'pink',n:'Bubblegum',v:'#f7b6d2',p:50},{id:'gold',n:'Honey',v:'#f4d18b',p:60}],
  h:[{id:'none',n:'No hat',v:'',p:0},{id:'bow',n:'Bow',v:'🎀',p:30},{id:'flower',n:'Flower',v:'🌼',p:35},{id:'cap',n:'Cap',v:'🧢',p:40},{id:'crown',n:'Crown',v:'👑',p:50},{id:'top',n:'Top hat',v:'🎩',p:55},{id:'frog',n:'Frog',v:'🐸',p:60},{id:'panda',n:'Panda',v:'🐼',p:60}],
  b:[{id:'none',n:'Plain',v:'',p:0},{id:'heart',n:'Heart',v:'💜',p:40},{id:'star',n:'Star',v:'⭐',p:45},{id:'ramen',n:'Ramen',v:'🍜',p:60},{id:'frog',n:'Frog suit',v:'🐸',p:70},{id:'panda',n:'Panda suit',v:'🐼',p:70}]
};

/* ---------- state ---------- */
const def = {name:'',goal:'',coins:60,own:['c:peach','h:none','b:none'],eq:{c:'peach',h:'none',b:'none'},
  day:'',done:0,phase:'idle',m:-1,left:0,total:0,voice:'',pitch:.7,rate:.95};
let S; try { S = {...def, ...JSON.parse(localStorage.getItem('robuddy-v3') || '{}')}; } catch { S = {...def}; }
const dayKey = () => { const d = new Date(); return `${d.getFullYear()}-${d.getMonth()+1}-${d.getDate()}`; };
if (S.day !== dayKey()) { S.day = dayKey(); S.done = 0; S.phase = 'idle'; S.m = -1; }
const save = () => localStorage.setItem('robuddy-v3', JSON.stringify(S));
const rand = a => a[Math.floor(Math.random() * a.length)];
const wait = ms => new Promise(r => setTimeout(r, ms));
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const vib = p => navigator.vibrate && navigator.vibrate(p);

const app = $('#app'), st = $('#stage'), buddy = $('#buddy');

/* ---------- voice ---------- */
const MALE = /daniel|alex\b|fred|aaron|arthur|oliver|rishi|ralph|google uk english male|microsoft (guy|david|mark|ryan|george|james|christopher|eric|roger|steffan|brian|thomas)|\bmale\b/i;
const FEMALE = /samantha|karen|aria|zira|susan|victoria|moira|tessa|fiona|jenny|google us english|female|hazel|catherine|sonia|libby/i;
const PREFERRED_VOICE = /cellso|celso|cellos/i;
const voices = () => ('speechSynthesis' in window) ? speechSynthesis.getVoices() : [];
function pickVoice() {
  const vs = voices();
  return vs.find(v => v.name === S.voice) ||
    vs.find(v => PREFERRED_VOICE.test(v.name) && /^en-US$/i.test(v.lang)) ||
    vs.find(v => /^en-US$/i.test(v.lang)) ||
    vs.find(v => MALE.test(v.name) && /^en/i.test(v.lang)) ||
    vs.find(v => /^en/i.test(v.lang) && !FEMALE.test(v.name)) || null;
}
let lastText = '';
function speakText(text) {
  lastText = text;
  return new Promise(res => {
    if (!('speechSynthesis' in window)) return setTimeout(res, Math.min(4000, text.length * 55));
    speechSynthesis.cancel();
    const u = new SpeechSynthesisUtterance(text), v = pickVoice();
    if (v) { u.voice = v; u.lang = v.lang; }
    u.pitch = S.pitch; u.rate = S.rate;
    let fin = false; const end = () => { if (!fin) { fin = true; res(); } };
    u.onend = end; u.onerror = end; setTimeout(end, text.length * 90 + 1500);
    speechSynthesis.speak(u);
  });
}
function say(text, mood, ms = 0, speak = true) {
  $('#say').textContent = text; lastText = text;
  if (mood) setMood(mood, ms);
  return speak ? speakText(text) : Promise.resolve();
}
$('#hear').onclick = () => speakText(lastText || $('#say').textContent);

/* ---------- sound effects ---------- */
let AC; const ac = () => AC || (AC = new (window.AudioContext || window.webkitAudioContext)());
function purr(d = 2.3) {
  const c = ac(), t = c.currentTime, o = c.createOscillator(), g = c.createGain(), l = c.createOscillator(), lg = c.createGain(), f = c.createBiquadFilter();
  o.type = 'sawtooth'; o.frequency.value = 52; f.type = 'lowpass'; f.frequency.value = 420;
  l.frequency.value = 25; lg.gain.value = .35; l.connect(lg); lg.connect(g.gain);
  o.connect(f); f.connect(g); g.connect(c.destination);
  g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(.5, t + .3); g.gain.setTargetAtTime(0, t + d - .3, .08);
  o.start(t); l.start(t); o.stop(t + d); l.stop(t + d);
}
function chomp() {
  const c = ac(), t = c.currentTime, o = c.createOscillator(), g = c.createGain();
  o.type = 'square'; o.frequency.setValueAtTime(220, t); o.frequency.exponentialRampToValueAtTime(40, t + .2);
  g.gain.setValueAtTime(.35, t); g.gain.exponentialRampToValueAtTime(.001, t + .22);
  o.connect(g); g.connect(c.destination); o.start(t); o.stop(t + .25);
}

/* ---------- moods ---------- */
const MOODS = ['smile','happy','purr','sad','angry','bite','sleep','think'];
let moodT, paused = false, proving = false;
function baseMood() { return app.dataset.mode === 'night' ? 'sleep' : (S.phase === 'task' && paused && !proving) ? 'angry' : 'smile'; }
function setMood(m, ms = 0) {
  buddy.classList.remove(...MOODS.map(x => 'm-' + x)); buddy.classList.add('m-' + m);
  clearTimeout(moodT); if (ms) moodT = setTimeout(() => setMood(baseMood()), ms);
}

/* ---------- 3D buddy: drag, fall, react ---------- */
const P = {x:0, y:0, vx:0, vy:0, s:1, drag:false, W:300, H:400, foot:0, fromH:0};
const ground = () => P.foot - 232 * P.s;
function layout(snap = true) {
  const r = st.getBoundingClientRect(), W = r.width, H = r.height, mode = app.dataset.mode;
  const fl = Math.round(H * .2); st.style.setProperty('--floorH', fl + 'px');
  const avail = H - fl + 20; P.W = W; P.H = H;
  P.s = mode === 'task' ? Math.min(W * .44 / BW, avail * .62 / BH) : mode === 'shop' ? Math.min(W * .6 / BW, avail * .8 / BH) : Math.min(W * .7 / BW, avail * .85 / BH);
  P.foot = mode === 'task' ? H - fl + 26 : H - fl * .5;
  if (snap) { P.x = mode === 'task' ? 4 : (W - BW * P.s) / 2; P.y = ground(); P.vx = P.vy = 0; }
}
let lt = 0;
function loop(t) {
  const dt = Math.min(.033, (t - lt) / 1000 || .016); lt = t;
  if (!P.drag) {
    const g = ground();
    if (P.y < g - .5 || P.vy < 0) {
      P.vy += 2600 * dt; P.y += P.vy * dt; P.x += P.vx * dt; P.vx *= .985;
      const mx = P.W - BW * P.s; if (P.x < 0) { P.x = 0; P.vx *= -.5; } if (P.x > mx) { P.x = mx; P.vx *= -.5; }
      if (P.y >= g) { P.y = g; impact(); }
    }
  }
  buddy.style.transform = `translate3d(${P.x}px,${P.y}px,0) scale(${P.s})`;
  requestAnimationFrame(loop);
}
function impact() {
  const v = P.vy, h = P.fromH;
  if (h > 140) { P.fromH = 0; react(h); }
  if (v > 650) P.vy = -v * .28;
  else { P.vy = 0; P.vx = 0; buddy.classList.add('idle'); }
}
function react(h) {
  vib(h > 330 ? [120, 60, 120] : 120);
  if (h > 330) say(rand(L.angry), 'angry', 2800); else say(rand(L.sad), 'sad', 2800);
}
let dr = null;
buddy.addEventListener('pointerdown', e => {
  buddy.setPointerCapture(e.pointerId);
  const r = st.getBoundingClientRect(), n = performance.now();
  dr = {ox:e.clientX - r.left - P.x, oy:e.clientY - r.top - P.y, sx:e.clientX, sy:e.clientY, lx:e.clientX, ly:e.clientY, lt:n, vx:0, vy:0, moved:false, target:e.target};
});
buddy.addEventListener('pointermove', e => {
  if (!dr) return;
  if (!dr.moved && Math.hypot(e.clientX - dr.sx, e.clientY - dr.sy) > 10) { dr.moved = true; P.drag = true; P.vy = 0; buddy.classList.add('drag'); buddy.classList.remove('idle'); }
  if (!dr.moved) return;
  const r = st.getBoundingClientRect(), n = performance.now(), dt = Math.max(1, n - dr.lt);
  dr.vx = (e.clientX - dr.lx) / dt * 1000; dr.vy = (e.clientY - dr.ly) / dt * 1000; dr.lx = e.clientX; dr.ly = e.clientY; dr.lt = n;
  P.x = clamp(e.clientX - r.left - dr.ox, -10, P.W - BW * P.s + 10);
  P.y = clamp(e.clientY - r.top - dr.oy, -30, ground());
  buddy.style.setProperty('--ry', clamp(dr.vx * .04, -35, 35) + 'deg');
  buddy.style.setProperty('--rx', clamp(-dr.vy * .03, -30, 30) + 'deg');
  const high = ground() - P.y > 150;
  if (high && !buddy.classList.contains('m-sad')) setMood('sad');
  if (!high && buddy.classList.contains('m-sad')) setMood(baseMood());
});
function release() {
  if (!dr) return; const d = dr; dr = null; buddy.classList.remove('drag');
  if (!d.moved) return tap(d.target);
  P.drag = false; P.vx = clamp(d.vx * .4, -500, 500); P.vy = 0; P.fromH = ground() - P.y;
  buddy.style.setProperty('--rx', '0deg'); buddy.style.setProperty('--ry', '0deg');
  if (P.fromH < 20) buddy.classList.add('idle');
}
buddy.addEventListener('pointerup', release); buddy.addEventListener('pointercancel', release);

/* ---------- tap: face → purr → bite → "time for task" ---------- */
let busy = false;
function tap(t) {
  const mode = app.dataset.mode;
  if (t.closest('.face')) {
    if (mode === 'home') return faceBite();
    if (mode === 'task') { vib(60); return void say('Focus. Do not poke me.', 'angry', 1600); }
    if (mode === 'night') return void say('Zzz… shh.', 'sleep');
  }
  vib(20); say(rand(L.giggle), 'happy', 1400);
}
async function faceBite() {
  if (busy) return; busy = true;
  setMood('purr'); purr(2.3); vib([30, 40, 30, 40, 30, 40, 30]);
  $('#say').textContent = 'Purrrrr…';
  await wait(2300);
  setMood('bite'); chomp(); vib(220);
  $('#say').textContent = 'It is time for task!';
  await Promise.all([speakText('It is time for task!'), wait(1500)]);
  setMood('smile');
  await say(S.done === 0 ? 'Press start. I will tell you what to do.' : 'Press the button. Next task.', 'smile');
  $('#start').classList.add('pulse'); busy = false;
}

/* ---------- modes ---------- */
function setMode(m) {
  app.dataset.mode = m;
  $$('#nav button').forEach(b => b.classList.toggle('on', b.dataset.m === (m === 'night' ? 'home' : m)));
  if (m !== 'shop') { pv = {}; refreshLook(); } else buildShop();
  setMood(baseMood()); buddy.classList.add('idle'); layout(true);
}
const homeMode = () => (S.done >= TASKS_PER_DAY && S.phase !== 'break') ? 'night' : 'home';
function setHome() {
  setMode(homeMode());
  $('#start').textContent = S.done === 0 ? 'Start task' : `Start task ${S.done + 1} of ${TASKS_PER_DAY}`;
  if (app.dataset.mode === 'home') say(S.done === 0 ? `Hi ${S.name}! Tap my face.` : `${S.done} of ${TASKS_PER_DAY} done. Keep going, ${S.name}.`, null, 0, false);
}
$$('#nav button').forEach(b => b.onclick = () => b.dataset.m === 'shop' ? (setMode('shop'), say('Pick something. Tap an item to try it on.', 'happy', 1500, false)) : setHome());

/* ---------- task + timer ---------- */
let tick = 0, nag = 0, leaving = false, away = false;
const thresh = () => FAST ? S.total * .15 : Math.max(S.total * .15, 60);
function renderTask() {
  const T = TASKS[S.m];
  $('#tTitle').textContent = T.t;
  $('#tSteps').innerHTML = T.s.map(x => `<li>${x}</li>`).join('');
  $('#tMeta').textContent = `Task ${S.done + 1} of ${TASKS_PER_DAY} · +20 ✦`;
}
function paintTimer() {
  const m = String(Math.floor(S.left / 60)).padStart(2, '0'), s = String(S.left % 60).padStart(2, '0');
  $('#clock').textContent = `${m}:${s}`; $('#bar').style.width = (S.total ? S.left / S.total * 100 : 0) + '%';
  $('#finish').classList.toggle('pulse', S.left <= Math.ceil(thresh()));
}
function runTimer() {
  clearInterval(tick); clearInterval(nag); paused = false; proving = false;
  $('#pause').textContent = '⏸ Pause'; paintTimer();
  tick = setInterval(() => {
    if (S.left > 0) { S.left--; paintTimer(); if (S.left % 5 === 0) save(); }
    else { clearInterval(tick); save(); say(`Time is up, ${S.name}. Press finish and prove it.`, 'happy', 2500); }
  }, 1000);
}
async function startTask() {
  if (S.done >= TASKS_PER_DAY) return;
  goFull();
  let i; do { i = Math.floor(Math.random() * TASKS.length); } while (i === S.m);
  S.m = i; const T = TASKS[i];
  S.total = S.left = Math.round(T.min * (FAST ? 6 : 60)); S.phase = 'task'; save();
  $('#start').classList.remove('pulse');
  renderTask(); setMode('task'); runTimer();
  history.pushState(null, '', location.href);
  say(`Task ${S.done + 1}. ${T.t}. ${T.min} minutes. ${T.s[0]}`, 'smile');
}
$('#start').onclick = startTask;
function pauseResume() {
  if (S.phase !== 'task' || proving) return;
  if (!paused) {
    paused = true; clearInterval(tick); $('#pause').textContent = '▶ Resume';
    say(rand(L.pause), 'angry'); vib([100, 50, 100]);
    nag = setInterval(() => say(rand(L.nag), 'angry'), 9000);
  } else { say(rand(L.back), 'smile', 0); runTimer(); }
}
$('#pause').onclick = pauseResume;
function onFinish() {
  if (S.phase !== 'task') return;
  if (paused) return void say('Resume the timer first.', 'angry', 2000);
  if (S.left > Math.ceil(thresh())) { vib([80, 40, 80]); return void say(rand(L.early), 'angry', 2600); }
  openProof();
}
$('#finish').onclick = onFinish;

/* ---------- proof: camera photo, buddy judges ---------- */
let stream = null, lastPx = null;
const stopCam = () => { stream && stream.getTracks().forEach(t => t.stop()); stream = null; };
async function openProof() {
  clearInterval(tick); proving = true;
  $('#cam').classList.remove('shot'); $('#pSnap').disabled = false; $('#pSnap').textContent = '📸 Take picture';
  $('#pHint').textContent = `Show me: ${TASKS[S.m].t}.`;
  $('#proof').showModal(); say('Show me the finished task. Take a picture.', 'think');
  try {
    stream = await navigator.mediaDevices.getUserMedia({video:{facingMode:'environment'}, audio:false});
    $('#vid').srcObject = stream; await $('#vid').play();
  } catch { stream = null; $('#pHint').textContent = 'Camera blocked. Use your phone camera instead.'; }
}
$('#pSnap').onclick = () => {
  if (!stream) return $('#file').click();
  const v = $('#vid'), c = document.createElement('canvas');
  c.width = v.videoWidth || 480; c.height = v.videoHeight || 640; c.getContext('2d').drawImage(v, 0, 0, c.width, c.height);
  judge(c.toDataURL('image/jpeg', .8));
};
$('#file').onchange = e => { const f = e.target.files[0]; if (!f) return; const r = new FileReader(); r.onload = () => judge(r.result); r.readAsDataURL(f); e.target.value = ''; };
$('#pCancel').onclick = () => { $('#proof').close(); stopCam(); say('Back to work. The timer is running.', 'angry', 1800); runTimer(); };
$('#proof').addEventListener('cancel', e => { e.preventDefault(); $('#pCancel').click(); });

function analyse(src) {
  return new Promise(res => {
    const im = new Image(); im.onload = () => {
      const c = $('#work'), x = c.getContext('2d'); x.drawImage(im, 0, 0, 64, 64);
      const d = x.getImageData(0, 0, 64, 64).data, px = []; let s = 0, s2 = 0;
      for (let i = 0; i < d.length; i += 4) { const l = .299 * d[i] + .587 * d[i+1] + .114 * d[i+2]; px.push(l); s += l; s2 += l * l; }
      const n = px.length, m = s / n, sd = Math.sqrt(Math.max(0, s2 / n - m * m)); let diff = 99;
      if (lastPx) { diff = px.reduce((a, v, i) => a + Math.abs(v - lastPx[i]), 0) / n; } lastPx = px; res({m, sd, diff});
    }; im.src = src;
  });
}
async function judge(src) {
  $('#snap').src = src; $('#cam').classList.add('shot'); $('#pSnap').disabled = true; stopCam();
  say('Hmm. Let me look…', 'think');
  const [a] = await Promise.all([analyse(src), wait(1600)]);
  let ok, why = 'I cannot see proof of the task.';
  if (VISION_ENDPOINT) {
    try { const r = await (await fetch(VISION_ENDPOINT, {method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({image:src, task:TASKS[S.m].t})})).json(); ok = !!r.ok; if (r.comment) why = r.comment; }
    catch { ok = undefined; }
  }
  if (ok === undefined) {   // local fallback: only checks the photo is real, lit and not a repeat
    ok = a.m > 35 && a.m < 240 && a.sd > 14 && a.diff > 5;
    why = a.m <= 35 ? 'That picture is too dark. I cannot see your work.' : a.sd <= 14 ? 'That picture is blank. Show me the work.' : a.diff <= 5 ? 'That is the same picture as before.' : why;
  }
  $('#proof').close();
  if (ok) { await say(rand(L.pass), 'happy'); completeTask(); }
  else { vib([150, 60, 150]); await say(why + ' Penalty task.', 'angry'); doPenalty(); }
}
function doPenalty() {
  $('#penText').textContent = rand(PENALTIES);
  let n = FAST ? 5 : 45; const go = $('#penGo'); go.disabled = true; go.textContent = 'Do it…'; $('#penClock').textContent = n;
  $('#penalty').showModal();
  const iv = setInterval(() => { $('#penClock').textContent = --n; if (n <= 0) { clearInterval(iv); go.disabled = false; go.textContent = 'Done. Back to the task'; } }, 1000);
}
$('#penalty').addEventListener('cancel', e => e.preventDefault());
$('#penGo').onclick = () => {
  $('#penalty').close(); S.left = Math.ceil(thresh()); save();
  say('Good. Now finish it properly. Timer is running.', 'smile'); runTimer();
};

async function completeTask() {
  S.done++; S.coins += 20; S.phase = 'break'; save(); paintCoins();
  await say(S.done >= TASKS_PER_DAY ? 'Last task done! One more break, then you are free.' : 'Task done! Break zone. Three minutes at most.', 'happy');
  leaving = true;
  const base = DEFAULT_BREAK, here = location.href.split('?')[0].split('#')[0];
  location.href = base + (base.includes('?') ? '&' : '?') + 'r=' + encodeURIComponent(here) + '&t=' + (FAST ? 18 : 180);
}
async function finale() {
  S.phase = 'done'; S.coins += 30; save(); paintCoins(); setMode('night'); setMood('happy');
  await say(`Congratulations, ${S.name}. You did something barely anyone does. See you tomorrow. Don't be late.`, 'happy');
  setMood('sleep');
}

/* ---------- “you can't leave” ---------- */
addEventListener('beforeunload', e => { if (S.phase === 'task' && !leaving) { e.preventDefault(); e.returnValue = ''; } });
addEventListener('popstate', () => { if (S.phase === 'task') { history.pushState(null, '', location.href); say('Where do you think you are going?', 'angry', 2000); } });
document.addEventListener('visibilitychange', () => {
  if (document.hidden) {
    if (S.phase === 'task' && !paused && !proving && !leaving) { away = true; paused = true; clearInterval(tick); $('#pause').textContent = '▶ Resume'; save(); }
  } else if (away) { away = false; say('Where did you go?! Timer paused. Resume.', 'angry'); }
});
function goFull() {
  try { document.documentElement.requestFullscreen && document.documentElement.requestFullscreen().catch(() => {}); } catch {}
  try { navigator.wakeLock && navigator.wakeLock.request('screen').catch(() => {}); } catch {}
}

/* ---------- shop ---------- */
let tab = 'c', pv = {};
const itemOf = (k, id) => ITEMS[k].find(i => i.id === id);
function refreshLook() {
  const look = {...S.eq, ...pv};
  document.documentElement.style.setProperty('--rc', itemOf('c', look.c).v);
  $('#hat').textContent = itemOf('h', look.h).v; $('#bodyIcon').textContent = itemOf('b', look.b).v;
}
function buildShop() {
  $$('#tabs button').forEach(b => b.classList.toggle('on', b.dataset.c === tab));
  $('#items').innerHTML = ITEMS[tab].map(it => {
    const own = S.own.includes(tab + ':' + it.id), eq = S.eq[tab] === it.id;
    const art = tab === 'c' ? `<i class="sw" style="background:${it.v}"></i>` : (it.v || '∅');
    const btn = eq ? '<button class="on" disabled>Wearing</button>' : own ? `<button class="own" data-a="wear">Wear</button>` : `<button data-a="buy">✦ ${it.p}</button>`;
    return `<div class="item${pv[tab] === it.id ? ' sel' : ''}" data-id="${it.id}"><div class="art">${art}</div><b>${it.n}</b>${btn}</div>`;
  }).join('');
}
$('#tabs').onclick = e => { const b = e.target.closest('button'); if (b) { tab = b.dataset.c; buildShop(); } };
$('#items').onclick = e => {
  const card = e.target.closest('.item'); if (!card) return;
  const id = card.dataset.id, it = itemOf(tab, id), a = e.target.dataset.a;
  if (a === 'buy') {
    if (S.coins < it.p) return void say('Not enough coins. Finish tasks to earn more.', 'sad', 2000);
    S.coins -= it.p; S.own.push(tab + ':' + id); S.eq[tab] = id; delete pv[tab]; save(); paintCoins(); say('Wow! I love it.', 'happy', 1800);
  } else if (a === 'wear') { S.eq[tab] = id; delete pv[tab]; save(); say('Looking good.', 'happy', 1400, false); }
  else pv[tab] = id;
  refreshLook(); buildShop();
};

/* ---------- settings, onboarding ---------- */
const paintCoins = () => $('#coinN').textContent = S.coins;
function fillVoices() {
  const sel = $('#sVoice'), vs = voices().slice().sort((a, b) => (/^en/i.test(b.lang) - /^en/i.test(a.lang)) || a.name.localeCompare(b.name));
  const preferred = vs.find(v => PREFERRED_VOICE.test(v.name) && /^en-US$/i.test(v.lang));
  sel.innerHTML = `<option value="">Auto (${preferred ? `${preferred.name}, ${preferred.lang}` : 'English (US)'})</option>` + vs.map(v => `<option value="${v.name}">${v.name} (${v.lang})</option>`).join('');
  sel.value = S.voice;
}
if ('speechSynthesis' in window) speechSynthesis.onvoiceschanged = fillVoices;
$('#gear').onclick = () => { fillVoices(); $('#sPitch').value = S.pitch; $('#sRate').value = S.rate; $('#settings').showModal(); };
$('#sVoice').onchange = e => { S.voice = e.target.value; save(); };
$('#sPitch').oninput = e => { S.pitch = +e.target.value; save(); };
$('#sRate').oninput = e => { S.rate = +e.target.value; save(); };
$('#sTest').onclick = () => speakText(`Hello ${S.name || 'human'}. It is time for task.`);
$('#sReset').onclick = () => { S.done = 0; S.phase = 'idle'; S.m = -1; save(); location.reload(); };
$('#welcome').addEventListener('cancel', e => e.preventDefault());
$('#wForm').addEventListener('submit', () => {
  S.name = $('#wName').value.trim(); S.goal = $('#wGoal').value.trim(); save();
  setHome(); say(`Hi ${S.name}. I am RoBuddy. Tap my face.`, 'happy', 2000);
});

/* ---------- boot ---------- */
function boot() {
  const back = /[?&]back=1/.test(location.search);
  if (back) history.replaceState(null, '', location.pathname);
  if (S.phase === 'task' && S.left > 0) {
    setMode('task'); renderTask(); paused = true; paintTimer(); $('#pause').textContent = '▶ Resume';
    setMood('angry'); say('You left the task. Resume when you are ready.', 'angry', 0, false); return;
  }
  if (S.phase === 'break' || back) {
    S.phase = 'idle'; save();
    if (S.done >= TASKS_PER_DAY) return void finale();
    setMode('home'); $('#start').textContent = 'Take next task'; $('#start').classList.add('pulse');
    say(`Break over, ${S.name}. Task ${S.done + 1} of ${TASKS_PER_DAY}. Press the button.`, 'smile'); return;
  }
  if (S.phase === 'done' || S.done >= TASKS_PER_DAY) {
    setMode('night'); say(`See you tomorrow, ${S.name}. Don't be late.`, 'sleep', 0, false); return;
  }
  setHome();
}
addEventListener('resize', () => layout(false) || (P.y = Math.min(P.y, ground())));
// Keep pinch and double-tap zoom from changing the game viewport on mobile Safari.
document.addEventListener('gesturestart', e => e.preventDefault(), {passive:false});
document.addEventListener('gesturechange', e => e.preventDefault(), {passive:false});
document.addEventListener('gestureend', e => e.preventDefault(), {passive:false});
paintCoins(); refreshLook(); layout(true); requestAnimationFrame(loop); buddy.classList.add('idle');
if (!S.name) $('#welcome').showModal(); else boot();
