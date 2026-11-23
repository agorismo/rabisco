// Rabisco — canvas, salas colaborativas e publicação.
// O modelo de dados é vetorial: cada traço é { id, user, tool, color, size, pen, points }.
// Na rede viajam traços (leves e validáveis), nunca pixels.
import { getStroke } from "https://cdn.jsdelivr.net/npm/perfect-freehand@1.2.2/+esm";
import { cfg } from "./cfg.js";

const W = 1200;
const H = 800;
const $ = (sel) => document.querySelector(sel);

const main = $("#main");
const live = $("#live");
const ctx = main.getContext("2d");
const lctx = live.getContext("2d");

const myId = crypto.randomUUID();
const params = new URLSearchParams(location.search);

let strokes = [];
let redoStack = [];
let current = null;
let remixOf = null;
const tool = { kind: "pen", color: "#2a2530", size: 8 };

// ---------- utilitários ----------

const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const ROOM_RE = /^[a-z0-9-]{4,32}$/;
const TOOLS = new Set(["pen", "marker", "eraser"]);

let toastTimer;
function toast(msg) {
  const el = $("#toast");
  el.textContent = msg;
  el.classList.add("show");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.classList.remove("show"), 2800);
}

// Tudo que vem de fora (sala, arquivo .json, post de outra pessoa) é não confiável.
function sanitize(s) {
  if (!s || typeof s !== "object") return null;
  if (!TOOLS.has(s.tool)) return null;
  if (typeof s.id !== "string" || s.id.length === 0 || s.id.length > 64) return null;
  if (!Array.isArray(s.points) || s.points.length === 0 || s.points.length > 5000) return null;
  const points = [];
  for (const p of s.points) {
    if (!Array.isArray(p)) return null;
    const x = Number(p[0]);
    const y = Number(p[1]);
    const pr = Number(p[2]);
    if (!Number.isFinite(x) || !Number.isFinite(y)) return null;
    points.push([clamp(x, -50, W + 50), clamp(y, -50, H + 50), Number.isFinite(pr) ? clamp(pr, 0, 1) : 0.5]);
  }
  return {
    id: s.id,
    user: typeof s.user === "string" ? s.user.slice(0, 64) : "?",
    tool: s.tool,
    color: /^#[0-9a-f]{6}$/i.test(s.color) ? s.color : "#000000",
    size: clamp(Number(s.size) || 8, 1, 64),
    pen: Boolean(s.pen),
    points,
  };
}

// ---------- desenho ----------

function toPath(outline) {
  const path = new Path2D();
  if (outline.length < 2) return path;
  path.moveTo(outline[0][0], outline[0][1]);
  for (let i = 1; i < outline.length - 1; i++) {
    const [x0, y0] = outline[i];
    const [x1, y1] = outline[i + 1];
    path.quadraticCurveTo(x0, y0, (x0 + x1) / 2, (y0 + y1) / 2);
  }
  path.closePath();
  return path;
}

function drawStroke(c, s) {
  const size = s.tool === "marker" ? s.size * 2 : s.size;
  const outline = getStroke(s.points, {
    size,
    thinning: s.tool === "pen" ? 0.5 : 0,
    smoothing: 0.5,
    streamline: 0.5,
    simulatePressure: !s.pen,
  });
  c.save();
  c.globalCompositeOperation = s.tool === "eraser" ? "destination-out" : "source-over";
  c.globalAlpha = s.tool === "marker" ? 0.4 : 1;
  c.fillStyle = s.color;
  c.fill(toPath(outline));
  c.restore();
}

function redrawAll(extra) {
  ctx.clearRect(0, 0, W, H);
  for (const s of strokes) drawStroke(ctx, s);
  if (extra) drawStroke(ctx, extra);
}

// ---------- entrada (mouse, toque e caneta) ----------

function pointFrom(e) {
  const r = live.getBoundingClientRect();
  return [((e.clientX - r.left) * W) / r.width, ((e.clientY - r.top) * H) / r.height, e.pressure || 0.5];
}

live.addEventListener("pointerdown", (e) => {
  if (e.pointerType === "mouse" && e.button !== 0) return;
  live.setPointerCapture(e.pointerId);
  current = {
    id: crypto.randomUUID(),
    user: myId,
    tool: tool.kind,
    color: tool.color,
    size: tool.size,
    pen: e.pointerType === "pen",
    points: [pointFrom(e)],
  };
  renderCurrent();
});

live.addEventListener("pointermove", (e) => {
  if (!current) return;
  const events = e.getCoalescedEvents ? e.getCoalescedEvents() : [e];
  for (const ev of events.length ? events : [e]) {
    if (current.points.length < 5000) current.points.push(pointFrom(ev));
  }
  renderCurrent();
});

function endStroke() {
  if (!current) return;
  const s = {
    ...current,
    points: current.points.map((p) => [Number(p[0].toFixed(1)), Number(p[1].toFixed(1)), Number(p[2].toFixed(2))]),
  };
  current = null;
  lctx.clearRect(0, 0, W, H);
  strokes.push(s);
  redoStack = [];
  redrawAll();
  send("stroke", s);
}

live.addEventListener("pointerup", endStroke);
live.addEventListener("pointercancel", endStroke);

function renderCurrent() {
  if (current.tool === "eraser") {
    // a borracha precisa recompor o canvas para o efeito aparecer
    redrawAll(current);
  } else {
    lctx.clearRect(0, 0, W, H);
    drawStroke(lctx, current);
  }
}

// ---------- ações ----------

function undo() {
  for (let i = strokes.length - 1; i >= 0; i--) {
    if (strokes[i].user === myId) {
      const [s] = strokes.splice(i, 1);
      redoStack.push(s);
      redrawAll();
      send("undo", { id: s.id });
      return;
    }
  }
}

function redo() {
  const s = redoStack.pop();
  if (!s) return;
  strokes.push(s);
  redrawAll();
  send("stroke", s);
}

function clearMine() {
  const mine = strokes.filter((s) => s.user === myId);
  if (!mine.length) return;
  strokes = strokes.filter((s) => s.user !== myId);
  redoStack = [];
  redrawAll();
  for (const s of mine) send("undo", { id: s.id });
}

function toPng() {
  const c = document.createElement("canvas");
  c.width = W;
  c.height = H;
  const x = c.getContext("2d");
  x.fillStyle = "#fff";
  x.fillRect(0, 0, W, H);
  x.drawImage(main, 0, 0);
  return new Promise((resolve) => c.toBlob(resolve, "image/png"));
}

function download(blob, name) {
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}

function fileName(ext) {
  const t = $("#titulo").value.trim().replace(/[^\p{L}\p{N}-]+/gu, "-").slice(0, 40) || "rabisco";
  return `${t}.${ext}`;
}

$("#btn-undo").addEventListener("click", undo);
$("#btn-redo").addEventListener("click", redo);
$("#btn-clear").addEventListener("click", clearMine);
$("#btn-png").addEventListener("click", async () => download(await toPng(), fileName("png")));
$("#btn-save").addEventListener("click", () => {
  const data = JSON.stringify({ app: "rabisco", version: 1, width: W, height: H, strokes });
  download(new Blob([data], { type: "application/json" }), fileName("json"));
});
$("#btn-open").addEventListener("click", () => $("#file-open").click());
$("#file-open").addEventListener("change", async (e) => {
  const file = e.target.files[0];
  e.target.value = "";
  if (!file) return;
  if (file.size > 5 * 1024 * 1024) return toast("Arquivo grande demais (máx. 5 MB).");
  try {
    const data = JSON.parse(await file.text());
    const loaded = (Array.isArray(data.strokes) ? data.strokes : []).map(sanitize).filter(Boolean);
    strokes = loaded.map((s) => ({ ...s, user: myId }));
    redoStack = [];
    redrawAll();
    toast(`${loaded.length} traços carregados.`);
  } catch {
    toast("Não consegui ler esse arquivo.");
  }
});

window.addEventListener("keydown", (e) => {
  if (e.target instanceof HTMLInputElement && e.target.type === "text") return;
  if (!(e.ctrlKey || e.metaKey)) return;
  const k = e.key.toLowerCase();
  if (k === "z" && !e.shiftKey) { e.preventDefault(); undo(); }
  if ((k === "z" && e.shiftKey) || k === "y") { e.preventDefault(); redo(); }
});

// ---------- ferramentas ----------

for (const b of document.querySelectorAll("[data-tool]")) {
  b.addEventListener("click", () => {
    tool.kind = b.dataset.tool;
    for (const o of document.querySelectorAll("[data-tool]")) o.setAttribute("aria-pressed", String(o === b));
  });
}

$("#cor").addEventListener("input", (e) => { tool.color = e.target.value; });
$("#tamanho").addEventListener("input", (e) => { tool.size = Number(e.target.value); });

const SWATCHES = ["#2a2530", "#ffffff", "#ff7a8a", "#ffb86b", "#ffe066", "#7bd88f", "#5cc8ff", "#a78bfa"];
for (const color of SWATCHES) {
  const b = document.createElement("button");
  b.style.background = color;
  b.title = color;
  b.setAttribute("aria-label", `Cor ${color}`);
  b.addEventListener("click", () => {
    tool.color = color;
    $("#cor").value = color;
  });
  $("#swatches").append(b);
}

// ---------- supabase (opcional) ----------

let sb = null;
if (cfg.SUPABASE_URL && cfg.SUPABASE_ANON_KEY) {
  try {
    const { createClient } = await import("https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm");
    sb = createClient(cfg.SUPABASE_URL, cfg.SUPABASE_ANON_KEY);
  } catch {
    toast("Não consegui carregar o Supabase. Seguindo em modo local.");
  }
}

let channel = null;
let syncAnswered = false;

function send(event, payload) {
  if (channel) channel.send({ type: "broadcast", event, payload });
}

function sendSync() {
  // mensagens do Realtime têm limite de tamanho: envia em lotes
  let batch = [];
  let size = 0;
  const flush = () => {
    if (batch.length) send("sync", { strokes: batch });
    batch = [];
    size = 0;
  };
  for (const s of strokes) {
    const len = JSON.stringify(s).length;
    if (size + len > 120000) flush();
    batch.push(s);
    size += len;
  }
  flush();
}

function joinRoom(room) {
  const info = $("#sala-info");
  info.hidden = false;
  info.textContent = `sala ${room}`;

  channel = sb.channel(`sala:${room}`, { config: { broadcast: { self: false }, presence: { key: myId } } });

  channel.on("broadcast", { event: "stroke" }, ({ payload }) => {
    const s = sanitize(payload);
    if (s && !strokes.some((x) => x.id === s.id)) {
      strokes.push(s);
      redrawAll();
    }
  });

  channel.on("broadcast", { event: "undo" }, ({ payload }) => {
    if (payload && typeof payload.id === "string") {
      const before = strokes.length;
      strokes = strokes.filter((s) => s.id !== payload.id);
      if (strokes.length !== before) redrawAll();
    }
  });

  channel.on("broadcast", { event: "sync-request" }, () => {
    if (!strokes.length) return;
    syncAnswered = false;
    // evita que todo mundo responda ao mesmo tempo
    setTimeout(() => { if (!syncAnswered) sendSync(); }, Math.random() * 600);
  });

  channel.on("broadcast", { event: "sync" }, ({ payload }) => {
    syncAnswered = true;
    const list = Array.isArray(payload?.strokes) ? payload.strokes : [];
    let added = false;
    for (const raw of list.slice(0, 500)) {
      const s = sanitize(raw);
      if (s && !strokes.some((x) => x.id === s.id)) {
        strokes.push(s);
        added = true;
      }
    }
    if (added) redrawAll();
  });

  channel.on("presence", { event: "sync" }, () => {
    const n = Object.keys(channel.presenceState()).length;
    info.textContent = `sala ${room} · ${n} online`;
  });

  channel.subscribe(async (status) => {
    if (status === "SUBSCRIBED") {
      await channel.track({ at: Date.now() });
      channel.send({ type: "broadcast", event: "sync-request", payload: {} });
    }
  });
}

$("#btn-room").addEventListener("click", async () => {
  if (!sb) return toast("Salas precisam do Supabase configurado (veja docs/SETUP.md).");
  let room = params.get("sala");
  if (!room || !ROOM_RE.test(room)) {
    const bytes = crypto.getRandomValues(new Uint8Array(6));
    room = Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
    const url = new URL(location.href);
    url.searchParams.set("sala", room);
    url.searchParams.delete("remix");
    history.replaceState(null, "", url);
    joinRoom(room);
  }
  const link = new URL(location.href);
  link.searchParams.set("sala", room);
  try {
    await navigator.clipboard.writeText(link.toString());
    toast("Link da sala copiado! Quem tiver o link pode desenhar com você.");
  } catch {
    toast(link.toString());
  }
});

// ---------- login e publicação ----------

function showAuth(session) {
  $("#btn-login").hidden = Boolean(session);
  $("#btn-publish").hidden = !session;
}

if (sb) {
  $("#btn-login").hidden = false;

  $("#btn-login").addEventListener("click", () =>
    sb.auth.signInWithOAuth({
      provider: "discord",
      options: { redirectTo: location.origin + location.pathname },
    }),
  );

  sb.auth.getSession().then(({ data }) => showAuth(data.session));
  sb.auth.onAuthStateChange((_event, session) => showAuth(session));

  $("#btn-publish").addEventListener("click", async () => {
    const { data } = await sb.auth.getSession();
    if (!data.session) return toast("Entre com o Discord para publicar.");
    const title = $("#titulo").value.trim();
    if (!title) return toast("Dê um título ao desenho.");
    if (!strokes.length) return toast("O canvas está vazio.");

    const blob = await toPng();
    if (blob.size > 2 * 1024 * 1024) return toast("A imagem passou de 2 MB. Simplifique o desenho.");

    const uid = data.session.user.id;
    const path = `${uid}/${crypto.randomUUID()}.png`;
    const up = await sb.storage.from("desenhos").upload(path, blob, { contentType: "image/png", upsert: false });
    if (up.error) return toast(`Falha no upload: ${up.error.message}`);

    const strokesJson = JSON.stringify(strokes);
    const row = {
      user_id: uid,
      title: title.slice(0, 80),
      image_path: path,
      strokes: strokesJson.length <= 900000 ? strokes : null,
      remix_of: remixOf,
    };
    const ins = await sb.from("posts").insert(row);
    if (ins.error) {
      await sb.storage.from("desenhos").remove([path]);
      return toast(`Não foi possível publicar: ${ins.error.message}`);
    }
    toast("Publicado! Veja na galeria.");
  });
}

// ---------- remix ----------

async function loadRemix(id) {
  const { data, error } = await sb.from("posts").select("id,title,strokes").eq("id", id).maybeSingle();
  if (error || !data || !Array.isArray(data.strokes)) return toast("Não consegui abrir esse desenho para remix.");
  strokes = data.strokes.map(sanitize).filter(Boolean).map((s) => ({ ...s, user: "origem" }));
  remixOf = data.id;
  $("#titulo").value = `Remix de ${data.title}`.slice(0, 80);
  redrawAll();
  toast("Desenho carregado. Continue a partir dele!");
}

// ---------- início ----------

const roomParam = params.get("sala");
if (roomParam) {
  if (!ROOM_RE.test(roomParam)) toast("Nome de sala inválido.");
  else if (!sb) toast("Salas precisam do Supabase configurado (veja docs/SETUP.md).");
  else joinRoom(roomParam);
}

const remixParam = params.get("remix");
if (remixParam && UUID_RE.test(remixParam)) {
  if (sb) loadRemix(remixParam);
  else toast("Remix precisa do Supabase configurado.");
}
