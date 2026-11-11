// Timed mock exam shared by every state. The page sets window.LHEP_EXAM, loads the question banks
// and the state's blueprints (window.LHEP_MOCKS, from states/<code>/exams.js), then this file.
// Like the real exam: four-option questions only, the same number per section, no feedback until
// you submit, then a score report by section. Answered questions also count on the practice test,
// so misses join its missed list and retake test.
(function () {
const EXAM = window.LHEP_EXAM;
const MOCKS = window.LHEP_MOCKS || {};
const KEY = `lhep-${EXAM.state.toLowerCase()}-mock-v1`;
const PRACTICE_KEY = `lhep-${EXAM.state.toLowerCase()}-v1`;
const LETTERS = ["A", "B", "C", "D"];
const HISTORY_MAX = 20;
const COLORS = { life: "var(--orange)", health: "var(--blue)" };

const TOPICS = {};
const BY_ID = {};
for (const b of LHEP.banks) {
  Object.assign(TOPICS, b.meta.topics);
  for (const q of b.questions) BY_ID[q.id] = Object.assign({}, q, { srcInfo: q.src ? b.meta.sources[q.src] : null });
}
const QS = Object.values(BY_ID);
for (const [k, m] of Object.entries(MOCKS)) {
  for (const s of m.sections) for (const t of s.topics) {
    if (!TOPICS[t]) throw new Error(`Mock "${k}", section "${s.name}": unknown topic ${t}`);
  }
}
const sectionOf = (exam, id) => MOCKS[exam].sections.findIndex(s => s.topics.includes(BY_ID[id].topic));
const poolFor = s => QS.filter(q => q.type === "mc" && s.topics.includes(q.topic)).map(q => q.id);
const colorOf = exam => COLORS[exam] || "var(--indigo)";

// current: the mock in progress, or null. history: finished mocks, newest first.
// lastIds: the questions used in the last mock of each exam, so the next one favors new ones.
const st = { current: null, history: [], lastIds: {} };
let reportIndex = null; // which history entry is on screen, or null for the start page
let confirming = null;  // "submit" or "quit" while asking to confirm
let timer = null;

const asObj = x => (x && typeof x === "object" && !Array.isArray(x) ? x : {});
function load() {
  try {
    const s = JSON.parse(localStorage.getItem(KEY) || "null");
    if (!s || typeof s !== "object") return;
    const c = s.current;
    if (c && MOCKS[c.exam] && Array.isArray(c.ids)) {
      const ids = c.ids.filter(id => BY_ID[id]);
      if (ids.length) {
        st.current = {
          exam: c.exam, ids, answers: asObj(c.answers),
          flags: Array.isArray(c.flags) ? c.flags.filter(id => ids.includes(id)) : [],
          start: Number(c.start) || Date.now(), deadline: Number(c.deadline) || Date.now(),
          pos: Number.isInteger(c.pos) && c.pos >= 0 && c.pos < ids.length ? c.pos : 0
        };
      }
    }
    if (Array.isArray(s.history)) {
      st.history = s.history.filter(r => r && MOCKS[r.exam] && Array.isArray(r.ids) && Array.isArray(r.sections)).slice(0, HISTORY_MAX);
    }
    st.lastIds = asObj(s.lastIds);
  } catch (e) { /* storage unavailable: start fresh */ }
}
function save() {
  try { localStorage.setItem(KEY, JSON.stringify(st)); } catch (e) { /* ignore */ }
}

function h(tag, attrs, ...kids) {
  const el = document.createElement(tag);
  if (attrs) {
    for (const [k, v] of Object.entries(attrs)) {
      if (v == null || v === false) continue;
      if (k === "class") el.className = v;
      else if (k === "style") el.style.cssText = v;
      else if (k.startsWith("on")) el.addEventListener(k.slice(2), v);
      else el.setAttribute(k, v === true ? "" : v);
    }
  }
  for (const kid of kids.flat()) {
    if (kid == null || kid === false) continue;
    el.append(kid.nodeType ? kid : document.createTextNode(String(kid)));
  }
  return el;
}
const $ = sel => document.querySelector(sel);
function shuffled(ids) {
  ids = ids.slice();
  for (let i = ids.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [ids[i], ids[j]] = [ids[j], ids[i]];
  }
  return ids;
}
function clock(ms) {
  const s = Math.max(0, Math.ceil(ms / 1000));
  const hr = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60), sec = s % 60;
  return (hr ? `${hr}:${String(m).padStart(2, "0")}` : String(m)) + ":" + String(sec).padStart(2, "0");
}
const day = ms => new Date(ms).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
const optText = (q, i) => (Number.isInteger(i) ? `${LETTERS[i]}. ${q.opts[i]}` : "No answer");

// ---- Starting, answering and submitting ----

// Each section draws its count at random, using questions left out of the last mock first.
function draw(exam) {
  const recent = new Set(st.lastIds[exam] || []);
  let ids = [];
  for (const s of MOCKS[exam].sections) {
    const pool = poolFor(s);
    const fresh = shuffled(pool.filter(id => !recent.has(id)));
    const used = shuffled(pool.filter(id => recent.has(id)));
    ids = ids.concat(fresh.concat(used).slice(0, s.count));
  }
  return shuffled(ids);
}
function start(exam) {
  const ids = draw(exam);
  const now = Date.now();
  st.current = { exam, ids, answers: {}, flags: [], start: now, deadline: now + MOCKS[exam].minutes * 60000, pos: 0 };
  st.lastIds[exam] = ids;
  reportIndex = null;
  confirming = null;
  render();
  window.scrollTo(0, 0);
}
function pick(i) {
  const c = st.current;
  if (!c) return;
  const id = c.ids[c.pos];
  if (i < 0 || i >= BY_ID[id].opts.length) return;
  c.answers[id] = i;
  confirming = null;
  render();
  const btn = document.querySelector(`.opt[data-i="${i}"]`);
  if (btn) btn.focus({ preventScroll: true });
}
function toggleFlag() {
  const c = st.current;
  const id = c.ids[c.pos];
  c.flags = c.flags.includes(id) ? c.flags.filter(x => x !== id) : c.flags.concat(id);
  render();
}
function goTo(pos) {
  const c = st.current;
  if (!c || pos < 0 || pos >= c.ids.length) return;
  c.pos = pos;
  confirming = null;
  render();
  const card = $("#card");
  if (card && card.getBoundingClientRect().top < 0) card.scrollIntoView({ block: "start" });
}
function submit(timedOut) {
  const c = st.current;
  if (!c) return;
  const m = MOCKS[c.exam];
  const sections = m.sections.map(s => ({ name: s.name, right: 0, total: 0 }));
  let right = 0;
  for (const id of c.ids) {
    const s = sections[sectionOf(c.exam, id)];
    s.total++;
    if (c.answers[id] === BY_ID[id].ans) { s.right++; right++; }
  }
  const score = Math.round((right / c.ids.length) * 100);
  const rec = {
    exam: c.exam, date: Date.now(), ids: c.ids, answers: c.answers, right, total: c.ids.length, score,
    pass: score >= m.pass, sections, usedMs: Math.min(Date.now(), c.deadline) - c.start, timedOut: !!timedOut
  };
  st.history.unshift(rec);
  st.history = st.history.slice(0, HISTORY_MAX);
  st.current = null;
  addToPractice(rec);
  reportIndex = 0;
  confirming = null;
  render();
  window.scrollTo(0, 0);
}
function quit() {
  st.current = null;
  confirming = null;
  render();
  window.scrollTo(0, 0);
}
// Answered questions update the practice test's record, the same way its retake test does.
function addToPractice(rec) {
  try {
    const p = asObj(JSON.parse(localStorage.getItem(PRACTICE_KEY) || "null"));
    p.answers = asObj(p.answers);
    for (const id of rec.ids) {
      const a = rec.answers[id];
      if (Number.isInteger(a)) p.answers[id] = { choice: a, correct: a === BY_ID[id].ans };
    }
    localStorage.setItem(PRACTICE_KEY, JSON.stringify(p));
  } catch (e) { /* ignore */ }
}

// ---- Timer ----

function tick() {
  const c = st.current;
  if (!c) { stopTimer(); return; }
  const ms = c.deadline - Date.now();
  if (ms <= 0) { stopTimer(); submit(true); return; }
  for (const el of document.querySelectorAll("[data-timer]")) {
    el.textContent = clock(ms);
    el.classList.toggle("warn", ms <= 10 * 60000 && ms > 5 * 60000);
    el.classList.toggle("low", ms <= 5 * 60000);
  }
}
function startTimer() { if (!timer) timer = setInterval(tick, 1000); tick(); }
function stopTimer() { if (timer) { clearInterval(timer); timer = null; } }

// ---- Views ----

function renderStart(app) {
  const cards = Object.entries(MOCKS).map(([k, m]) => {
    const total = m.sections.reduce((n, s) => n + s.count, 0);
    return h("article", { class: "exam-card", style: `--c:${colorOf(k)}` },
      h("div", { class: "ec-body" },
        h("p", { class: "eyebrow" }, `${m.short} exam`),
        h("h2", null, m.name),
        h("p", { class: "ec-facts" }, `${total} questions · ${m.minutes} minutes · ${m.pass}% to pass`),
        h("table", { class: "ec-table" },
          h("caption", { class: "sr-only" }, `Questions per section, ${m.name}`),
          h("tbody", null, m.sections.map(s => h("tr", null, h("td", null, s.name), h("td", { class: "num" }, String(s.count))))))),
      h("div", { class: "ec-foot" },
        h("button", { class: "btn primary", type: "button", onclick: () => start(k) }, `Start the ${m.short.toLowerCase()} mock →`)));
  });

  const kids = [
    h("div", { class: "mock-cards" }, cards),
    h("section", { class: "rules", "aria-labelledby": "rules-h" },
      h("h2", { id: "rules-h" }, "How it works"),
      h("ul", null,
        h("li", null, "Each section has the same number of questions as the real exam, drawn at random. Questions you saw in your last mock come up last."),
        h("li", null, "No answers are shown until you submit. You can change answers and flag questions to come back to."),
        h("li", null, "The real exam gives 75 minutes for 60 questions, 5 of them unscored. The mock keeps that pace: 55 scored questions in 69 minutes. It submits itself when time runs out."),
        h("li", null, "Your report shows a score for each section, like the Pearson VUE diagnostic report. Questions you miss are added to the practice test's retake list.")))
  ];

  if (st.history.length) {
    kids.push(h("section", { class: "history", "aria-labelledby": "hist-h" },
      h("h2", { id: "hist-h" }, "Your mock results"),
      h("div", { class: "hist-wrap" },
        h("table", { class: "hist" },
          h("thead", null, h("tr", null, h("th", null, "Date"), h("th", null, "Exam"), h("th", { class: "num" }, "Score"), h("th", null, "Result"), h("th", null, h("span", { class: "sr-only" }, "Report")))),
          h("tbody", null, st.history.map((r, i) => h("tr", null,
            h("td", null, day(r.date)),
            h("td", null, MOCKS[r.exam].short),
            h("td", { class: "num" }, `${r.score}%`),
            h("td", null, h("span", { class: `verdict small ${r.pass ? "pass" : "fail"}` }, r.pass ? "Pass" : "Fail")),
            h("td", null, h("button", { class: "linklike", type: "button", onclick: () => { reportIndex = i; render(); window.scrollTo(0, 0); } }, "View report")))))))));
  }
  app.replaceChildren(...kids);
}

function renderExam(app) {
  const c = st.current;
  const m = MOCKS[c.exam];
  const id = c.ids[c.pos];
  const q = BY_ID[id];
  const chosen = c.answers[id];
  const flagged = c.flags.includes(id);
  const answered = c.ids.filter(x => Number.isInteger(c.answers[x])).length;
  const unanswered = c.ids.length - answered;
  const color = colorOf(c.exam);

  const opts = h("ol", { class: "options", "aria-labelledby": "qtext" },
    q.opts.map((text, i) => h("li", null, h("button", {
      class: `opt${chosen === i ? " is-picked" : ""}`, type: "button", "data-i": String(i),
      "aria-pressed": String(chosen === i), onclick: () => pick(i)
    }, h("span", { class: "key" }, LETTERS[i]), h("span", null, text), chosen === i ? h("span", { class: "mark" }, "Your answer") : null))));

  const card = h("article", { class: "card", id: "card", style: `--c:${color}` },
    h("div", { class: "card-body" },
      h("div", { class: "meta" },
        h("span", { class: "tags" }, h("span", { class: "part-tag" }, h("span", { class: "dot" }), `Mock exam · ${m.short}`)),
        h("span", { class: "where" }, `Question ${c.pos + 1} of ${c.ids.length} · `, h("span", { class: "timer-inline", "data-timer": "" }, ""), " left")),
      h("h2", { class: "qtext", id: "qtext" }, h("span", { class: "qnum" }, `${c.pos + 1}.`), q.q),
      opts,
      h("div", { class: "row" },
        h("button", { class: "btn small flag", type: "button", "aria-pressed": String(flagged), onclick: toggleFlag }, flagged ? "Flagged for review" : "Flag for review"))));

  const last = c.pos === c.ids.length - 1;
  const nav = h("div", { class: "nav-row" },
    h("button", { class: "btn", type: "button", disabled: c.pos === 0, onclick: () => goTo(c.pos - 1) }, "← Previous"),
    h("span", { class: "nav-pos" }, `${answered} of ${c.ids.length} answered`),
    last
      ? h("button", { class: "btn primary", type: "button", onclick: () => { confirming = "submit"; render(); } }, "Review and submit")
      : h("button", { class: "btn primary", type: "button", onclick: () => goTo(c.pos + 1) }, "Next →"));

  const cells = c.ids.map((x, i) => {
    const a = Number.isInteger(c.answers[x]);
    const f = c.flags.includes(x);
    return h("button", {
      class: `qcell${a ? " answered" : ""}${f ? " flagged" : ""}${i === c.pos ? " current" : ""}`, type: "button",
      "aria-label": `Question ${i + 1}, ${a ? "answered" : "not answered"}${f ? ", flagged" : ""}`,
      onclick: () => goTo(i)
    }, String(i + 1));
  });

  let actions;
  if (confirming === "submit") {
    const notes = [];
    if (unanswered) notes.push(`${unanswered} unanswered (they count as wrong)`);
    if (c.flags.length) notes.push(`${c.flags.length} flagged`);
    actions = h("div", { class: "confirm-box" },
      h("p", { class: "confirm" }, notes.length ? `Submit with ${notes.join(" and ")}?` : "Submit your exam?"),
      h("p", { class: "sub" }, "You can't change answers after you submit."),
      h("div", { class: "score-actions" },
        h("button", { class: "btn small primary", type: "button", onclick: () => submit(false) }, "Submit exam"),
        h("button", { class: "btn small", type: "button", onclick: () => { confirming = null; render(); } }, "Keep working")));
  } else if (confirming === "quit") {
    actions = h("div", { class: "confirm-box" },
      h("p", { class: "confirm" }, "Quit this mock without a score?"),
      h("div", { class: "score-actions" },
        h("button", { class: "btn small danger", type: "button", onclick: quit }, "Quit mock"),
        h("button", { class: "btn small", type: "button", onclick: () => { confirming = null; render(); } }, "Keep working")));
  } else {
    actions = h("div", { class: "score-actions" },
      h("button", { class: "btn small primary", type: "button", onclick: () => { confirming = "submit"; render(); } }, "Submit exam"),
      h("button", { class: "btn small", type: "button", onclick: () => { confirming = "quit"; render(); } }, "Quit"));
  }

  const panel = h("aside", { class: "score mock-panel", style: `--c:${color}`, "aria-label": "Exam status" },
    h("div", null,
      h("h2", null, "Time left"),
      h("div", { class: "big timer", "data-timer": "", role: "timer" }, ""),
      h("p", { class: "sub" }, `${answered} answered · ${unanswered} left · ${c.flags.length} flagged`)),
    h("div", null,
      h("div", { class: "qgrid mock-grid" }, cells),
      h("p", { class: "grid-key" },
        h("span", null, h("i", { class: "k answered" }), "Answered"),
        h("span", null, h("i", { class: "k flagged" }), "Flagged"))),
    actions);

  app.replaceChildren(h("div", { class: "layout" },
    h("section", { class: "stage", "aria-live": "polite" }, card, nav,
      h("p", { class: "hint" }, "Keys: ", h("kbd", null, "A"), "–", h("kbd", null, "D"), " to answer, ", h("kbd", null, "F"), " to flag, ", h("kbd", null, "←"), " ", h("kbd", null, "→"), " to move.")),
    panel));
  startTimer();
}

function renderReport(app, r) {
  const m = MOCKS[r.exam];
  const color = colorOf(r.exam);
  const missed = r.ids.filter(id => r.answers[id] !== BY_ID[id].ans);
  const weak = r.sections.map((s, i) => ({ s, i, pct: s.total ? Math.round((s.right / s.total) * 100) : 0 })).filter(x => x.pct < m.pass);

  // Missed questions grouped by study guide topic, most-missed first
  const byTopic = {};
  for (const id of missed) (byTopic[BY_ID[id].topic] = byTopic[BY_ID[id].topic] || []).push(id);
  const focus = Object.entries(byTopic).sort((x, y) => y[1].length - x[1].length);

  const diag = h("div", { class: "diag" }, r.sections.map(s => {
    const pct = s.total ? Math.round((s.right / s.total) * 100) : 0;
    const ok = pct >= m.pass;
    return h("div", { class: "diag-row", style: `--c:${ok ? "var(--ok)" : "var(--bad)"}` },
      h("span", { class: "diag-name" }, s.name),
      h("span", { class: "diag-num" }, `${s.right}/${s.total} · ${pct}%`),
      h("div", { class: "diag-bar", role: "img", "aria-label": `${s.name}: ${pct}%, passing is ${m.pass}%` },
        h("span", { style: `width:${pct}%` }),
        h("i", { class: "pass-line", style: `left:${m.pass}%` })));
  }));

  const kids = [
    h("div", null,
      h("p", { class: "eyebrow" }, `Mock exam · ${m.name} · ${day(r.date)}`),
      h("div", { class: "res-score" },
        h("span", { class: `verdict ${r.pass ? "pass" : "fail"}` }, r.pass ? "Pass" : "Fail"),
        h("span", { class: "big" }, `${r.score}%`),
        h("span", { class: "res-pct" }, `${r.right} of ${r.total} right · passing score ${m.pass}%`)),
      h("p", { class: "res-sub" }, r.timedOut
        ? `Time ran out after ${clock(r.usedMs)}. Unanswered questions count as wrong.`
        : `Finished in ${clock(r.usedMs)} of ${m.minutes}:00.`)),
    h("h3", { class: "res-h" }, "Diagnostic report"),
    h("p", { class: "res-sub" }, `Each bar shows your score in that section. The line marks ${m.pass}%.`),
    diag
  ];

  if (missed.length) {
    kids.push(
      h("h3", { class: "res-h" }, weak.length ? "Study these first" : "Topics to tighten up"),
      h("ol", { class: "focus-list" }, focus.map(([t, ids]) => h("li", null,
        h("span", { class: "focus-count", title: `${ids.length} missed` }, String(ids.length)),
        h("span", { class: "focus-name" },
          h("strong", null, TOPICS[t].name),
          h("span", { class: "focus-qs" }, `${ids.length} missed`)),
        h("a", { class: "btn small", href: `study-guide.html#topic-${t}` }, "Study topic →")))),
      h("p", { class: "res-sub" }, "Your missed questions were added to the practice test, so its retake test will bring them back."),
      h("h3", { class: "res-h" }, `Questions you missed (${missed.length})`),
      h("ol", { class: "miss-list" }, missed.map(id => {
        const q = BY_ID[id];
        const sec = m.sections[sectionOf(r.exam, id)];
        return h("li", { style: `--c:${color}` },
          h("p", { class: "miss-meta" }, `Question ${r.ids.indexOf(id) + 1} · ${sec ? sec.name : ""}`),
          h("p", { class: "miss-q" }, q.q),
          h("p", { class: "miss-a" }, h("strong", null, "Answer: "), optText(q, q.ans)),
          h("p", { class: "miss-y" }, `Your answer: ${optText(q, r.answers[id])}`),
          h("p", { class: "miss-why" }, q.why, " ",
            h("a", { href: `study-guide.html#topic-${q.topic}` }, `Review: ${TOPICS[q.topic].name}`)));
      })));
  } else {
    kids.push(h("p", { class: "res-sub" }, "You got every question right."));
  }

  kids.push(h("div", { class: "row" },
    h("button", { class: "btn primary", type: "button", onclick: () => start(r.exam) }, `Take another ${m.short.toLowerCase()} mock`),
    missed.length ? h("a", { class: "btn", href: "practice-test.html#retake" }, "Retake missed questions") : null,
    h("button", { class: "btn", type: "button", onclick: () => { reportIndex = null; render(); window.scrollTo(0, 0); } }, "All mock exams")));

  app.replaceChildren(h("article", { class: "card report", style: `--c:${r.pass ? "var(--ok)" : "var(--bad)"}` },
    h("div", { class: "results" }, kids)));
}

function render() {
  const app = $("#app");
  if (st.current && st.current.deadline - Date.now() <= 0) { submit(true); return; }
  if (st.current) renderExam(app);
  else {
    stopTimer();
    if (reportIndex != null && st.history[reportIndex]) renderReport(app, st.history[reportIndex]);
    else { reportIndex = null; renderStart(app); }
  }
  save();
}

document.addEventListener("keydown", e => {
  if (!st.current || e.target.closest("textarea, input, select") || e.metaKey || e.ctrlKey || e.altKey) return;
  const k = e.key.toLowerCase();
  if (k === "arrowright") { goTo(st.current.pos + 1); e.preventDefault(); return; }
  if (k === "arrowleft") { goTo(st.current.pos - 1); e.preventDefault(); return; }
  if (k === "f") { toggleFlag(); e.preventDefault(); return; }
  const i = { a: 0, b: 1, c: 2, d: 3, "1": 0, "2": 1, "3": 2, "4": 3 }[k];
  if (i != null) { pick(i); e.preventDefault(); }
});
// Catch up right away if the tab was in the background when time ran out
document.addEventListener("visibilitychange", () => { if (!document.hidden && st.current) tick(); });

// Exposed for previews and checks
window.LHEP_MOCK = { st, MOCKS, BY_ID, poolFor, draw, start, pick, submit, goTo, render };

load();
render();
})();
