// Scribular Notes — clinician app: saved note templates + session notes. Local only.
"use strict";

const S = {
  screen: "session", data: null, flash: null,
  // session note
  sessionId: null, templateId: null,
  // shared note run (ctx: "session" | "template")
  run: null,
  // new template wizard
  wiz: { step: "example", example: "", name: "", job: null },
  // template screen
  styleId: null, compare: null, previewJob: null, chats: {}, chatBusy: null,
};

const $ = (s) => document.querySelector(s);
const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const fmtSecs = (s) => (s >= 60 ? `${Math.floor(s / 60)}m ${Math.round(s % 60)}s` : `${Math.max(0, s).toFixed(0)}s`);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function api(path, body) {
  const r = await fetch(path, body === undefined ? {} : { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
  const j = await r.json();
  if (!r.ok) throw new Error(j.error || r.statusText);
  return j;
}
async function refresh() { S.data = await api("/api/state"); }
async function poll(jobId, onUpdate) {
  for (;;) {
    const j = await api(`/api/jobs/${jobId}`);
    await onUpdate(j);
    if (!["running", "queued"].includes(j.status)) return j;
    await sleep(600);
  }
}

const style = (id) => S.data.styles.find((s) => s.id === id);
const version = (id) => { for (const s of S.data.styles) { const v = s.versions.find((x) => x.id === id); if (v) return v; } return null; };
const latest = (s) => s.versions[s.versions.length - 1];
const saved = () => S.data.styles.filter((s) => s.activeVersionId);
const drafts = () => S.data.styles.filter((s) => !s.activeVersionId && s.versions.some((v) => v.state === "draft"));
const pendingUpdate = (s) => s.versions.find((v) => v.state === "proposed");
const sessionLabel = (fid) => ((S.data.library || []).find((x) => x.id === fid) || {}).label || "Practice session";
// Demo recordings: fictional transcripts given recent recording times so the list reads like a session log.
function recordedAt(i) {
  const d = new Date(); d.setMinutes(0, 0, 0);
  const slots = [[0, -1], [0, -2.5], [0, -4], [1, 15], [1, 13.5], [1, 11], [2, 16], [2, 14], [3, 10], [3, 9]];
  const [daysAgo, hour] = slots[i % slots.length];
  d.setDate(d.getDate() - daysAgo);
  if (hour < 0) d.setTime(d.getTime() + hour * 3600e3); else d.setHours(Math.floor(hour), (hour % 1) * 60);
  return d.toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" }) + " · " + d.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });
}
const transcriptOption = (x, i) => `${recordedAt(i)} — ${x.label}`;

function go(screen, extra) { Object.assign(S, extra || {}); S.screen = screen; S.flash = null; render(); window.scrollTo(0, 0); }
function toast(text, kind) { S.flash = { kind: kind || "ok", text }; render(); }
function fail(e) { toast(e.message || String(e), "error"); }

// ------------------------------------------------------------ sidebar
function renderSide() {
  const item = (s, muted) => {
    const upd = pendingUpdate(s);
    const on = S.screen === "template" && S.styleId === s.id;
    return `<button class="tpl ${on ? "on" : ""} ${muted ? "muted" : ""}" data-act="open-template" data-id="${s.id}">
      <span class="tpl-name">${esc(s.name)}</span>${upd ? '<span class="dot" title="Suggested update"></span>' : ""}</button>`;
  };
  const sv = saved(), dr = drafts();
  return `
    <div class="logo-row"><div class="logo">S</div><div><b>Scribular</b><div class="tiny">Session notes</div></div></div>
    <button class="btn primary wide" data-act="nav" data-to="session">✎ Write session note</button>
    <div class="side-h">Saved note templates</div>
    ${sv.length ? sv.map((s) => item(s)).join("") : `<p class="tiny pad">None yet.</p>`}
    <button class="btn ghost-side wide" data-act="nav" data-to="new">+ New template</button>
    ${dr.length ? `<div class="side-h">Not saved yet</div>${dr.map((s) => item(s, true)).join("")}` : ""}
    <div class="side-foot">🔒 Runs privately on this computer</div>`;
}

// ------------------------------------------------------------ note run (shared)
async function startRun(ctx, versionId, libraryId) {
  S.run = { ctx, versionId, job: { status: "queued", elapsed: 0 }, data: null, mode: null };
  render();
  try {
    const { jobId } = await api("/api/simulate", { versionId, libraryId: libraryId || null });
    S.run.job.id = jobId;
    const j = await poll(jobId, async (j) => { if (S.run && S.run.versionId === versionId) { S.run.job = j; render(); } });
    await refresh();
    if (j.status === "completed") { S.run.data = await api(`/api/runs/${j.result.runId}`); S.run.job = null; }
  } catch (e) { S.run.job = { status: "failed", error: e.message }; }
  render();
  const card = document.querySelector(".note-card");
  if (card) card.scrollIntoView({ behavior: "smooth", block: "start" });
}

function checksLine(checks) {
  if (!checks || !checks.length) return "";
  const issues = checks.filter((c) => c.status !== "pass");
  if (!issues.length) return `<div class="checks-ok">✓ All ${checks.length} checks passed</div>`;
  return `<details class="checks-box"><summary>${issues.length} thing${issues.length > 1 ? "s" : ""} to review</summary>
    <ul class="checks">${issues.map((c) => `<li class="${c.status}">${esc(c.label)}${c.detail ? `<span class="d">${esc(c.detail)}</span>` : ""}</li>`).join("")}</ul></details>`;
}

const PATH_LABELS = { "sentences.max": "Max sentences per section", "sentences.min": "Min sentences per section", "quotes.max": "Max client quotes", perspective: "Voice", pronouns: "Pronouns", replaceNames: "Replace names" };
function prettyChange(t) {
  return String(t).replace(/\b(sentences\.max|sentences\.min|quotes\.max|perspective|pronouns|replaceNames)\b/g, (m) => PATH_LABELS[m] || m);
}
function patchLine(x) {
  if (x.path === "sections.add") return `<li><b>New section:</b> ${esc((x.after && x.after.name) || x.after)} <span class="tiny">(only when discussed)</span></li>`;
  const label = PATH_LABELS[x.path] || x.path.replace(/[._]/g, " ").replace(/^\w/, (c) => c.toUpperCase());
  const val = (v) => (v === undefined || v === null ? "—" : typeof v === "object" ? (v.name || JSON.stringify(v)) : String(v));
  return `<li><b>${esc(label)}:</b> ${esc(val(x.before))} → <b>${esc(val(x.after))}</b></li>`;
}

function noteView(ctx) {
  const R = S.run;
  if (!R || R.ctx !== ctx) return "";
  const j = R.job, r = R.data;
  if (j && (j.status === "queued" || j.status === "running"))
    return `<div class="card note-card"><div class="writing"><span class="spinner"></span>Writing note… ${fmtSecs(j.elapsed || 0)}</div>
      ${j.id ? `<button class="btn small-btn" data-act="cancel-job" data-id="${j.id}">Cancel</button>` : ""}</div>`;
  if (j && j.status === "failed") return `<div class="card note-card"><div class="error">${esc(j.error || "Something went wrong.")}</div></div>`;
  if (j && j.status === "cancelled") return `<div class="card note-card"><p class="tiny">Cancelled.</p></div>`;
  if (!r) return "";
  const v = version(r.versionId);
  const text = r.noteEdit ? r.noteEdit.text : r.output;
  const pp = (S.data.patchProposals || []).find((p) => p.runId === r.id && p.status === "pending");
  let panel = "";
  if (R.mode === "edit") {
    panel = `<textarea id="note-edit" class="note-edit">${esc(text)}</textarea>
      <div class="row"><button class="btn primary" data-act="save-edit">Save note</button><button class="btn" data-act="mode" data-m="">Cancel</button></div>`;
  } else if (R.mode === "retry") {
    panel = `<label>What's wrong with this note?</label><input type="text" id="retry-text" placeholder="e.g. Leave out Next Actions">
      <div class="row"><button class="btn primary" data-act="retry">Rewrite this note</button><button class="btn" data-act="mode" data-m="">Cancel</button></div>`;
  } else if (R.mode === "improve") {
    panel = `<label>What should be different in future notes?</label>
      <textarea id="fb-text" class="short" placeholder="e.g. Keep each section to two sentences."></textarea>
      <details class="more"><summary>Add a section</summary><input type="text" id="fb-sec" placeholder="e.g. Objective Data"></details>
      <div class="row"><button class="btn primary" data-act="send-feedback">Suggest update</button><button class="btn" data-act="mode" data-m="">Cancel</button></div>`;
  } else if (R.feedbackJob) {
    panel = `<div class="writing"><span class="spinner"></span>Thinking about your feedback…</div>`;
  } else if (R.clarify) {
    panel = `<div class="ask"><b>${esc(R.clarify.question)}</b><div class="row">${(R.clarify.options || []).map((o) => `<button class="btn" data-act="clarify" data-value="${esc(o)}">${esc(o)}</button>`).join("")}</div></div>`;
  } else if (pp) {
    panel = `<div class="suggest"><div class="suggest-h">Suggested update to “${esc(style(v.styleId).name)}”</div>
      <ul>${pp.patch.map(patchLine).join("")}</ul>
      <div class="row"><button class="btn primary" data-act="confirm-patch" data-id="${pp.id}" data-base="${pp.baseVersionId}">Preview on a new session</button><button class="btn" data-act="decline-patch" data-id="${pp.id}">Discard</button></div></div>`;
  } else if (ctx === "template") {
    panel = "";
  } else {
    const draft = v && v.state === "draft";
    panel = `<div class="row actions">
      ${draft ? `<button class="btn primary" data-act="activate" data-id="${v.id}">Save and activate</button>` : `<button class="btn primary" data-act="copy">${R.copied ? "Copied ✓" : "Copy note"}</button>`}
      <button class="btn" data-act="mode" data-m="edit">Edit</button>
      <button class="btn" data-act="mode" data-m="retry">Fix this note</button>
      <button class="btn" data-act="mode" data-m="improve">Improve template</button></div>`;
  }
  return `<div class="card note-card">
    <div class="note-head"><div><b>${esc(v ? style(v.styleId).name : "")}</b><span class="tiny"> · ${esc(sessionLabel(r.fixtureId))} · fictional transcript</span></div>
      <span class="tiny">${fmtSecs(r.durationMs / 1000)}</span></div>
    ${R.mode === "edit" ? "" : `<pre class="note">${esc(text)}</pre>`}
    ${R.mode === "edit" ? "" : checksLine(r.checks)}
    ${panel}
    <details class="more"><summary>Transcript</summary><pre class="transcript">${esc(r.transcript)}</pre></details>
  </div>`;
}

// ------------------------------------------------------------ screen: write session note
function renderSession() {
  const sv = saved();
  if (!sv.length) return `<h1>Session note</h1><div class="card empty"><p>Create a note template to start writing session notes.</p>
    <button class="btn primary" data-act="nav" data-to="new">+ New template</button></div>`;
  if (!S.templateId || !sv.find((s) => s.id === S.templateId)) S.templateId = sv[0].id;
  const lib = S.data.library || [];
  if (!S.sessionId) S.sessionId = lib.length ? lib[0].id : "";
  const busy = S.run && S.run.ctx === "session" && S.run.job && ["queued", "running"].includes(S.run.job.status);
  return `
  <h1>Session note</h1>
  <div class="card">
    <label class="lbl">Transcript</label>
    <select id="session-pick">${lib.map((x, i) => `<option value="${x.id}" ${x.id === S.sessionId ? "selected" : ""}>${esc(transcriptOption(x, i))}</option>`).join("")}</select>
    <p class="tiny">Demo transcripts are fictional.</p>
    <label class="lbl">Note template</label>
    <div class="choices">${sv.map((s) => `<button class="choice ${s.id === S.templateId ? "on" : ""}" data-act="pick-template" data-id="${s.id}">${esc(s.name)}</button>`).join("")}</div>
    <button class="btn primary big-btn" data-act="write-note" ${busy ? "disabled" : ""}>Write note</button>
  </div>
  ${noteView("session")}`;
}

// ------------------------------------------------------------ screen: new template
function renderNew() {
  const W = S.wiz;
  const head = `<h1>New note template</h1>`;
  if (W.step === "example") return head + `
    <div class="card">
      <label class="lbl">Paste a note written the way you like</label>
      <textarea id="w-example" class="tall" placeholder="Paste a past note…">${esc(W.example)}</textarea>
      <div class="row"><input type="file" id="w-file" accept=".txt,.md,text/plain,text/markdown">
        <select id="w-sample" class="auto"><option value="">or use a sample…</option>${S.data.samples.map((x) => `<option value="${x.id}">${esc(x.label)}</option>`).join("")}</select></div>
      <label class="lbl" style="margin-top:16px">Name<input type="text" id="w-name" value="${esc(W.name)}" placeholder="e.g. My progress note"></label>
      <div class="row"><button class="btn primary big-btn" data-act="w-build">Build</button></div>
    </div>`;
  const j = W.job || { log: [], elapsed: 0, status: "queued" };
  const running = ["queued", "running"].includes(j.status);
  const last = j.log && j.log.length ? j.log[j.log.length - 1].phase : "Reading your note…";
  return head + `
    <div class="card center">
      ${running ? `<div class="writing big"><span class="spinner"></span>${esc(last)}</div><p class="tiny">${fmtSecs(j.elapsed || 0)}</p>
        ${j.id ? `<button class="btn" data-act="cancel-job" data-id="${j.id}">Cancel</button>` : ""}` : ""}
      ${j.status === "failed" ? `<div class="error">${esc(j.error)}</div><button class="btn primary" data-act="w-build">Try again</button> <button class="btn" data-act="w-back">Back</button>` : ""}
      ${j.status === "cancelled" ? `<p>Cancelled.</p><button class="btn primary" data-act="w-build">Start again</button> <button class="btn" data-act="w-back">Back</button>` : ""}
    </div>`;
}

// ------------------------------------------------------------ screen: template
function saveTarget(s) {
  return pendingUpdate(s) || (!s.activeVersionId ? latest(s) : null);
}

function renderTemplate() {
  const s = style(S.styleId);
  if (!s) return renderSession();
  const active = s.activeVersionId ? version(s.activeVersionId) : null;
  const target = saveTarget(s);
  const lib = S.data.library || [];
  const history = s.versions.filter((v) => ["active", "archived"].includes(v.state)).slice().reverse();
  const busy = (S.previewJob && ["queued", "running"].includes(S.previewJob.status)) || (S.chatBusy === s.id);
  return `
  <div class="row between title-row"><h1>${esc(s.name)}</h1>
    <div class="row">${target ? `<span class="badge draft">${active ? "Unsaved changes" : "Not saved yet"}</span>
      <button class="btn primary" data-act="save" data-id="${target.id}" ${busy ? "disabled" : ""}>Save</button>`
      : `<span class="badge active">Saved</span>`}</div></div>
  ${compareView(s)}
  ${S.compare && pendingUpdate(s) && S.compare.vid === pendingUpdate(s).id ? "" : noteView("template")}
  ${chatView(s, busy)}
  <div class="row try-row"><select id="tpl-session" class="auto">${lib.map((x, i) => `<option value="${x.id}">${esc(transcriptOption(x, i))}</option>`).join("")}</select>
    <button class="btn" data-act="try-template" data-id="${(target || active).id}" ${busy ? "disabled" : ""}>Try on another transcript</button></div>
  ${history.length > 1 ? `<details class="card more"><summary>Version history</summary>
    ${history.map((v) => `<div class="hist"><span>v${v.version} · ${esc(v.createdAt.slice(0, 16).replace("T", " "))}</span>
      ${v.state === "active" ? '<span class="badge active">Current</span>' : `<button class="btn small-btn" data-act="activate" data-id="${v.id}">Restore</button>`}</div>`).join("")}</details>` : ""}`;
}

function compareView(s) {
  const upd = pendingUpdate(s);
  const pj = S.previewJob;
  if (pj && ["queued", "running"].includes(pj.status)) return `<div class="card"><div class="writing"><span class="spinner"></span>Rewriting the sample note with your change… ${fmtSecs(pj.elapsed || 0)}</div></div>`;
  if (!upd || !S.compare || S.compare.vid !== upd.id) return "";
  return `<div class="card suggest">
    <div class="row between"><div class="suggest-h">Before and after</div><button class="btn small-btn" data-act="reject" data-id="${upd.id}">Undo change</button></div>
    <div class="two"><div><div class="tiny">Before</div><pre class="note">${esc(S.compare.before.output)}</pre></div>
      <div><div class="tiny">After</div><pre class="note">${esc(S.compare.after.output)}</pre></div></div></div>`;
}

function chatView(s, busy) {
  const msgs = (S.chats[s.id] = S.chats[s.id] || [{ who: "bot", html: "Tell me what to change about this note template, for example “Keep each section to two sentences” or “Add a section for Risk”." }]);
  return `<div class="card chat">
    <div class="chat-log">${msgs.map((m) => `<div class="msg ${m.who}">${m.html}${chatButtons(m)}</div>`).join("")}
      ${busy ? `<div class="msg bot"><span class="spinner"></span>Working…</div>` : ""}</div>
    <div class="chat-input"><input type="text" id="chat-text" placeholder="Describe a change…" ${busy ? "disabled" : ""}>
      <button class="btn primary" data-act="chat-send" ${busy ? "disabled" : ""}>Send</button></div></div>`;
}

function botSay(sid, html, extra) { (S.chats[sid] = S.chats[sid] || []).push(Object.assign({ who: "bot", html }, extra || {})); }
function chatButtons(m) {
  if (m.pp) {
    const pp = (S.data.patchProposals || []).find((x) => x.id === m.pp);
    if (!pp || pp.status !== "pending") return "";
    return `<div class="row"><button class="btn primary small-btn" data-act="chat-apply" data-id="${pp.id}" data-base="${pp.baseVersionId}">Apply</button><button class="btn small-btn" data-act="decline-patch" data-id="${pp.id}">Skip</button></div>`;
  }
  if (m.options && m.live) return `<div class="row">${m.options.map((o) => `<button class="btn small-btn" data-act="chat-option" data-value="${esc(o)}">${esc(o)}</button>`).join("")}</div>`;
  return "";
}
const NO_CHANGE = "I can't make that change yet. I can change the length, quotes, voice, pronouns, or names, or add a section (try “Add a section called Risk”).";

async function chatSend(sid, text, addSection) {
  const s = style(sid);
  S.chats[sid].push({ who: "me", html: esc(text) });
  S.chatBusy = sid; render();
  try {
    // Feedback is interpreted against the latest sample note for the version being edited.
    const target = saveTarget(s) || version(s.activeVersionId);
    if (!S.run || S.run.ctx !== "template" || !S.run.data || S.run.data.versionId !== target.id) {
      if (S.compare && S.compare.after && S.compare.after.versionId === target.id) S.run = { ctx: "template", versionId: target.id, data: S.compare.after };
      else { S.chatBusy = null; await startRun("template", target.id, null); S.chatBusy = sid; }
    }
    if (!S.run || !S.run.data) throw new Error("Couldn't write a sample note to apply the change to.");
    let r = await api(`/api/runs/${S.run.data.id}/feedback`, { accepted: false, scope: "future", tags: [], text: addSection ? "" : text,
      addSection: addSection ? { name: addSection, required: false } : null });
    if (r.jobId) {
      const j = await poll(r.jobId, async () => {});
      if (j.status !== "completed") throw new Error(j.error || "Couldn't process that.");
      r = j.result;
    }
    await refresh();
    const it = r.interpretation;
    (S.chats[sid] || []).forEach((m) => { m.live = false; });
    if (it && it.kind === "clarification") botSay(sid, esc(it.question), { options: it.options || [], live: true });
    else if (it && it.kind === "no_change") botSay(sid, /unsupported|path|interpreter/i.test(it.explanation || "") ? esc(NO_CHANGE) : esc(it.explanation || NO_CHANGE));
    else if (r.patchProposal) botSay(sid, `Here's the change:<ul>${r.patchProposal.patch.map(patchLine).join("")}</ul>`, { pp: r.patchProposal.id });
    else botSay(sid, "Noted.");
  } catch (e) { botSay(sid, `<span class="err">${esc(e.message)}</span>`); }
  S.chatBusy = null; render();
}

async function chatApply(sid, id, base) {
  S.chatBusy = sid; render();
  try {
    const r = await api(`/api/patch-proposals/${id}/confirm`, { baseVersionId: base });
    await refresh();
    S.chatBusy = null;
    if (r.jobId) {
      S.previewJob = { status: "queued", elapsed: 0 }; render();
      const j = await poll(r.jobId, async (j) => { S.previewJob = j; render(); });
      S.previewJob = null; await refresh();
      if (j.status === "completed") { await loadCompare(r.proposalId); S.run = { ctx: "template", versionId: r.proposalId, data: S.compare.after }; }
    } else await startRun("template", r.proposalId, null);
    botSay(sid, "Done. The sample note is updated. Click <b>Save</b> to keep it, or keep chatting.");
  } catch (e) { botSay(sid, `<span class="err">${esc(e.message)}</span>`); }
  S.chatBusy = null; render();
}

async function loadCompare(vid) {
  const val = version(vid).validation;
  if (!val || !val.runId) return;
  const [before, after] = await Promise.all([api(`/api/runs/${val.compareRunId}`), api(`/api/runs/${val.runId}`)]);
  S.compare = { vid, before, after };
  render();
}

// ------------------------------------------------------------ render
function render() {
  if (!S.data) return;
  $("#side").innerHTML = renderSide();
  const views = { session: renderSession, new: renderNew, template: renderTemplate };
  const flash = S.flash ? `<div class="toast ${S.flash.kind}">${esc(S.flash.text)}</div>` : "";
  const rt = S.data.runtime;
  const offline = rt.available ? "" : `<div class="toast error">AI model not available: ${esc(rt.error || "start Ollama")}</div>`;
  $("#app").innerHTML = offline + flash + views[S.screen]();
  const f = $("#w-file");
  if (f) f.onchange = async () => { const file = f.files[0]; if (file) { captureWizard(); S.wiz.example = await file.text(); render(); } };
}

function captureWizard() {
  const W = S.wiz;
  if ($("#w-example")) W.example = $("#w-example").value;
  if ($("#w-name")) W.name = $("#w-name").value;

}
// ------------------------------------------------------------ actions
document.addEventListener("keydown", (e) => {
  if (e.key === "Enter" && e.target.id === "chat-text") { e.preventDefault(); const b = document.querySelector("[data-act=chat-send]"); if (b) b.click(); }
});

document.addEventListener("change", (e) => {
  const t = e.target;
  if (t.id === "session-pick") S.sessionId = t.value;
  if (t.id === "w-sample" && t.value) {
    captureWizard();
    const sample = S.data.samples.find((x) => x.id === t.value);
    S.wiz.example = sample.text.replace(/^FICTIONAL SAMPLE NOTE[^\n]*\n+/, "");
    if (!S.wiz.name) S.wiz.name = sample.label.split(/[:(]/)[0].trim();
    render();
  }
});

document.addEventListener("click", async (e) => {
  const el = e.target.closest("[data-act]");
  if (!el) return;
  e.preventDefault();
  const act = el.dataset.act, id = el.dataset.id;
  try {
    if (act === "nav") {
      captureWizard();
      if (el.dataset.to === "new" && S.screen !== "new") S.wiz = { step: "example", example: "", name: "", job: null };
      go(el.dataset.to);
    }
    else if (act === "open-template") {
      S.compare = null; if (S.run && S.run.ctx === "template") S.run = null;
      go("template", { styleId: id });
      const u = pendingUpdate(style(id)); if (u) await loadCompare(u.id);
    }
    else if (act === "pick-template") { S.templateId = id; render(); }
    else if (act === "write-note") {
      S.sessionId = $("#session-pick").value;
      await startRun("session", style(S.templateId).activeVersionId, S.sessionId);
    }
    else if (act === "try-template") { await startRun("template", id, $("#tpl-session").value); }
    else if (act === "cancel-job") await api(`/api/jobs/${id}/cancel`, {});
    else if (act === "mode") { S.run.mode = el.dataset.m || null; render(); }
    else if (act === "copy") {
      const r = S.run.data;
      await navigator.clipboard.writeText(r.noteEdit ? r.noteEdit.text : r.output);
      await api(`/api/runs/${r.id}/feedback`, { accepted: true, scope: "note_only", tags: [] });
      S.run.copied = true; render();
    }
    else if (act === "save-edit") {
      await api(`/api/runs/${S.run.data.id}/feedback`, { accepted: false, scope: "note_only", tags: [], editedNote: $("#note-edit").value });
      S.run.data = await api(`/api/runs/${S.run.data.id}`); S.run.mode = null; toast("Note saved. Your template is unchanged.");
    }
    else if (act === "retry") {
      const correction = $("#retry-text").value.trim();
      if (!correction) return;
      const ctx = S.run.ctx, vid = S.run.versionId, parent = S.run.data.id;
      S.run = { ctx, versionId: vid, job: { status: "queued", elapsed: 0 }, data: null };
      render();
      const { jobId } = await api(`/api/runs/${parent}/retry`, { correction });
      S.run.job.id = jobId;
      const j = await poll(jobId, async (j) => { S.run.job = j; render(); });
      if (j.status === "completed") { S.run.data = await api(`/api/runs/${j.result.runId}`); S.run.job = null; }
      await refresh(); render();
    }
    else if (act === "send-feedback" || act === "clarify") {
      const text = act === "clarify" ? el.dataset.value : $("#fb-text").value.trim();
      const sec = act === "clarify" ? "" : ($("#fb-sec") ? $("#fb-sec").value.trim() : "");
      if (!text && !sec) return;
      const runId = S.run.data.id;
      S.run.mode = null; S.run.clarify = null; S.run.feedbackJob = { status: "queued" }; render();
      let r = await api(`/api/runs/${runId}/feedback`, { accepted: false, scope: "future", tags: [], text, addSection: sec ? { name: sec, required: false } : null });
      if (r.jobId) {
        const j = await poll(r.jobId, async (j) => { S.run.feedbackJob = j; });
        if (j.status !== "completed") { S.run.feedbackJob = null; throw new Error(j.error || "Couldn't process that feedback."); }
        r = j.result;
      }
      S.run.feedbackJob = null;
      await refresh();
      if (r.interpretation && r.interpretation.kind === "clarification") { S.run.clarify = r.interpretation; return render(); }
      if (r.interpretation && r.interpretation.kind === "no_change") return toast(r.interpretation.explanation || "No change needed.", "notice");
      if (r.proposalId) await openPreview(r.proposalId, r.jobId);
      else render();
    }
    else if (act === "confirm-patch") {
      el.disabled = true;
      const r = await api(`/api/patch-proposals/${id}/confirm`, { baseVersionId: el.dataset.base });
      await refresh();
      await openPreview(r.proposalId, r.jobId);
    }
    else if (act === "decline-patch") { await api(`/api/patch-proposals/${id}/decide`, { decision: "declined" }); await refresh(); if (S.screen === "template") botSay(S.styleId, "Okay, skipped."); render(); }
    else if (act === "load-compare") await loadCompare(id);
    else if (act === "chat-send") {
      const t = $("#chat-text").value.trim();
      if (!t) return;
      const m = t.match(/^add (?:a |an )?(?:new )?section(?: (?:for|called|named|titled|about))?\s*[:\-]?\s*["“']?([^"”']{2,40})["”']?\.?$/i);
      await chatSend(S.styleId, t, m ? m[1].trim().replace(/^\w/, (c) => c.toUpperCase()) : null);
    }
    else if (act === "chat-option") await chatSend(S.styleId, el.dataset.value);
    else if (act === "chat-apply") await chatApply(S.styleId, id, el.dataset.base);
    else if (act === "save") {
      const v = version(id);
      await api(`/api/versions/${id}/activate`, {});
      await refresh(); S.compare = null; S.templateId = v.styleId;
      if (S.run && S.run.ctx === "template") S.run = { ctx: "template", versionId: id, data: S.run.data };
      botSay(v.styleId, "Saved. Choose this template after your next session.");
      toast(`“${style(v.styleId).name}” saved.`);
    }
    else if (act === "activate") {
      const v = version(id);
      await api(`/api/versions/${id}/activate`, {});
      await refresh();
      S.styleId = v.styleId; S.templateId = v.styleId; S.compare = null;
      if (S.run && S.run.ctx === "template") S.run = null;
      go("template");
      toast(`“${style(v.styleId).name}” saved. Choose it after your next session.`);
    }
    else if (act === "reject") { await api(`/api/versions/${id}/decide`, { decision: "rejected" }); await refresh(); S.compare = null; toast("Update rejected. Your template is unchanged."); }
    else if (act === "w-back") { S.wiz.step = "example"; render(); }
    else if (act === "w-build") {
      captureWizard();
      const W = S.wiz;
      if (!W.example.trim()) return toast("Paste a note or choose a sample first.", "notice");
      W.step = "build"; W.job = { status: "queued", log: [], elapsed: 0 }; render();
      try {
        const ex = await api("/api/extract", { text: W.example, name: W.name || "My note template" });
        const prefs = Object.assign(ex.preferences, { name: W.name || "My note template" });
        const { jobId } = await api("/api/prepare", { preferences: prefs, noteType: "narrative" });
        W.job.id = jobId;
        const j = await poll(jobId, async (j) => { W.job = j; if (S.screen === "new") render(); });
        await refresh();
        if (j.status === "completed") {
          go("template", { styleId: j.result.styleId });
          await startRun("template", j.result.versionId, null);
        } else render();
      } catch (err) { W.job = { status: "failed", error: err.message }; render(); }
    }
    else if (act === "use-default") {
      captureWizard();
      const r = await api(`/api/defaults/${id}/use`, { noteType: "narrative" });
      await refresh();
      go("template", { styleId: r.styleId });
      await startRun("template", r.versionId, null);
    }
  } catch (err) { fail(err); }
});

async function openPreview(proposalId, jobId) {
  const v = version(proposalId);
  S.compare = null; S.run = null;
  go("template", { styleId: v.styleId });
  if (!jobId) return;
  S.previewJob = { status: "queued", elapsed: 0 };
  render();
  const j = await poll(jobId, async (j) => { S.previewJob = j; if (S.screen === "template") render(); });
  S.previewJob = null;
  await refresh();
  if (j.status === "completed") await loadCompare(proposalId); else { if (j.error) toast(j.error, "error"); else render(); }
}

(async function init() {
  try {
    await refresh();
    if (!saved().length) S.screen = "new";
    render();
  } catch (e) { $("#app").innerHTML = `<div class="toast error">Can't reach the app server: ${esc(e.message)}</div>`; }
})();
