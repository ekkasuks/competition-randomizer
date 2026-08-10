/*
 * vote.js — ลอจิกหน้าลงคะแนนโหวต
 * ขั้นตอน: เลือกชื่อผู้โหวต -> เลือกทีมที่ 1/2/3 -> ส่งคะแนน
 */

document.getElementById("schoolName").textContent = CONFIG.SCHOOL_NAME;

const compId = qs("c");
const content = document.getElementById("content");

let comp = null;
let voters = [];
let selectedVoterId = null;

async function init() {
  if (!compId) {
    content.innerHTML = errorBox("ลิงก์ไม่ถูกต้อง", "ไม่พบรหัสรายการแข่งขันในลิงก์");
    return;
  }
  try {
    comp = await API.getCompetition(compId);
  } catch (e) {
    content.innerHTML = errorBox("ไม่พบรายการ", e.message);
    return;
  }
  document.getElementById("compName").textContent = comp.name;

  if (comp.status !== "open") {
    const msg =
      comp.status === "closed"
        ? "การโหวตรายการนี้ปิดแล้ว ขอบคุณที่ร่วมลงคะแนน"
        : "รายการนี้ยังไม่เปิดให้โหวต กรุณารอผู้ดูแลเปิดโหวต";
    content.innerHTML = errorBox("ยังโหวตไม่ได้", msg);
    return;
  }

  if (!comp.teams.length) {
    content.innerHTML = errorBox("ยังไม่มีทีม", "รายการนี้ยังไม่มีทีมให้โหวต");
    return;
  }

  try {
    voters = await API.getVoters(compId);
  } catch (e) {
    voters = [];
  }
  if (!voters.length) {
    content.innerHTML = errorBox(
      "ยังไม่มีรายชื่อผู้โหวต",
      "กรุณาให้ผู้ดูแลเพิ่มรายชื่อผู้โหวตก่อน"
    );
    return;
  }

  renderPickVoter();
}

/* ---------- ขั้นที่ 1: เลือกชื่อผู้โหวต ---------- */
function renderPickVoter() {
  content.innerHTML = `
    <div class="panel">
      <div class="section-eyebrow">ขั้นที่ 1</div>
      <h2>เลือกชื่อของคุณ</h2>
      <p class="hint">เลือกชื่อผู้โหวตเพื่อยืนยันตัวตน (1 คนโหวตได้ 1 ครั้ง แก้ไขได้จนกว่าจะปิดโหวต)</p>
      <label class="mt-0" for="voterSelect">รายชื่อผู้โหวต</label>
      <select id="voterSelect">
        <option value="">— เลือกชื่อ —</option>
        ${voters
          .map(
            (v) =>
              `<option value="${v.id}">${esc(v.name)}${v.voted ? " (โหวตแล้ว)" : ""}</option>`
          )
          .join("")}
      </select>
      <div class="btn-row">
        <button class="btn btn-primary" id="btnNext">ถัดไป</button>
      </div>
    </div>`;

  document.getElementById("btnNext").addEventListener("click", () => {
    const id = document.getElementById("voterSelect").value;
    if (!id) return toast("กรุณาเลือกชื่อของคุณ", "err");
    selectedVoterId = id;
    renderScoreTeams();
  });
}

/* ---------- ขั้นที่ 2: ให้คะแนนแต่ละทีม 1-10 ---------- */
let priorScores = {}; // คะแนนเดิม (กรณีแก้ไข)

function scoreOptions(selected) {
  let html = '<option value="">— ให้คะแนน —</option>';
  for (let i = 1; i <= 10; i++) {
    html += `<option value="${i}"${
      Number(selected) === i ? " selected" : ""
    }>${i}</option>`;
  }
  return html;
}

function renderScoreTeams() {
  const voter = voters.find((v) => v.id === selectedVoterId);

  const rows = comp.teams
    .map((t) => {
      const img = t.imageUrl
        ? `<img class="avatar" src="${esc(t.imageUrl)}" onerror="this.classList.add('placeholder');this.removeAttribute('src');this.textContent='👥';" />`
        : `<div class="avatar placeholder">👥</div>`;
      return `
      <div class="score-row">
        ${img}
        <div class="grow">
          <div class="name">${esc(t.name)}</div>
          <div class="meta">${(t.members || []).length} สมาชิก</div>
        </div>
        <select class="score-select" data-team="${t.id}">${scoreOptions(
        priorScores[t.id]
      )}</select>
      </div>`;
    })
    .join("");

  content.innerHTML = `
    <div class="panel">
      <div class="section-eyebrow">ขั้นที่ 2 · ${esc(voter.name)}</div>
      <h2>ให้คะแนนแต่ละทีม</h2>
      <p class="hint">เลือกคะแนน 1–10 ให้ครบทุกทีม (1 = น้อยสุด, 10 = มากสุด) ระบบจะสรุปเป็นคะแนนรวมและคะแนนเฉลี่ย</p>
      <div class="list">${rows}</div>
      <div class="btn-row" style="margin-top:16px;">
        <button class="btn btn-ghost" id="btnBack">ย้อนกลับ</button>
        <button class="btn btn-primary" id="btnSubmit">ส่งคะแนนโหวต</button>
      </div>
    </div>`;

  document.getElementById("btnBack").addEventListener("click", renderPickVoter);
  document.getElementById("btnSubmit").addEventListener("click", submitVote);
}

async function submitVote() {
  const selects = Array.from(document.querySelectorAll(".score-select"));
  const scores = {};
  let missing = 0;
  selects.forEach((s) => {
    const val = s.value;
    if (val) scores[s.dataset.team] = Number(val);
    else missing += 1;
  });

  if (missing > 0) {
    return toast(`กรุณาให้คะแนนให้ครบ ยังเหลืออีก ${missing} ทีม`, "err");
  }

  const btn = document.getElementById("btnSubmit");
  btn.disabled = true;
  btn.textContent = "กำลังส่ง...";
  try {
    await API.submitVote(compId, selectedVoterId, scores);
    priorScores = scores;
    renderDone();
  } catch (e) {
    toast(e.message, "err");
    btn.disabled = false;
    btn.textContent = "ส่งคะแนนโหวต";
  }
}

/* ---------- เสร็จสิ้น ---------- */
function renderDone() {
  const voter = voters.find((v) => v.id === selectedVoterId);
  content.innerHTML = `
    <div class="panel center" style="padding:40px 24px;">
      <div style="font-size:56px;">✅</div>
      <h2>ส่งคะแนนเรียบร้อย</h2>
      <p class="hint">ขอบคุณ ${esc(voter.name)} ที่ร่วมลงคะแนน</p>
      <p class="text-muted" style="font-size:14px;">คุณสามารถแก้ไขคะแนนได้จนกว่าผู้ดูแลจะปิดโหวต</p>
      <div class="btn-row" style="justify-content:center;">
        <button class="btn" id="btnEdit">แก้ไขคะแนน</button>
      </div>
    </div>`;
  document.getElementById("btnEdit").addEventListener("click", renderScoreTeams);
}

function errorBox(title, msg) {
  return `
    <div class="panel center" style="padding:40px 24px;">
      <div style="font-size:48px;">⚠️</div>
      <h2>${esc(title)}</h2>
      <p class="hint">${esc(msg)}</p>
    </div>`;
}

init();
