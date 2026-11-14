/* HerHealth — enhanced script
   Adds: saved cycle history (localStorage), predictions (next period,
   fertile window, ovulation), month-navigable calendar, daily mood/symptom
   log, cycle ring, stats, plus the animation helpers (reveal on scroll,
   petals, count-ups, flip cards, breathing exercise, rotating affirmations).
   Everything is guarded so this one file works on all three pages. */

/* ---------------- storage + date helpers ---------------- */
const HH_KEY = 'herhealth.v1';
function hhLoad() {
  try {
    const d = JSON.parse(localStorage.getItem(HH_KEY));
    if (d && Array.isArray(d.cycles) && d.logs) return d;
  } catch (e) { /* ignore */ }
  return { cycles: [], logs: {} };
}
function hhSave(d) { try { localStorage.setItem(HH_KEY, JSON.stringify(d)); } catch (e) { /* ignore */ } }

function dParse(s) { const p = s.split('-').map(Number); return new Date(p[0], p[1] - 1, p[2]); }
function dKey(date) {
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return date.getFullYear() + '-' + m + '-' + d;
}
function dAdd(date, n) { const d = new Date(date.getFullYear(), date.getMonth(), date.getDate()); d.setDate(d.getDate() + n); return d; }
function dDiff(a, b) { return Math.round((new Date(b.getFullYear(), b.getMonth(), b.getDate()) - new Date(a.getFullYear(), a.getMonth(), a.getDate())) / 86400000); }
function dNice(date) { return date.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }); }
function todayKey() { return dKey(new Date()); }

/* ---------------- insights from history ---------------- */
function hhInsights(data) {
  const cycles = [...data.cycles].sort((a, b) => (a.start < b.start ? -1 : 1));
  if (!cycles.length) return null;
  const gaps = [];
  for (let i = 1; i < cycles.length; i++) gaps.push(dDiff(dParse(cycles[i - 1].start), dParse(cycles[i].start)));
  const validGaps = gaps.filter(g => g >= 15 && g <= 60);
  const avgCycle = validGaps.length ? Math.round(validGaps.reduce((x, y) => x + y, 0) / validGaps.length) : 28;
  const lens = cycles.map(c => dDiff(dParse(c.start), dParse(c.end)) + 1).filter(n => n >= 1 && n <= 12);
  const avgPeriod = lens.length ? Math.round(lens.reduce((x, y) => x + y, 0) / lens.length) : 5;

  const lastStart = dParse(cycles[cycles.length - 1].start);
  const nextStart = dAdd(lastStart, avgCycle);
  const today = dParse(todayKey());
  const daysToNext = dDiff(today, nextStart);
  const cycleDay = dDiff(lastStart, today) + 1;

  let phase = null, phaseEmoji = '';
  const ovulationThis = dAdd(lastStart, avgCycle - 14);
  if (cycleDay >= 1) {
    if (cycleDay <= avgPeriod) { phase = 'Menstrual'; phaseEmoji = '🌧'; }
    else if (today < dAdd(ovulationThis, -1)) { phase = 'Follicular'; phaseEmoji = '🌱'; }
    else if (today <= dAdd(ovulationThis, 1)) { phase = 'Ovulation'; phaseEmoji = '💕'; }
    else { phase = 'Luteal'; phaseEmoji = '🌙'; }
  }
  return { cycles, avgCycle, avgPeriod, lastStart, nextStart, daysToNext, cycleDay, phase, phaseEmoji };
}

/* predicted windows for the next few cycles (for calendar marking) */
function hhWindows(ins) {
  const wins = [];
  if (!ins) return wins;
  for (let k = 0; k <= 2; k++) {
    const start = dAdd(ins.lastStart, ins.avgCycle * (k + 1));
    const ov = dAdd(start, -14);
    wins.push({
      pStart: start, pEnd: dAdd(start, ins.avgPeriod - 1),
      fStart: dAdd(ov, -5), fEnd: dAdd(ov, 1), ov
    });
  }
  return wins;
}


/* ---------------- forecast: mood + symptoms from the hormone model ---------------- */
function hormoneAt(t) {
  let e, p, mo;
  if (t < 5) { e = 20 + t * 5; p = 10; mo = 3; }
  else if (t < 13) { e = 40 + (t - 5) * 8; p = 15; mo = 6; }
  else if (t < 16) { e = 120; p = 25; mo = 8; }
  else if (t < 25) { e = 60 - (t - 16) * 4; p = 30 + (t - 16) * 2; mo = 4; }
  else { e = 30; p = 10; mo = 2; }
  return { e, p, mo };
}
function moodLabel(score) {
  if (score >= 8) return { text: 'Bright & energetic', emoji: '😍' };
  if (score >= 6) return { text: 'Good & steady', emoji: '😊' };
  if (score >= 4) return { text: 'Low-key', emoji: '😐' };
  if (score >= 2) return { text: 'Tired / sensitive', emoji: '😔' };
  return { text: 'Very low', emoji: '😣' };
}
function forecastFor(key, data) {
  const ins = hhInsights(data);
  if (!ins) return null;
  const target = dParse(key);
  const starts = ins.cycles.map(c => dParse(c.start));
  let s = new Date(ins.lastStart);
  while (s <= target) { s = dAdd(s, ins.avgCycle); starts.push(new Date(s)); }
  starts.sort((a, b) => a - b);
  let start = null;
  for (const st of starts) { if (st <= target) start = st; else break; }
  if (!start) return null;
  const nextStart = starts.find(st => st > start);
  const cycleLen = nextStart ? dDiff(start, nextStart) : ins.avgCycle;
  const day = dDiff(start, target) + 1;
  if (day < 1 || day > cycleLen) return null;
  const t = (day - 1) / Math.max(1, cycleLen - 1) * 27;
  const h = hormoneAt(t);
  const ov = dAdd(start, cycleLen - 14);
  let phase;
  if (day <= ins.avgPeriod) phase = 'Menstrual';
  else if (target < dAdd(ov, -1)) phase = 'Follicular';
  else if (target <= dAdd(ov, 1)) phase = 'Ovulation';
  else phase = 'Luteal';
  let symptoms, why;
  if (phase === 'Menstrual') {
    symptoms = ['Cramps', 'Fatigue', 'Back pain', 'Bloating'];
    why = 'Estrogen and progesterone are both at their lowest — rest and warmth genuinely help today.';
  } else if (phase === 'Follicular') {
    symptoms = ['Rising energy', 'Better focus', 'Lighter mood'];
    why = 'Estrogen is climbing while progesterone stays low, so energy and mood usually lift.';
  } else if (phase === 'Ovulation') {
    symptoms = ['High energy', 'Mild pelvic twinge', 'Glow & confidence'];
    why = 'Estrogen peaks around ovulation — this is usually the brightest window of the cycle.';
  } else if (cycleLen - day <= 5) {
    symptoms = ['Bloating', 'Mood swings', 'Cravings', 'Headache', 'Acne'];
    why = 'Progesterone is falling as your period approaches — classic pre-period signals.';
  } else {
    symptoms = ['Breast tenderness', 'Bloating', 'Mood swings', 'Cravings'];
    why = 'Progesterone is high in the luteal phase, which can bring tenderness, bloating and mood dips.';
  }
  const ml = moodLabel(h.mo);
  return { day, cycleLen, phase, score: h.mo, moodText: ml.text, moodEmoji: ml.emoji, symptoms, why };
}
function renderForecast() {
  const moodEl = document.getElementById('forecast-mood');
  if (!moodEl) return;
  const title = document.getElementById('forecast-title');
  const symEl = document.getElementById('forecast-symptoms');
  const whyEl = document.getElementById('forecast-why');
  const f = forecastFor(hh.selected, hh.data);
  if (title) title.textContent = hh.selected === todayKey() ? "🔮 Today's Forecast" : '🔮 Forecast · ' + dNice(dParse(hh.selected));
  if (!f) {
    moodEl.textContent = 'Log a cycle to unlock predictions 🌸';
    if (symEl) symEl.innerHTML = '';
    if (whyEl) whyEl.textContent = '';
    return;
  }
  moodEl.textContent = f.moodEmoji + ' ' + f.moodText + ' · ' + f.score + '/10';
  if (symEl) symEl.innerHTML = f.symptoms.map(x => '<span class="chip on">' + x + '</span>').join('');
  if (whyEl) whyEl.textContent = 'Day ' + f.day + ' of ~' + f.cycleLen + ' · ' + f.phase + ' phase — ' + f.why;
}

/* ---------------- tiny UI helpers ---------------- */
function toast(msg) {
  let t = document.querySelector('.toast');
  if (!t) { t = document.createElement('div'); t.className = 'toast'; document.body.appendChild(t); }
  t.textContent = msg;
  t.classList.add('show');
  clearTimeout(t._h);
  t._h = setTimeout(() => t.classList.remove('show'), 2400);
}
function countUp(el, target, suffix) {
  if (!el) return;
  const dur = 900, t0 = performance.now();
  function step(t) {
    const p = Math.min(1, (t - t0) / dur);
    el.textContent = Math.round(target * (0.2 + 0.8 * p)) + (suffix || '');
    if (p < 1) requestAnimationFrame(step); else el.textContent = target + (suffix || '');
  }
  requestAnimationFrame(step);
}
function petalBurst(anchor) {
  if (!anchor || !anchor.animate) return;
  const r = anchor.getBoundingClientRect();
  const glyphs = ['🌸', '💗', '🌷', '✨'];
  for (let i = 0; i < 10; i++) {
    const s = document.createElement('span');
    s.textContent = glyphs[i % glyphs.length];
    s.style.cssText = 'position:fixed;z-index:70;pointer-events:none;font-size:18px;left:' + (r.left + r.width / 2) + 'px;top:' + (r.top) + 'px;';
    document.body.appendChild(s);
    const ang = (Math.PI * 2 * i) / 10 + Math.random() * 0.5;
    const dist = 60 + Math.random() * 70;
    s.animate([
      { transform: 'translate(0,0) scale(1)', opacity: 1 },
      { transform: 'translate(' + Math.cos(ang) * dist + 'px,' + (Math.sin(ang) * dist - 40) + 'px) scale(0.4) rotate(160deg)', opacity: 0 }
    ], { duration: 950 + Math.random() * 400, easing: 'cubic-bezier(.2,.8,.3,1)' }).onfinish = () => s.remove();
  }
}

/* ---------------- reveal on scroll + petals ---------------- */
document.addEventListener('DOMContentLoaded', () => {
  const io = 'IntersectionObserver' in window ? new IntersectionObserver(es => {
    es.forEach(e => { if (e.isIntersecting) { e.target.classList.add('in'); io.unobserve(e.target); } });
  }, { threshold: 0.12 }) : null;
  document.querySelectorAll('.reveal').forEach(el => { if (io) io.observe(el); else el.classList.add('in'); });

  const petalBox = document.querySelector('.petals');
  if (petalBox) {
    const glyphs = ['🌸', '🌷', '💗', '✨', '🌸'];
    for (let i = 0; i < 12; i++) {
      const p = document.createElement('span');
      p.className = 'petal';
      p.textContent = glyphs[i % glyphs.length];
      p.style.left = (Math.random() * 96) + 'vw';
      p.style.fontSize = (14 + Math.random() * 16) + 'px';
      p.style.animationDuration = (11 + Math.random() * 12) + 's';
      p.style.animationDelay = (-Math.random() * 18) + 's';
      petalBox.appendChild(p);
    }
  }
});

/* ---------------- self-care tabs (single clean version) ---------------- */
function showContent(id, btn) {
  document.querySelectorAll('.content-box').forEach(b => b.classList.remove('visible'));
  const target = document.getElementById(id);
  if (target) target.classList.add('visible');
  document.querySelectorAll('.care-btn').forEach(b => b.classList.remove('active'));
  if (btn) btn.classList.add('active');
}

/* myth flip cards */
document.addEventListener('DOMContentLoaded', () => {
  document.querySelectorAll('.flip').forEach(card => {
    card.addEventListener('click', () => card.classList.toggle('flipped'));
  });
});

/* breathing exercise (4-4-4) */
let breathTimer = null;
function toggleBreathing(btn) {
  const circle = document.getElementById('breath-circle');
  const label = document.getElementById('breath-label');
  if (!circle) return;
  if (breathTimer) {
    clearInterval(breathTimer); breathTimer = null;
    circle.classList.remove('animating');
    label.textContent = 'Ready?';
    btn.textContent = '▶ Start breathing';
    return;
  }
  const phases = ['Breathe in…', 'Hold…', 'Breathe out…'];
  let i = 0;
  label.textContent = phases[0];
  circle.classList.add('animating');
  btn.textContent = '⏸ Stop';
  breathTimer = setInterval(() => { i = (i + 1) % 3; label.textContent = phases[i]; }, 4000);
}

/* rotating affirmations */
document.addEventListener('DOMContentLoaded', () => {
  const el = document.getElementById('affirmation-text');
  if (!el) return;
  const lines = [
    '🌸 Your body is not a problem to fix — it is a story to listen to.',
    '💗 Rest is productive too. Softness is strength.',
    '🌷 You are allowed to take up space, in every phase.',
    '✨ Small gentle habits, repeated kindly, change everything.',
    '🌙 Your cycle is a rhythm, not a flaw.',
    '💪 Strong looks different every day — and every version counts.'
  ];
  let i = 0;
  setInterval(() => {
    el.style.opacity = 0;
    setTimeout(() => { i = (i + 1) % lines.length; el.textContent = lines[i]; el.style.opacity = 1; }, 600);
  }, 6000);
});

/* tip of the day (home) */
const HH_TIPS = [
  'Warm water and a heating pad are a cramp\'s worst enemies. 🫖',
  'Iron-rich foods — spinach, lentils, dates — help replace what you lose each cycle. 🥬',
  'A 20-minute walk can lift mood more than an extra hour of scrolling. 🚶‍♀️',
  'Magnesium in dark chocolate and nuts genuinely helps with cramps. 🍫',
  'Your energy peaks around ovulation — schedule the big presentation then. ✨',
  'Sleep is cycle care: 7–9 hours keeps hormones steadier. 😴',
  'Track for 3 cycles and patterns you never noticed will start to show. 📊',
  'Gentle stretching before bed eases next-day cramps. 🧘‍♀️',
  'Hydration first: many headaches in the luteal phase are just thirst. 💧',
  'Be extra kind to yourself on Day 1. It is a physiological event, not a mood. 💗'
];
document.addEventListener('DOMContentLoaded', () => {
  const tipEl = document.getElementById('tip-text');
  if (!tipEl) return;
  const dayIdx = Math.floor((Date.now() - new Date(new Date().getFullYear(), 0, 0)) / 86400000);
  let idx = dayIdx % HH_TIPS.length;
  tipEl.textContent = HH_TIPS[idx];
  const btn = document.getElementById('tip-btn');
  if (btn) btn.addEventListener('click', () => {
    tipEl.style.opacity = 0;
    setTimeout(() => { idx = (idx + 1) % HH_TIPS.length; tipEl.textContent = HH_TIPS[idx]; tipEl.style.opacity = 1; }, 350);
  });
});

/* ---------------- tracker state + rendering ---------------- */
const hh = { data: hhLoad(), view: null, selected: todayKey() };
(function initView() {
  const now = new Date();
  hh.view = { y: now.getFullYear(), m: now.getMonth() };
})();

function classForDate(key, data, ins, wins) {
  const d = dParse(key);
  const classes = [];
  for (const c of data.cycles) {
    if (key >= c.start && key <= c.end) { classes.push('period'); break; }
  }
  for (const w of wins) {
    if (d >= w.fStart && d <= w.fEnd) classes.push('fertile');
    if (key === dKey(w.ov)) classes.push('ovulation');
    if (d >= w.pStart && d <= w.pEnd && !classes.includes('period')) classes.push('predicted');
  }
  if (key === todayKey()) classes.push('today');
  if (key === hh.selected) classes.push('selected');
  return classes.join(' ');
}

function renderCalendar() {
  const grid = document.getElementById('calendar-grid');
  if (!grid) return;
  const ins = hhInsights(hh.data);
  const wins = hhWindows(ins);
  const { y, m } = hh.view;
  const title = document.getElementById('cal-title');
  if (title) title.textContent = new Date(y, m, 1).toLocaleDateString('en-IN', { month: 'long', year: 'numeric' });

  grid.innerHTML = '';
  ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].forEach(d => {
    const h = document.createElement('div');
    h.className = 'cal-weekday'; h.textContent = d; grid.appendChild(h);
  });
  const firstDow = new Date(y, m, 1).getDay();
  const daysInMonth = new Date(y, m + 1, 0).getDate();
  for (let i = 0; i < firstDow; i++) {
    const e = document.createElement('div');
    e.className = 'calendar-cell empty'; grid.appendChild(e);
  }
  for (let day = 1; day <= daysInMonth; day++) {
    const date = new Date(y, m, day);
    const key = dKey(date);
    const cell = document.createElement('div');
    cell.className = 'calendar-cell ' + classForDate(key, hh.data, ins, wins);
    cell.style.animationDelay = (day * 18) + 'ms';
    cell.innerHTML = '<span>' + day + '</span>' + (hh.data.logs[key] ? '<span class="log-dot"></span>' : '');
    cell.title = dNice(date);
    cell.addEventListener('click', () => { hh.selected = key; renderCalendar(); renderForecast(); });
    grid.appendChild(cell);
  }
}

function renderRingAndStats() {
  const ins = hhInsights(hh.data);
  const ringFg = document.getElementById('ring-fg');
  const rcDay = document.getElementById('rc-day');
  const rcPhase = document.getElementById('rc-phase');
  const info = document.getElementById('ring-info');
  const C = 2 * Math.PI * 54;

  const setStat = (id, val) => { const el = document.getElementById(id); if (el) countUp(el, val || 0); };
  setStat('stat-cycles', hh.data.cycles.length);
  setStat('stat-avgcycle', ins ? ins.avgCycle : 0);
  setStat('stat-avgperiod', ins ? ins.avgPeriod : 0);
  setStat('stat-logs', Object.keys(hh.data.logs).length);

  if (!ins) {
    if (rcDay) rcDay.textContent = '—';
    if (rcPhase) { rcPhase.textContent = 'log your first period 💌'; rcPhase.style.fontSize = '0.66rem'; }
    if (ringFg) { ringFg.style.strokeDasharray = C; ringFg.style.strokeDashoffset = C; }
    if (info) info.innerHTML = 'Log your first cycle and I\'ll start predicting your next period, fertile window and ovulation day. 🌸';
    return;
  }
  const frac = Math.max(0, Math.min(1, ins.cycleDay / ins.avgCycle));
  if (ringFg) {
    ringFg.style.strokeDasharray = C;
    ringFg.style.strokeDashoffset = C;
    requestAnimationFrame(() => requestAnimationFrame(() => { ringFg.style.strokeDashoffset = C * (1 - frac); }));
  }
  if (rcDay) rcDay.textContent = ins.cycleDay > 0 ? 'Day ' + ins.cycleDay : '—';
  if (rcPhase) { rcPhase.style.fontSize = ''; rcPhase.textContent = ins.phase ? ins.phaseEmoji + ' ' + ins.phase + ' phase' : 'Getting ready'; }
  if (info) {
    const when = ins.daysToNext > 0
      ? '<div class="countdown">Next period in <span class="num" id="cd-num">' + ins.daysToNext + '</span> days</div>'
      : ins.daysToNext === 0
        ? '<div class="countdown">Your period is predicted <span class="num">today</span> 🌸</div>'
        : '<div class="countdown">Period expected <span class="num">' + Math.abs(ins.daysToNext) + 'd</span> ago — cycles vary, take it gently 💗</div>';
    info.innerHTML = when +
      '<div>🗓 Next period: <strong>' + dNice(ins.nextStart) + '</strong></div>' +
      '<div>🔁 Average cycle: <strong>' + ins.avgCycle + ' days</strong> · period: <strong>' + ins.avgPeriod + ' days</strong></div>' +
      '<div>🌱 Last period started: <strong>' + dNice(ins.lastStart) + '</strong></div>';
    const cd = document.getElementById('cd-num');
    if (cd && ins.daysToNext > 0) countUp(cd, ins.daysToNext);
  }
}

function renderHistory() {
  const box = document.getElementById('history-list');
  if (!box) return;
  const cycles = [...hh.data.cycles].sort((a, b) => (a.start < b.start ? 1 : -1));
  if (!cycles.length) {
    box.innerHTML = '<p class="empty-note">No cycles saved yet.<br>Log one above and it will live here. 🌷</p>';
    return;
  }
  box.innerHTML = '';
  cycles.forEach((c, idx) => {
    const len = dDiff(dParse(c.start), dParse(c.end)) + 1;
    const item = document.createElement('div');
    item.className = 'history-item';
    item.style.animationDelay = (idx * 70) + 'ms';
    item.innerHTML = '<div><div class="h-dates">' + dNice(dParse(c.start)) + ' → ' + dNice(dParse(c.end)) + '</div>' +
      '<div class="h-meta">' + len + ' day' + (len === 1 ? '' : 's') + '</div></div>';
    const del = document.createElement('button');
    del.className = 'del-btn'; del.textContent = '🗑'; del.title = 'Delete this cycle';
    del.addEventListener('click', () => {
      hh.data.cycles = hh.data.cycles.filter(x => !(x.start === c.start && x.end === c.end));
      hhSave(hh.data); refreshTracker(); toast('Cycle removed');
    });
    item.appendChild(del);
    box.appendChild(item);
  });
}

/* ---------------- daily log ---------------- */
const HH_MOODS = ['😍', '😊', '😐', '😔', '😣', '😴'];
const HH_FLOWS = ['Light', 'Medium', 'Heavy'];
const HH_SYMPTOMS = ['Cramps', 'Headache', 'Bloating', 'Fatigue', 'Back pain', 'Acne', 'Mood swings', 'Cravings'];
const logDraft = { mood: '', flow: '', symptoms: new Set() };

function renderLogPanel() {
  const panel = document.getElementById('log-panel');
  if (!panel) return;
  const title = document.getElementById('log-date-title');
  if (title) title.textContent = '📝 ' + dNice(dParse(hh.selected)) + (hh.selected === todayKey() ? ' (today)' : '');
  const saved = hh.data.logs[hh.selected] || {};
  logDraft.mood = saved.mood || '';
  logDraft.flow = saved.flow || '';
  logDraft.symptoms = new Set(saved.symptoms || []);

  const moodRow = document.getElementById('mood-row');
  moodRow.innerHTML = '';
  HH_MOODS.forEach(mo => {
    const b = document.createElement('button');
    b.type = 'button'; b.className = 'mood-btn' + (logDraft.mood === mo ? ' on' : ''); b.textContent = mo;
    b.addEventListener('click', () => { logDraft.mood = logDraft.mood === mo ? '' : mo; renderLogPanel(); });
    moodRow.appendChild(b);
  });
  const flowRow = document.getElementById('flow-row');
  flowRow.innerHTML = '';
  HH_FLOWS.forEach(f => {
    const b = document.createElement('button');
    b.type = 'button'; b.className = 'chip' + (logDraft.flow === f ? ' on' : ''); b.textContent = f;
    b.addEventListener('click', () => { logDraft.flow = logDraft.flow === f ? '' : f; renderLogPanel(); });
    flowRow.appendChild(b);
  });
  const symRow = document.getElementById('symptom-row');
  symRow.innerHTML = '';
  HH_SYMPTOMS.forEach(s => {
    const b = document.createElement('button');
    b.type = 'button'; b.className = 'chip' + (logDraft.symptoms.has(s) ? ' on' : ''); b.textContent = s;
    b.addEventListener('click', () => { logDraft.symptoms.has(s) ? logDraft.symptoms.delete(s) : logDraft.symptoms.add(s); renderLogPanel(); });
    symRow.appendChild(b);
  });
}

function saveLog(btn) {
  const entry = { mood: logDraft.mood, flow: logDraft.flow, symptoms: [...logDraft.symptoms] };
  if (!entry.mood && !entry.flow && !entry.symptoms.length) delete hh.data.logs[hh.selected];
  else hh.data.logs[hh.selected] = entry;
  hhSave(hh.data);
  renderCalendar(); renderRingAndStats();
  petalBurst(btn);
  toast('Saved for ' + dNice(dParse(hh.selected)) + ' 💗');
}

/* ---------------- hormone chart (full cycle now) ---------------- */
let hormoneChartInstance = null;
function generateGraph() {
  const canvas = document.getElementById('hormoneChart');
  if (!canvas || typeof Chart === 'undefined') return;
  const ins = hhInsights(hh.data);
  const cycleLen = ins ? ins.avgCycle : 28;
  const start = ins ? ins.lastStart : dAdd(dParse(todayKey()), -13);

  const labels = [], estrogen = [], progesterone = [], mood = [];
  for (let i = 0; i < cycleLen; i++) {
    const d = dAdd(start, i);
    labels.push(d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' }));
    const t = (i / Math.max(1, cycleLen - 1)) * 27; // position on a classic 28-day curve
    let e, p, mo;
    if (t < 5) { e = 20 + t * 5; p = 10; mo = 3; }
    else if (t < 13) { e = 40 + (t - 5) * 8; p = 15; mo = 6; }
    else if (t < 16) { e = 120; p = 25; mo = 8; }
    else if (t < 25) { e = 60 - (t - 16) * 4; p = 30 + (t - 16) * 2; mo = 4; }
    else { e = 30; p = 10; mo = 2; }
    estrogen.push(Math.round(e)); progesterone.push(Math.round(p)); mood.push(mo);
  }
  if (hormoneChartInstance) hormoneChartInstance.destroy();
  hormoneChartInstance = new Chart(canvas.getContext('2d'), {
    type: 'line',
    data: {
      labels,
      datasets: [
        { label: 'Estrogen', data: estrogen, borderColor: '#ff69b4', backgroundColor: 'rgba(255,105,180,0.12)', tension: 0.45, fill: true, pointRadius: 0 },
        { label: 'Progesterone', data: progesterone, borderColor: '#8a2be2', backgroundColor: 'rgba(138,43,226,0.10)', tension: 0.45, fill: true, pointRadius: 0 },
        { label: 'Mood (1-10)', data: mood, borderColor: '#ff9900', backgroundColor: 'rgba(255,153,0,0.08)', tension: 0.45, fill: false, borderDash: [5, 5], pointRadius: 0 }
      ]
    },
    options: {
      responsive: true, maintainAspectRatio: false,
      animation: { duration: 1400, easing: 'easeOutQuart' },
      scales: { y: { beginAtZero: true } },
      plugins: { legend: { position: 'bottom' } }
    }
  });
}

/* ---------------- tracker wiring ---------------- */
function refreshTracker() { renderRingAndStats(); renderCalendar(); renderHistory(); renderForecast(); generateGraph(); }

document.addEventListener('DOMContentLoaded', () => {
  const form = document.getElementById('period-form');
  if (form) {
    form.addEventListener('submit', e => {
      e.preventDefault();
      const s = document.getElementById('start-date').value;
      const en = document.getElementById('end-date').value;
      if (!s || !en) { toast('Please enter both dates 🌸'); return; }
      if (s > en) { toast('Start date must be before end date 🥲'); return; }
      hh.data.cycles = hh.data.cycles.filter(c => c.start !== s);
      hh.data.cycles.push({ start: s, end: en });
      hhSave(hh.data);
      const sd = dParse(s);
      hh.view = { y: sd.getFullYear(), m: sd.getMonth() };
      hh.selected = s;
      const days = dDiff(sd, dParse(en)) + 1;
      const sum = document.getElementById('tracker-summary');
      if (sum) sum.innerHTML = '🌸 Period length: <strong>' + days + ' days</strong><br>🌿 ' + dNice(sd) + ' → ' + dNice(dParse(en)) + '<br>Saved to your history 💗';
      refreshTracker();
      petalBurst(form.querySelector('button'));
      toast('Cycle logged 🌸');
    });
  }
  const prev = document.getElementById('cal-prev');
  const next = document.getElementById('cal-next');
  if (prev) prev.addEventListener('click', () => { hh.view.m--; if (hh.view.m < 0) { hh.view.m = 11; hh.view.y--; } renderCalendar(); });
  if (next) next.addEventListener('click', () => { hh.view.m++; if (hh.view.m > 11) { hh.view.m = 0; hh.view.y++; } renderCalendar(); });
  const saveBtn = document.getElementById('log-save');
  if (saveBtn) saveBtn.addEventListener('click', () => saveLog(saveBtn));
  if (document.getElementById('calendar-grid')) refreshTracker();
});

/* ---------------- home: cycle at a glance ---------------- */
document.addEventListener('DOMContentLoaded', () => {
  const box = document.getElementById('glance-body');
  if (!box) return;
  const ins = hhInsights(hhLoad());
  if (!ins) {
    box.innerHTML = '<p class="glance-sub">No cycles logged yet. Head to the Tracker, log your last period, and this card will start showing your current phase and next-period prediction.</p><a class="btn" href="tracker.html">Open the Tracker →</a>';
    return;
  }
  const when = ins.daysToNext > 0 ? 'in ' + ins.daysToNext + ' day' + (ins.daysToNext === 1 ? '' : 's')
    : ins.daysToNext === 0 ? 'today 🌸' : Math.abs(ins.daysToNext) + ' day(s) overdue — cycles vary 💗';
  box.innerHTML =
    '<div class="glance-big">' + (ins.phaseEmoji || '🌷') + ' Day ' + Math.max(1, ins.cycleDay) + ' — ' + (ins.phase || '') + ' phase</div>' +
    '<p class="glance-sub">Next period predicted <strong>' + when + '</strong> (' + dNice(ins.nextStart) + '), based on your average ' + ins.avgCycle + '-day cycle.</p>' +
    '<a class="btn" href="tracker.html">See my calendar →</a>';
  const f = forecastFor(todayKey(), hhLoad());
  if (f) {
    box.innerHTML += '<p class="glance-sub" style="margin-top:12px">🔮 <strong>Today\'s forecast:</strong> ' + f.moodEmoji + ' ' + f.moodText + ' (' + f.score + '/10) · likely: ' + f.symptoms.join(', ') + '</p>';
  }
});

/* self-care back-to-top button */
document.addEventListener('DOMContentLoaded', () => {
  const btn = document.getElementById('to-top');
  if (!btn) return;
  const dash = document.querySelector('.selfcare-dashboard');
  const toggle = () => {
    const y = window.scrollY + (dash ? dash.scrollTop : 0);
    btn.classList.toggle('show', y > 300);
  };
  window.addEventListener('scroll', toggle, { passive: true });
  if (dash) dash.addEventListener('scroll', toggle, { passive: true });
  btn.addEventListener('click', () => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
    if (dash) dash.scrollTo({ top: 0, behavior: 'smooth' });
  });
  toggle();
});
