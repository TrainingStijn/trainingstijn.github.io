import { firebaseConfig } from "./firebase-config.js";

/* ============ SCHEMA ============ */
const EX = {
  dbbench:  { n: "Dumbbell bench press", u: "kg per dumbbell", inc: 1, c: ["Lig plat op de bank, voeten stevig op de grond.", "Laat de dumbbells zakken tot naast je borst, ellebogen schuin (niet wijd).", "Duw recht omhoog, dumbbells niet tegen elkaar tikken."] },
  cablerow: { n: "Seated cable row", u: "kg op de stack", inc: 2.5, c: ["Zit rechtop, borst vooruit, knieën licht gebogen.", "Trek de handle naar je buik en knijp je schouderbladen samen.", "Rustig terug tot je armen gestrekt zijn, niet met je rug meebewegen."] },
  dbpress:  { n: "Dumbbell shoulder press", u: "kg per dumbbell", inc: 1, c: ["Zittend, bank (bijna) rechtop, rug tegen de leuning.", "Start met de dumbbells op oorhoogte.", "Duw omhoog zonder je onderrug hol te trekken."] },
  pulldown: { n: "Lat pulldown", u: "kg op de stack", inc: 2.5, c: ["Handen iets breder dan je schouders.", "Trek de stang naar je bovenborst, borst omhoog.", "Niet ver achterover hangen of rukken, rustig terug."] },
  lateral:  { n: "Lateral raise", u: "kg per dumbbell", inc: 1, c: ["Licht gewicht, ellebogen een klein beetje gebogen.", "Til zijwaarts op tot schouderhoogte.", "Langzaam laten zakken, niet zwaaien met je lichaam."] },
  curl:     { n: "Biceps curl", u: "kg per dumbbell", inc: 1, c: ["Ellebogen blijven naast je lichaam.", "Krul omhoog met handpalmen naar boven.", "Rustig zakken tot je armen gestrekt zijn."] },
  pushdown: { n: "Triceps pushdown", u: "kg op de stack", inc: 2.5, c: ["Touw of korte stang aan de hoge kabel.", "Ellebogen vast tegen je zij houden.", "Duw naar beneden tot je armen gestrekt zijn, rustig terug."] },
  incline:  { n: "Incline dumbbell press", u: "kg per dumbbell", inc: 1, c: ["Zet de bank op ongeveer 30°.", "Zelfde beweging als de bench press.", "Dumbbells zakken naast je bovenborst."] },
  dbrow:    { n: "Eenarmige dumbbell row", u: "kg", inc: 1, c: ["Eén knie en hand op de bank, rug plat.", "Trek de dumbbell naar je heup.", "Eerst alle reps links, dan rechts: samen is dat 1 set. Vul de reps van je zwakste kant in."] },
  hammer:   { n: "Hammer curl", u: "kg per dumbbell", inc: 1, c: ["Duimen naar boven, alsof je een hamer vasthoudt.", "Ellebogen naast je lichaam.", "Niet zwaaien."] }
};
// [oefening, sets, repsMin, repsMax, rustSec]
const DAYS = {
  A: { t: "Training A", x: [["dbbench",3,8,12,90],["cablerow",3,10,12,90],["dbpress",3,10,12,90],["pulldown",3,10,12,90],["lateral",2,12,15,60],["curl",2,10,12,60],["pushdown",2,10,12,60]] },
  B: { t: "Training B", x: [["incline",3,8,12,90],["pulldown",3,10,12,90],["dbrow",3,10,12,90],["lateral",3,12,15,60],["hammer",2,10,12,60],["pushdown",2,10,12,60]] }
};

/* ============ STATE + OPSLAG ============ */
const KEY = "beastmode.v1", CODEKEY = "beastmode.code";
let S = { name: "", weights: {}, history: [], cur: null, updatedAt: 0 };
let view = "home", lastDone = null;
try { const r = localStorage.getItem(KEY); if (r) S = Object.assign(S, JSON.parse(r)); } catch (e) {}
let code = "";
try { code = localStorage.getItem(CODEKEY) || ""; } catch (e) {}
if (!code) { code = newCode(); try { localStorage.setItem(CODEKEY, code); } catch (e) {} }

function newCode() {
  const abc = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789", a = new Uint32Array(20);
  crypto.getRandomValues(a);
  return Array.from(a, n => abc[n % abc.length]).join("");
}
function save() {
  S.updatedAt = Date.now();
  try { localStorage.setItem(KEY, JSON.stringify(S)); } catch (e) {}
  cloudPush();
}

/* ============ FIREBASE SYNC ============ */
const FB = "https://www.gstatic.com/firebasejs/10.12.2/";
const cloudOn = firebaseConfig.apiKey && !firebaseConfig.apiKey.startsWith("VUL_IN");
let fs = null, db = null, cloud = cloudOn ? "verbinden" : "uit", pushT = null;

async function cloudInit() {
  if (!cloudOn) return;
  try {
    const { initializeApp } = await import(FB + "firebase-app.js");
    fs = await import(FB + "firebase-firestore.js");
    db = fs.getFirestore(initializeApp(firebaseConfig));
    await cloudPull(false);
  } catch (e) { cloud = "fout"; console.warn(e); paintStatus(); }
}
async function cloudPull(force) {
  if (!db) return;
  const snap = await fs.getDoc(fs.doc(db, "trainers", code));
  if (snap.exists()) {
    const d = snap.data();
    if (force || (d.updatedAt || 0) > (S.updatedAt || 0)) {
      S = { name: d.name || "", weights: d.weights || {}, history: d.history || [], cur: d.cur || null, updatedAt: d.updatedAt || 0 };
      try { localStorage.setItem(KEY, JSON.stringify(S)); } catch (e) {}
      if (view !== "workout") render();
    } else if ((S.updatedAt || 0) > (d.updatedAt || 0)) cloudPush();
    cloud = "online";
  } else if (force) {
    cloud = "online"; throw new Error("onbekende code");
  } else { cloud = "online"; cloudPush(); }
  paintStatus();
}
function cloudPush() {
  if (!db) return;
  clearTimeout(pushT);
  pushT = setTimeout(async () => {
    try {
      await fs.setDoc(fs.doc(db, "trainers", code), { name: S.name, weights: S.weights, history: S.history, cur: S.cur, updatedAt: S.updatedAt });
      cloud = "online";
    } catch (e) { cloud = "fout"; console.warn(e); }
    paintStatus();
  }, 700);
}
function statusHTML() {
  const m = { online: ["on", "Opgeslagen in de cloud"], verbinden: ["", "Verbinden…"], fout: ["err", "Geen verbinding, wordt lokaal bewaard"], uit: ["", "Alleen op dit toestel"] }[cloud];
  return `<span class="dot ${m[0]}"></span>${m[1]}`;
}
function paintStatus() { const el = $("#status"); if (el) el.innerHTML = statusHTML(); }

/* ============ HELPERS ============ */
const $ = s => document.querySelector(s);
const esc = v => String(v ?? "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const yt = n => "https://www.youtube.com/results?search_query=" + encodeURIComponent(n + " correct form tutorial");
const kg = k => (k === "" || k == null) ? "–" : String(Math.round(k * 10) / 10).replace(".", ",");
const fdate = d => new Date(d).toLocaleDateString("nl-NL", { weekday: "short", day: "numeric", month: "short" });
function lastFor(id) {
  for (let i = S.history.length - 1; i >= 0; i--) {
    const e = S.history[i].log.find(l => l.id === id && l.sets.length);
    if (e) return e;
  }
  return null;
}
const nextDay = () => { const h = S.history[S.history.length - 1]; return h && h.day === "A" ? "B" : "A"; };
const topHit = (ex, e) => e && e.kg !== "" && e.sets.length >= ex[1] && e.sets.every(s => s.reps >= ex[3]);
function weekCount() {
  const now = new Date(), day = (now.getDay() + 6) % 7;
  const start = new Date(now.getFullYear(), now.getMonth(), now.getDate() - day).getTime();
  return S.history.filter(h => h.date >= start).length;
}
function totalKg() {
  let t = 0;
  S.history.forEach(h => h.log.forEach(l => l.sets.forEach(s => t += (+l.kg || 0) * s.reps)));
  return t >= 1000 ? (Math.round(t / 100) / 10).toString().replace(".", ",") + "t" : Math.round(t) + "";
}

/* ============ GELUID / SCHERM ============ */
let ac = null, wake = null;
function unlock() {
  try { if (!ac) ac = new (window.AudioContext || window.webkitAudioContext)(); if (ac.state === "suspended") ac.resume(); } catch (e) {}
}
function beep() {
  try {
    if (ac) [0, .25, .5].forEach(t => {
      const o = ac.createOscillator(), g = ac.createGain();
      o.frequency.value = 880; o.connect(g); g.connect(ac.destination);
      g.gain.setValueAtTime(.3, ac.currentTime + t);
      g.gain.exponentialRampToValueAtTime(.001, ac.currentTime + t + .2);
      o.start(ac.currentTime + t); o.stop(ac.currentTime + t + .22);
    });
  } catch (e) {}
  try { navigator.vibrate && navigator.vibrate([300, 150, 300]); } catch (e) {}
}
async function keepAwake(on) {
  try {
    if (on && !wake && "wakeLock" in navigator) { wake = await navigator.wakeLock.request("screen"); wake.addEventListener("release", () => wake = null); }
    if (!on && wake) { await wake.release(); wake = null; }
  } catch (e) {}
}

/* ============ SCHERMEN ============ */
function render() {
  const a = $("#app");
  if (view === "workout" && S.cur) a.innerHTML = workoutHTML();
  else if (view === "done" && lastDone) a.innerHTML = doneHTML();
  else if (view === "history") a.innerHTML = historyHTML();
  else if (view === "settings") a.innerHTML = settingsHTML();
  else { view = "home"; a.innerHTML = homeHTML(); }
  keepAwake(view === "workout");
  window.scrollTo(0, 0);
}

function homeHTML() {
  const nd = nextDay(), od = nd === "A" ? "B" : "A", last = S.history[S.history.length - 1];
  const exList = k => DAYS[k].x.map(x => EX[x[0]].n).join(" · ");
  const hi = S.name ? `Yo ${esc(S.name)},` : "Klaar om te knallen?";
  const resume = S.cur ? `<button class="card resume alt" data-start="${S.cur.day}"><span><strong>${esc(DAYS[S.cur.day].t)} loopt nog</strong><br><span class="mute">Ga verder bij oefening ${S.cur.ex + 1}</span></span><span class="big red">▶</span></button>` : "";
  return `<div class="top"><div><div class="mute">${hi}</div><h1 class="h h1">Beast <span class="red">Mode</span></h1></div><button class="ghost" data-go="settings" aria-label="Instellingen">⚙</button></div>
  ${resume}
  <button class="hero" data-start="${nd}">
    <span class="big">${nd}</span>
    <span class="lbl">Volgende training</span>
    <span class="ttl" style="display:block">${DAYS[nd].t}</span>
    <span class="ex" style="display:block">${esc(exList(nd))}</span>
    <span class="go">Start ▶</span>
  </button>
  <button class="card alt" data-start="${od}"><span><strong>${DAYS[od].t}</strong><br><span class="mute">${esc(exList(od))}</span></span><span class="big">${od}</span></button>
  <div class="stats">
    <div class="stat"><b>${S.history.length}</b><span>trainingen</span></div>
    <div class="stat"><b>${weekCount()}<span class="mute" style="font-size:20px">/2</span></b><span>deze week</span></div>
    <div class="stat"><b>${totalKg()}</b><span>kg verplaatst</span></div>
  </div>
  <div class="card">
    <div class="mute">${last ? `Laatste: <strong style="color:var(--ink)">${esc(DAYS[last.day].t)}</strong> op ${esc(fdate(last.date))}` : "Nog geen trainingen. Begin met Training A en kies rustige gewichten."}</div>
    <details><summary>Zo werkt het</summary><ul>
      <li>Kies een gewicht waarbij je nog 1–2 herhalingen over hebt.</li>
      <li>Haal je bij alle sets het hoogste aantal reps? Volgende keer zwaarder, de app laat het zien.</li>
      <li>Na elke set start de rust-timer vanzelf.</li>
      <li>Minstens 2 dagen tussen A en B, bijvoorbeeld ma + do.</li>
    </ul></details>
  </div>
  <div class="row between"><button class="ghost" data-go="history">📈 Geschiedenis & records</button><span class="mute" id="status">${statusHTML()}</span></div>`;
}

function startDay(k) {
  if (!(S.cur && S.cur.day === k)) {
    S.cur = { day: k, ex: 0, date: Date.now(), log: DAYS[k].x.map(x => ({ id: x[0], kg: S.weights[x[0]] ?? "", sets: [] })) };
    save();
  }
  view = "workout"; render();
}

function workoutHTML() {
  const c = S.cur, d = DAYS[c.day], ex = d.x[c.ex], e = EX[ex[0]], L = c.log[c.ex];
  const done = L.sets.length >= ex[1], setNo = Math.min(L.sets.length, ex[1] - 1), prev = lastFor(ex[0]);
  const pre = prev ? prev.sets[Math.min(L.sets.length, prev.sets.length - 1)].reps : ex[2];
  const totalSets = d.x.reduce((a, x) => a + x[1], 0), doneSets = c.log.reduce((a, l) => a + l.sets.length, 0);
  const plates = Array.from({ length: ex[1] }, (_, i) =>
    `<span class="plate ${i < L.sets.length ? "done" : i === L.sets.length ? "now" : ""}">${i < L.sets.length ? L.sets[i].reps : i + 1}</span>`).join("");
  const hint = topHit(ex, prev) && (L.kg === "" || +L.kg <= +prev.kg) ? `<div class="hint" style="margin-top:6px">🔥 Vorige keer alle sets ${ex[3]}+ → tijd voor zwaarder!</div>` : "";
  return `<div class="top"><button class="ghost" data-go="home">← Pauze</button><span class="mute">${esc(d.t)} · ${c.ex + 1}/${d.x.length}</span></div>
  <div class="bar"><i style="width:${Math.round(doneSets / totalSets * 100)}%"></i></div>
  <div class="card">
    <h2 class="h h2">${esc(e.n)}</h2>
    <div class="mute" style="margin-top:8px">${ex[1]} sets × ${ex[2]}–${ex[3]} reps · ${ex[4]} s rust</div>
    <div class="plates" aria-label="Sets">${plates}</div>
    <div class="field"><label for="kg">Gewicht · ${esc(e.u)}</label>
      <div class="stepper"><button data-kg="-1" aria-label="Minder gewicht">−</button><input id="kg" type="number" inputmode="decimal" step="any" min="0" value="${esc(L.kg)}" placeholder="0"><button data-kg="1" aria-label="Meer gewicht">+</button></div></div>
    ${done ? `<div class="done-box">✔ Alle sets gedaan, door naar de volgende!</div>` :
    `<div class="field"><label for="reps">Reps · set ${setNo + 1}</label>
      <div class="stepper"><button data-rp="-1" aria-label="Minder reps">−</button><input id="reps" type="number" inputmode="numeric" min="0" value="${esc(pre)}"><button data-rp="1" aria-label="Meer reps">+</button></div></div>`}
    ${prev ? `<div class="prev">Vorige keer: <strong>${kg(prev.kg)} kg</strong> · ${prev.sets.map(s => s.reps).join(" / ")} reps${hint}</div>` : ""}
    <details><summary>Uitleg & voorbeeld</summary><ul>${e.c.map(t => `<li>${esc(t)}</li>`).join("")}</ul>
      <a class="btn yt" href="${yt(e.n)}" target="_blank" rel="noopener">▶ Bekijk op YouTube</a></details>
  </div>
  ${done ? `<button class="primary" data-act="nextex">${c.ex < d.x.length - 1 ? "Volgende oefening →" : "Training afronden 🏁"}</button>`
         : `<button class="primary" data-act="set">Set ${setNo + 1} klaar</button>`}
  <div class="row between" style="margin-top:10px">
    <button class="ghost" data-act="prevex" ${c.ex === 0 ? "disabled" : ""}>← Vorige</button>
    ${L.sets.length ? `<button class="ghost" data-act="undo">↶ Set terug</button>` : ""}
    <button class="ghost" data-act="skipex">${c.ex < d.x.length - 1 ? "Overslaan →" : "Afronden"}</button>
  </div>`;
}

function readKg() {
  const i = $("#kg"); if (!i || !S.cur) return;
  const v = i.value.trim().replace(",", ".");
  S.cur.log[S.cur.ex].kg = v === "" ? "" : Math.max(0, +v || 0);
}
function logSet() {
  readKg();
  const c = S.cur, ex = DAYS[c.day].x[c.ex], L = c.log[c.ex];
  L.sets.push({ reps: Math.max(0, parseInt($("#reps").value, 10) || 0) });
  if (L.kg !== "") S.weights[L.id] = L.kg;
  const lastSet = L.sets.length >= ex[1], lastEx = c.ex >= DAYS[c.day].x.length - 1;
  if (lastSet && lastEx) { finish(); return; }
  if (lastSet) c.ex++;
  save(); render();
  const n = DAYS[c.day].x[c.ex], nl = c.log[c.ex];
  startRest(ex[4], lastSet ? `Hierna: ${EX[n[0]].n}` : `Hierna: set ${nl.sets.length + 1} van ${n[1]}`);
}
function finish() {
  const c = S.cur;
  c.log.forEach(l => { if (l.kg !== "" && l.sets.length) S.weights[l.id] = l.kg; });
  const entry = { day: c.day, date: c.date, log: c.log.filter(l => l.sets.length) };
  if (entry.log.length) S.history.push(entry);
  lastDone = entry; S.cur = null; view = "done"; save(); render();
}

function doneHTML() {
  const e = lastDone, d = DAYS[e.day];
  const vol = e.log.reduce((a, l) => a + l.sets.reduce((b, s) => b + s.reps * (+l.kg || 0), 0), 0);
  const rows = e.log.map(l => {
    const ex = d.x.find(x => x[0] === l.id), up = topHit(ex, l);
    return `<li><span>${esc(EX[l.id].n)}${up ? `<br><span class="hint" style="font-size:14px">⬆ Volgende keer zwaarder</span>` : ""}</span><span class="num">${kg(l.kg)} kg<br><span class="mute">${l.sets.map(s => s.reps).join(" / ")}</span></span></li>`;
  }).join("");
  return `<div style="text-align:center;margin:10px 0 18px"><div style="font-size:56px">💪</div><h1 class="h h1">Gesloopt!</h1>
    <div class="mute">${esc(d.t)} · ${esc(fdate(e.date))} · ${Math.round(vol)} kg verplaatst</div></div>
  <div class="card"><ul class="list">${rows || "<li>Geen sets gelogd.</li>"}</ul></div>
  <div class="card mute">Volgende keer: <strong style="color:var(--ink)">${esc(DAYS[nextDay()].t)}</strong>. Minstens 2 dagen rust ertussen.</div>
  <button class="primary" data-go="home">Terug</button>`;
}

function historyHTML() {
  const rec = {};
  S.history.forEach(h => h.log.forEach(l => { const k = +l.kg || 0; if (!rec[l.id] || k > rec[l.id]) rec[l.id] = k; }));
  const recRows = Object.keys(EX).filter(id => rec[id] != null).map(id => `<li><span>${esc(EX[id].n)}</span><span class="num"><strong>${kg(rec[id])} kg</strong></span></li>`).join("");
  const h = S.history.slice().reverse();
  return `<div class="top"><button class="ghost" data-go="home">← Terug</button><h2 class="h h2">Progressie</h2></div>
  <div class="card"><div class="mute" style="margin-bottom:4px">🏆 Zwaarste gewicht per oefening</div><ul class="list">${recRows || "<li class='mute'>Nog geen records.</li>"}</ul></div>
  ${h.map((e, i) => `<div class="card"><div class="row between"><span><strong>${esc(DAYS[e.day].t)}</strong> <span class="mute">· ${esc(fdate(e.date))}</span></span><button class="ghost" data-del="${S.history.length - 1 - i}" aria-label="Verwijder training">✕</button></div>
    <ul class="list" style="margin-top:4px">${e.log.map(l => `<li><span>${esc(EX[l.id].n)}</span><span class="num">${kg(l.kg)} kg · ${l.sets.map(s => s.reps).join("/")}</span></li>`).join("")}</ul></div>`).join("")}`;
}

function settingsHTML() {
  return `<div class="top"><button class="ghost" data-go="home">← Terug</button><h2 class="h h2">Instellingen</h2></div>
  <div class="card"><label for="name" class="mute">Je naam</label>
    <input id="name" class="text" maxlength="30" value="${esc(S.name)}" placeholder="Naam" style="margin-top:6px"></div>
  <div class="card"><div class="mute" style="margin-bottom:6px">Jouw sync-code</div><div class="code">${esc(code)}</div>
    <p class="mute">Hiermee staan je trainingen in de cloud. Bewaar de code. Op een nieuwe telefoon vul je hem hieronder in en is alles terug. Deel hem met niemand anders.</p>
    <div class="row"><button data-act="copycode">Kopieer code</button><span id="copyMsg" class="mute"></span></div>
    <div class="mute" style="margin-top:10px" id="status">${statusHTML()}</div></div>
  <div class="card"><label for="link" class="mute">Code van ander toestel invullen</label>
    <input id="link" class="text" autocapitalize="characters" autocomplete="off" placeholder="20 tekens" style="margin-top:6px">
    <div class="row" style="margin-top:8px"><button data-act="link">Koppelen</button><span id="linkMsg" class="mute"></span></div>
    <p class="mute" style="margin-bottom:0">Let op: de gegevens op dit toestel worden dan vervangen door die van de code.</p></div>`;
}

/* ============ RUST TIMER ============ */
let rEnd = 0, rTot = 0, rInt = null;
function startRest(sec, next) {
  rTot = sec; rEnd = Date.now() + sec * 1000;
  $("#restNext").textContent = next; $("#rest").classList.add("on");
  clearInterval(rInt); rInt = setInterval(tick, 250); tick();
}
function tick() {
  const left = Math.max(0, Math.ceil((rEnd - Date.now()) / 1000));
  $("#restT").textContent = Math.floor(left / 60) + ":" + String(left % 60).padStart(2, "0");
  $("#prog").style.strokeDashoffset = (326.7 * (1 - left / Math.max(rTot, 1))).toFixed(1);
  const l = $("#restLbl"); l.textContent = left ? "RUST" : "GAAN!"; l.classList.toggle("go", !left);
  if (!left && rInt) { clearInterval(rInt); rInt = null; beep(); }
}
$("#restSkip").addEventListener("click", () => { clearInterval(rInt); rInt = null; $("#rest").classList.remove("on"); });
$("#restPlus").addEventListener("click", () => { rEnd += 15000; rTot += 15; if (!rInt) rInt = setInterval(tick, 250); tick(); });
$("#restMinus").addEventListener("click", () => { rEnd -= 15000; tick(); });

/* ============ EVENTS ============ */
let delArm = null;
document.addEventListener("click", async ev => {
  unlock();
  const b = ev.target.closest("button,[data-go]"); if (!b) return;
  if (b.dataset.start) { startDay(b.dataset.start); return; }
  if (b.dataset.go) { if (view === "workout") { readKg(); save(); } view = b.dataset.go; render(); return; }
  if (b.dataset.kg) {
    const i = $("#kg"), e = EX[S.cur.log[S.cur.ex].id];
    i.value = Math.round(Math.max(0, (parseFloat(i.value.replace(",", ".")) || 0) + e.inc * +b.dataset.kg) * 10) / 10;
    readKg(); save(); return;
  }
  if (b.dataset.rp) { const i = $("#reps"); i.value = Math.max(0, (parseInt(i.value, 10) || 0) + +b.dataset.rp); return; }
  if (b.dataset.del != null) {
    const idx = +b.dataset.del;
    if (delArm !== idx) { delArm = idx; b.textContent = "Zeker?"; return; }
    S.history.splice(idx, 1); delArm = null; save(); render(); return;
  }
  const a = b.dataset.act, c = S.cur;
  if (a === "set") logSet();
  else if (a === "nextex" || a === "skipex") { readKg(); if (c.ex < DAYS[c.day].x.length - 1) { c.ex++; save(); render(); } else finish(); }
  else if (a === "prevex") { readKg(); c.ex = Math.max(0, c.ex - 1); save(); render(); }
  else if (a === "undo") { c.log[c.ex].sets.pop(); save(); render(); }
  else if (a === "copycode") {
    try { await navigator.clipboard.writeText(code); $("#copyMsg").textContent = "Gekopieerd ✔"; }
    catch (e) { $("#copyMsg").textContent = "Kopiëren lukt niet, schrijf hem over"; }
  }
  else if (a === "link") {
    const v = $("#link").value.trim().toUpperCase().replace(/\s/g, ""), m = $("#linkMsg");
    if (!/^[A-Z0-9]{20}$/.test(v)) { m.textContent = "Code moet 20 tekens zijn"; return; }
    if (!db) { m.textContent = "Geen cloudverbinding"; return; }
    const old = code; code = v;
    try { await cloudPull(true); localStorage.setItem(CODEKEY, code); m.textContent = "Gekoppeld ✔"; setTimeout(() => { view = "home"; render(); }, 700); }
    catch (e) { code = old; m.textContent = "Code niet gevonden"; }
  }
});
document.addEventListener("change", ev => {
  if (ev.target.id === "kg") { readKg(); save(); }
  if (ev.target.id === "name") { S.name = ev.target.value.trim().slice(0, 30); save(); }
});
document.addEventListener("visibilitychange", () => {
  if (document.hidden) return;
  if ($("#rest").classList.contains("on")) tick();
  if (view === "workout") keepAwake(true);
});

render();
cloudInit();
if ("serviceWorker" in navigator) navigator.serviceWorker.register("sw.js").catch(() => {});
