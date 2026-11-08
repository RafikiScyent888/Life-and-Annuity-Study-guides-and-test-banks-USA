// Practice test engine shared by every state. The page sets window.LHEP_EXAM and loads the
// question banks (assets/bank.js, the shared cores and the state's own bank) before this file.
(function () {
const EXAM = window.LHEP_EXAM;
const KEY = `lhep-${EXAM.state.toLowerCase()}-v1`;
const LETTERS = ["A", "B", "C", "D"];

// Seven rainbow parts. Every topic belongs to one part.
const PARTS = {
  A: { name: "Basics, contracts & underwriting", short: "Basics & underwriting", color: "var(--red)" },
  B: { name: "Life policies & provisions", short: "Life policies", color: "var(--orange)" },
  C: { name: "Annuities, retirement & Social Security", short: "Annuities & retirement", color: "var(--yellow)" },
  D: { name: "Health insurance policies", short: "Health policies", color: "var(--green)" },
  E: { name: "Health provisions, group & senior coverage", short: "Health provisions", color: "var(--blue)" },
  F: { name: `${EXAM.stateName} law: life`, short: `${EXAM.state} life law`, color: "var(--indigo)" },
  G: { name: `${EXAM.stateName} law: health`, short: `${EXAM.state} health law`, color: "var(--violet)" }
};

// Gather every bank's topics, sources and questions. Questions run part by part (A to G),
// keeping each bank's order inside a part; n is the number shown on screen.
const TOPICS = {};
let QS = [];
for (const b of LHEP.banks) {
  Object.assign(TOPICS, b.meta.topics);
  for (const q of b.questions) QS.push(Object.assign({}, q, { srcInfo: q.src ? b.meta.sources[q.src] : null }));
}
for (const q of QS) q.part = TOPICS[q.topic].part;
const partOrder = Object.keys(PARTS);
QS = QS.map((q, i) => [q, i]).sort((x, y) => partOrder.indexOf(x[0].part) - partOrder.indexOf(y[0].part) || x[1] - y[1]).map(x => x[0]);
QS.forEach((q, i) => { q.n = i + 1; });
const BY_ID = Object.fromEntries(QS.map(q => [q.id, q]));
const TOTAL = QS.length;

// retake: { ids, answers, round, finished } for the current retake test of missed questions, or null
const st = { answers: {}, filter: "all", list: [], pos: 0, shuffle: false, retake: null };
const revealed = new Set();
let confirming = false;

function load() {
  try {
    const s = JSON.parse(localStorage.getItem(KEY) || "null");
    if (s && typeof s === "object") {
      if (s.answers && typeof s.answers === "object") {
        for (const [id, a] of Object.entries(s.answers)) if (BY_ID[id]) st.answers[id] = a;
      }
      if (typeof s.filter === "string") st.filter = s.filter;
      if (Array.isArray(s.list)) st.list = s.list.filter(id => BY_ID[id]);
      if (Number.isInteger(s.pos)) st.pos = s.pos;
      st.shuffle = !!s.shuffle;
      if (s.retake && Array.isArray(s.retake.ids)) {
        st.retake = {
          ids: s.retake.ids.filter(id => BY_ID[id]),
          answers: s.retake.answers && typeof s.retake.answers === "object" ? s.retake.answers : {},
          round: Number.isInteger(s.retake.round) ? s.retake.round : 1,
          finished: !!s.retake.finished
        };
      }
    }
  } catch (e) { /* storage unavailable: start fresh */ }
  if (st.filter === "retake") {
    if (st.retake) st.list = st.retake.ids.slice(); else st.filter = "all";
  }
  if (st.filter !== "all" && st.filter !== "missed" && st.filter !== "retake" && !PARTS[st.filter]) st.filter = "all";
  if (!st.list.length && st.filter !== "missed" && st.filter !== "retake") st.list = listFor(st.filter);
  if (st.pos < 0 || st.pos > lastPos()) st.pos = 0;
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
      else if (k === "text") el.textContent = v;
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
const topicName = t => TOPICS[t].name;
const topicLink = t => h("a", { href: `study-guide.html#topic-${t}` }, `Review: ${topicName(t)}`);
const sourceLink = s => s ? h("span", null, "Source: ", h("a", { href: s.url, target: "_blank", rel: "noopener" }, s.label)) : null;

function missedIds() {
  return QS.filter(q => st.answers[q.id] && !st.answers[q.id].correct).map(q => q.id);
}
function shuffled(ids) {
  ids = ids.slice();
  for (let i = ids.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [ids[i], ids[j]] = [ids[j], ids[i]];
  }
  return ids;
}
function listFor(filter) {
  let ids;
  if (filter === "all") ids = QS.map(q => q.id);
  else if (filter === "missed") ids = missedIds();
  else ids = QS.filter(q => q.part === filter).map(q => q.id);
  return st.shuffle ? shuffled(ids) : ids;
}

// Retake test: a fresh run through the missed questions. Answers given here also update the
// main record, so a question answered right drops off the missed list. Leaving part way keeps
// the main record as it was for any question not yet retaken.
function inRetake() { return st.filter === "retake" && !!st.retake; }
function ansFor(id) { return inRetake() ? st.retake.answers[id] : st.answers[id]; }
// A retake is finished once its results have been shown, even if some questions were skipped.
function retakeInProgress() { return !!st.retake && !st.retake.finished && st.retake.ids.some(id => !st.retake.answers[id]); }
// In a retake, the position just past the last question shows the results.
function lastPos() { return st.filter === "retake" ? st.list.length : st.list.length - 1; }
function startRetake(ids) {
  ids = ids || missedIds();
  if (!ids.length) { st.filter = "missed"; st.list = []; st.pos = 0; render(); return; }
  ids = st.shuffle ? shuffled(ids) : ids.slice();
  st.retake = { ids, answers: {}, round: (st.retake ? st.retake.round : 0) + 1 };
  ids.forEach(id => revealed.delete(id));
  st.filter = "retake";
  st.list = ids.slice();
  st.pos = 0;
  render();
  const card = $("#card");
  if (card.getBoundingClientRect().top < 0) card.scrollIntoView({ block: "start" });
}
function resumeRetake() {
  st.filter = "retake";
  st.list = st.retake.ids.slice();
  const next = st.list.findIndex(id => !st.retake.answers[id]);
  st.pos = next < 0 ? st.list.length : next;
  render();
}
function openRetake() { if (retakeInProgress()) resumeRetake(); else startRetake(); }
function setFilter(f) {
  st.filter = f;
  st.list = listFor(f);
  st.pos = 0;
  render();
}
function current() { return BY_ID[st.list[st.pos]]; }
function go(delta) {
  const p = st.pos + delta;
  if (p < 0 || p > lastPos()) return;
  st.pos = p;
  render();
}
function jump(id) {
  if (!st.list.includes(id)) { st.filter = "all"; st.list = listFor("all"); }
  st.pos = st.list.indexOf(id);
  render();
}
function record(q, result) {
  if (inRetake()) st.retake.answers[q.id] = result;
  st.answers[q.id] = result;
}
function answer(i) {
  const q = current();
  if (!q || q.type === "sa" || ansFor(q.id) || i < 0 || i >= q.opts.length) return;
  record(q, { choice: i, correct: i === q.ans });
  render();
  $("#next").focus({ preventScroll: true });
}
function selfGrade(ok) {
  const q = current();
  record(q, { choice: null, correct: ok });
  render();
  $("#next").focus({ preventScroll: true });
}
function retry(id) {
  if (inRetake()) delete st.retake.answers[id]; else delete st.answers[id];
  revealed.delete(id);
  render();
}

function partStats(part) {
  const qs = QS.filter(q => q.part === part);
  let answered = 0, right = 0;
  for (const q of qs) {
    const a = st.answers[q.id];
    if (a) { answered++; if (a.correct) right++; }
  }
  return { total: qs.length, answered, right };
}

function renderSpectrum() {
  const segs = [], legend = [];
  for (const [k, p] of Object.entries(PARTS)) {
    const s = partStats(k);
    if (!s.total) continue;
    segs.push(h("div", { class: "seg", style: `--c:${p.color};flex:${s.total} 1 0`, title: `Part ${k}: ${s.answered} of ${s.total} answered` },
      h("span", { style: `width:${(s.answered / s.total) * 100}%` })));
    legend.push(h("span", { style: `flex:${s.total} 1 0` }, k, h("span", { class: "lg-n" }, ` ${s.answered}/${s.total}`)));
  }
  $("#spectrum").replaceChildren(...segs);
  const answered = Object.keys(st.answers).length;
  $("#spectrum").setAttribute("aria-label", `${answered} of ${TOTAL} questions answered`);
  $("#legend").replaceChildren(...legend);
}

function chip(f, label, color, count) {
  return h("button", {
    class: "chip", type: "button", "aria-pressed": String(st.filter === f),
    style: color ? `--c:${color}` : null,
    onclick: () => setFilter(f)
  }, h("span", { class: color ? "dot" : "dot rainbow" }), label, h("span", { class: "count" }, count));
}
function renderChips() {
  const answered = Object.keys(st.answers).length;
  const kids = [chip("all", "All", null, `${answered}/${TOTAL}`)];
  for (const [k, p] of Object.entries(PARTS)) {
    const s = partStats(k);
    if (s.total) kids.push(chip(k, `${k} · ${p.short}`, p.color, `${s.answered}/${s.total}`));
  }
  kids.push(chip("missed", "Missed", "var(--bad)", String(missedIds().length)));
  const showProgress = inRetake() || retakeInProgress();
  kids.push(h("button", {
    class: "chip", type: "button", "aria-pressed": String(st.filter === "retake"), style: "--c:var(--bad)",
    onclick: openRetake
  }, h("span", { class: "dot" }), retakeInProgress() && !inRetake() ? "Resume retake" : "Retake test",
    h("span", { class: "count" }, showProgress ? `${Object.keys(st.retake.answers).length}/${st.retake.ids.length}` : String(missedIds().length))));
  $("#chips").replaceChildren(...kids);
  $("#shuffle").checked = st.shuffle;
}

const optLabel = (q, i) => q.type === "mc" ? `${LETTERS[i]}. ${q.opts[i]}` : q.opts[i];

function missItem(q, a) {
  const answerText = q.type === "sa" ? q.model : optLabel(q, q.ans);
  const yours = !a ? "Skipped" : q.type === "sa" ? "You marked it missed" : optLabel(q, a.choice);
  return h("li", { style: `--c:${PARTS[q.part].color}` },
    h("p", { class: "miss-meta" }, `Question ${q.n} · Part ${q.part} · `, h("button", { class: "linklike", type: "button", onclick: () => jump(q.id) }, "Open question")),
    h("p", { class: "miss-q" }, q.q),
    h("p", { class: "miss-a" }, h("strong", null, "Answer: "), answerText),
    h("p", { class: "miss-y" }, `Your answer: ${yours}`),
    q.why ? h("p", { class: "miss-why" }, q.why) : null);
}

function renderResults(card) {
  const r = st.retake;
  const res = r.ids.map(id => ({ q: BY_ID[id], a: r.answers[id] }));
  const right = res.filter(x => x.a && x.a.correct).length;
  const still = res.filter(x => !x.a || !x.a.correct);
  const skipped = res.filter(x => !x.a).length;
  const pct = Math.round((right / res.length) * 100);
  // Group what's still missed by study guide topic, most-missed first
  const groups = {};
  for (const { q } of still) (groups[q.topic] = groups[q.topic] || []).push(q);
  const focus = Object.entries(groups).sort((x, y) => y[1].length - x[1].length || x[1][0].n - y[1][0].n);
  card.style.cssText = `--c:${still.length ? "var(--bad)" : "var(--ok)"}`;

  let summary;
  if (!still.length) summary = "You got every one right, so they're off your missed list.";
  else if (skipped) summary = `${still.length - skipped} still missed and ${skipped} skipped. Study the topics below, then retake them.`;
  else summary = `${still.length} still missed. Study the topics below, then retake them.`;

  const body = h("div", { class: "results" },
    h("div", null,
      h("p", { class: "eyebrow" }, `Retake round ${r.round} · results`),
      h("div", { class: "res-score" },
        h("span", { class: "big" }, `${right}/${res.length}`),
        h("span", { class: "res-pct" }, `${pct}% right`)),
      h("p", { class: "res-sub" }, summary)));

  if (still.length) {
    body.append(
      h("h3", { class: "res-h" }, "Study these topics next"),
      h("ol", { class: "focus-list" }, focus.map(([t, qs]) => h("li", null,
        h("span", { class: "focus-count", title: `${qs.length} missed` }, String(qs.length)),
        h("span", { class: "focus-name" },
          h("strong", null, topicName(t)),
          h("span", { class: "focus-qs" }, `${qs.length === 1 ? "Question" : "Questions"} ${qs.map(q => q.n).join(", ")}`)),
        h("a", { class: "btn small", href: `study-guide.html#topic-${t}` }, "Study topic →")))),
      h("h3", { class: "res-h" }, "Questions to review"),
      h("ol", { class: "miss-list" }, still.map(({ q, a }) => missItem(q, a))),
      h("div", { class: "row" },
        h("button", { class: "btn primary", type: "button", onclick: () => startRetake(still.map(x => x.q.id)) }, `Retake the ${still.length} still missed`),
        h("button", { class: "btn", type: "button", onclick: () => setFilter("all") }, "Back to all questions")));
  } else {
    const more = missedIds().length;
    body.append(h("div", { class: "row" },
      h("button", { class: "btn primary", type: "button", onclick: () => setFilter("all") }, "Back to all questions"),
      more ? h("button", { class: "btn", type: "button", onclick: () => startRetake() }, `Retake the other ${more} missed`) : null));
  }
  card.replaceChildren(body);
}

function renderCard() {
  const card = $("#card");
  if (inRetake() && st.pos >= st.list.length) { renderResults(card); return; }
  const q = current();
  if (!q) {
    card.style.cssText = "--c:var(--ok)";
    card.replaceChildren(h("div", { class: "empty" },
      h("h2", null, st.filter === "missed" ? "No missed questions" : "Nothing here yet"),
      h("p", null, st.filter === "missed" ? "Every question you've answered is right. Pick a part to keep going." : "Pick a part to start.")));
    return;
  }
  const p = PARTS[q.part];
  const a = ansFor(q.id);
  card.style.cssText = `--c:${p.color}`;

  const meta = h("div", { class: "meta" },
    h("span", { class: "tags" },
      inRetake() ? h("span", { class: "retake-tag" }, `Retake ${st.pos + 1} of ${st.list.length}`) : null,
      h("span", { class: "part-tag" }, h("span", { class: "dot" }), `Part ${q.part} · ${p.name}`)),
    h("span", { class: "where" }, `Question ${q.n} of ${TOTAL}`));
  const qtext = h("h2", { class: "qtext", id: "qtext" }, h("span", { class: "qnum" }, `${q.n}.`), q.q);
  const body = h("div", { class: "card-body" }, meta, qtext);

  if (q.type === "sa") {
    const shown = revealed.has(q.id) || !!a;
    body.append(
      h("label", { class: "sa-label", for: `sa-${q.id}` }, "Your answer (optional)"),
      h("textarea", { id: `sa-${q.id}`, placeholder: "Write it out, then check the model answer." }));
    if (!shown) {
      body.append(h("div", { class: "row" },
        h("button", { class: "btn primary", type: "button", onclick: () => { revealed.add(q.id); render(); } }, "Show answer")));
    } else {
      const fb = h("div", { class: a ? (a.correct ? "feedback" : "feedback bad") : "feedback neutral" },
        h("p", { class: "fb-title" }, "Model answer"),
        h("p", { class: "fb-why" }, q.model));
      if (!a) {
        fb.append(h("div", { class: "row" },
          h("button", { class: "btn small", type: "button", onclick: () => selfGrade(true) }, "I got it"),
          h("button", { class: "btn small", type: "button", onclick: () => selfGrade(false) }, "I missed it")));
      } else {
        fb.append(h("div", { class: "fb-foot" },
          h("span", { class: "links" }, h("span", null, a.correct ? "You marked this one right." : "You marked this one missed."), topicLink(q.topic), sourceLink(q.srcInfo)),
          h("button", { class: "btn small", type: "button", onclick: () => retry(q.id) }, "Try again")));
      }
      body.append(fb);
    }
    card.replaceChildren(body);
    return;
  }

  const keys = q.type === "tf" ? ["T", "F"] : LETTERS;
  const opts = h("ol", { class: "options", "aria-labelledby": "qtext" });
  q.opts.forEach((text, i) => {
    let cls = "opt", mark = null;
    if (a) {
      if (i === q.ans) { cls += " is-correct"; mark = a.correct ? "Your answer · correct" : "Correct answer"; }
      else if (i === a.choice) { cls += " is-wrong"; mark = "Your answer"; }
      else cls += " is-dim";
    }
    opts.append(h("li", null, h("button", {
      class: cls, type: "button", disabled: !!a, onclick: () => answer(i),
      "aria-label": `${keys[i]}: ${text}${mark ? ` (${mark})` : ""}`
    }, h("span", { class: "key" }, keys[i]), h("span", null, text), mark ? h("span", { class: "mark" }, mark) : null)));
  });
  body.append(opts);

  if (a) {
    const right = `${keys[q.ans]}: ${q.opts[q.ans]}`;
    body.append(h("div", { class: a.correct ? "feedback" : "feedback bad", role: "status" },
      h("p", { class: "fb-title" }, a.correct ? "Correct." : `Not quite. The answer is ${right}.`),
      h("p", { class: "fb-why" }, q.why),
      h("div", { class: "fb-foot" },
        h("span", { class: "links" }, topicLink(q.topic), sourceLink(q.srcInfo)),
        h("button", { class: "btn small", type: "button", onclick: () => retry(q.id) }, "Try again"))));
  }
  card.replaceChildren(body);
}

function renderNav() {
  const n = st.list.length;
  if (inRetake()) {
    const atResults = st.pos >= n;
    $("#prev").disabled = st.pos <= 0;
    $("#next").disabled = atResults;
    $("#next").textContent = st.pos === n - 1 ? "See results →" : "Next →";
    $("#navpos").textContent = atResults ? `Retake round ${st.retake.round} · results` : `Retake · ${st.pos + 1} of ${n}`;
    return;
  }
  $("#next").textContent = "Next →";
  $("#prev").disabled = st.pos <= 0 || !n;
  $("#next").disabled = st.pos >= n - 1 || !n;
  const label = { all: "All questions", missed: "Missed" }[st.filter] || `Part ${st.filter}`;
  $("#navpos").textContent = n ? `${label} · ${st.pos + 1} of ${n}` : label;
}

function renderGrid() {
  const cur = current();
  const cells = QS.map(q => {
    const a = st.answers[q.id];
    const status = a ? (a.correct ? "right" : "missed") : "not answered";
    return h("button", {
      class: `qcell${a ? (a.correct ? " ok" : " bad") : ""}${cur && cur.id === q.id ? " current" : ""}`,
      type: "button", style: `--c:${PARTS[q.part].color}`,
      "aria-label": `Question ${q.n}, part ${q.part}, ${status}`,
      onclick: () => jump(q.id)
    }, String(q.n));
  });
  $("#qgrid").replaceChildren(...cells);
}

function renderScore() {
  const ans = Object.values(st.answers);
  const answered = ans.length;
  const right = ans.filter(a => a.correct).length;
  const pct = answered ? Math.round((right / answered) * 100) : null;
  const rows = Object.entries(PARTS).filter(([k]) => partStats(k).total).map(([k, p]) => {
    const s = partStats(k);
    return h("div", { class: "prow", style: `--c:${p.color}` },
      h("span", { class: "dot" }),
      h("span", { class: "pname" }, `${k} · ${p.short}`),
      h("span", { class: "pnum" }, `${s.right}/${s.answered} right`),
      h("div", { class: "pbar", title: `${s.right} right, ${s.answered - s.right} missed, ${s.total - s.answered} left` },
        h("span", { class: "right", style: `width:${(s.right / s.total) * 100}%` }),
        h("span", { class: "wrong", style: `width:${((s.answered - s.right) / s.total) * 100}%` })));
  });
  const missed = answered - right;
  const actions = confirming
    ? [h("p", { class: "confirm" }, "Erase every saved answer?"),
       h("div", { class: "score-actions" },
         h("button", { class: "btn small danger", type: "button", onclick: () => { st.answers = {}; st.retake = null; revealed.clear(); confirming = false; setFilter("all"); } }, "Erase answers"),
         h("button", { class: "btn small", type: "button", onclick: () => { confirming = false; render(); } }, "Cancel"))]
    : [h("div", { class: "score-actions" },
         inRetake()
           ? h("button", { class: "btn small", type: "button", onclick: () => setFilter("all") }, "Exit retake")
           : h("button", { class: "btn small", type: "button", disabled: !missed && !retakeInProgress(), onclick: openRetake }, retakeInProgress() ? "Resume retake" : `Retake missed (${missed})`),
         h("button", { class: "btn small", type: "button", disabled: !answered, onclick: () => { confirming = true; render(); } }, "Reset"))];

  // While retaking, show that round's progress
  let retakeBox = null;
  if (inRetake()) {
    const ra = Object.values(st.retake.answers);
    retakeBox = h("div", { class: "retake-box" },
      h("strong", null, `Retake round ${st.retake.round}`),
      h("span", null, `${ra.length} of ${st.retake.ids.length} answered · ${ra.filter(a => a.correct).length} right`));
  }

  // The study guide topics with the most missed questions overall
  const byTopic = {};
  for (const q of QS) { const a = st.answers[q.id]; if (a && !a.correct) byTopic[q.topic] = (byTopic[q.topic] || 0) + 1; }
  const weakest = Object.entries(byTopic).sort((x, y) => y[1] - x[1]).slice(0, 3);
  const studyFirst = h("div", { class: "study-first" },
    h("h3", null, "Study these first"),
    weakest.length
      ? h("ol", null, weakest.map(([t, n]) => h("li", null,
          h("a", { href: `study-guide.html#topic-${t}` }, topicName(t)),
          h("span", { class: "pnum" }, `${n} missed`))))
      : h("p", { class: "empty-note" }, answered
          ? "0 missed so far. Topics you miss will show up here."
          : "Topics you miss will show up here."));

  // replaceChildren would print a skipped (null) section as the text "null", so drop those first
  $("#score").replaceChildren(...[
    h("div", null,
      h("h2", null, "Your score"),
      h("div", { class: "big" }, pct == null ? "—" : `${pct}%`),
      h("p", { class: "sub" }, answered ? `${right} right of ${answered} answered · ${TOTAL - answered} left` : `0 of ${TOTAL} answered. Aim for 85% or better.`)),
    retakeBox,
    h("div", { class: "prows" }, rows),
    studyFirst,
    ...actions
  ].filter(Boolean));
}

function render() {
  if (st.pos > lastPos()) st.pos = Math.max(0, lastPos());
  if (inRetake() && st.pos >= st.list.length) st.retake.finished = true;
  renderSpectrum();
  renderChips();
  renderCard();
  renderNav();
  renderGrid();
  renderScore();
  const q = current();
  try {
    if (inRetake()) history.replaceState(null, "", "#retake");
    else if (q) history.replaceState(null, "", `#q-${q.id}`);
  } catch (e) { /* ignore */ }
  save();
}

$("#total").textContent = TOTAL;
$("#prev").addEventListener("click", () => go(-1));
$("#next").addEventListener("click", () => go(1));
$("#shuffle").addEventListener("change", e => {
  st.shuffle = e.target.checked;
  st.list = listFor(st.filter);
  st.pos = 0;
  render();
});
document.addEventListener("keydown", e => {
  if (e.target.closest("textarea, input, select") || e.metaKey || e.ctrlKey || e.altKey) return;
  const q = current();
  const k = e.key.toLowerCase();
  if (k === "arrowright") { go(1); e.preventDefault(); return; }
  if (k === "arrowleft") { go(-1); e.preventDefault(); return; }
  if (!q || q.type === "sa") return;
  let i = -1;
  if (q.type === "tf") i = { t: 0, f: 1, a: 0, b: 1, "1": 0, "2": 1 }[k] ?? -1;
  else i = { a: 0, b: 1, c: 2, d: 3, "1": 0, "2": 1, "3": 2, "4": 3 }[k] ?? -1;
  if (i >= 0) { answer(i); e.preventDefault(); }
});

// Exposed for previews and checks
window.LHEP_QUIZ = { st, QS, BY_ID, PARTS, TOPICS, jump, answer, selfGrade, setFilter, startRetake, missedIds, current };

load();
const m = /^#q-([A-Za-z]+\d+)$/.exec(location.hash);
if (location.hash === "#retake") { if (inRetake()) render(); else openRetake(); }
else if (m && BY_ID[m[1]]) jump(m[1]);
else render();
})();
