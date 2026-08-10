/*
 * admin.js — ลอจิกหน้าแอดมิน
 */

document.getElementById("topbar").innerHTML = renderTopbar("admin");

// สถานะหน้า
let currentCompId = null;
let currentComp = null; // {id,name,status,teams:[],drawOrder:[]}
let editingTeamId = null;

/* ---------------- ประตูรหัสแอดมิน ---------------- */
const gate = document.getElementById("gate");
const app = document.getElementById("app");

function tryEnterApp() {
  gate.classList.add("hidden");
  app.classList.remove("hidden");
  loadCompetitions();
}

document.getElementById("btnLogin").addEventListener("click", () => {
  const key = document.getElementById("adminKey").value.trim();
  if (key !== CONFIG.ADMIN_KEY) {
    toast("รหัสผ่านไม่ถูกต้อง", "err");
    return;
  }
  sessionStorage.setItem("crv_admin", "1");
  tryEnterApp();
});

document.getElementById("adminKey").addEventListener("keydown", (e) => {
  if (e.key === "Enter") document.getElementById("btnLogin").click();
});

if (sessionStorage.getItem("crv_admin") === "1") {
  tryEnterApp();
}

/* ---------------- รายการแข่งขัน ---------------- */
async function loadCompetitions() {
  try {
    const comps = await API.listCompetitions();
    const box = document.getElementById("compList");
    if (!comps.length) {
      box.innerHTML =
        '<div class="empty"><div class="big">📋</div>ยังไม่มีรายการแข่งขัน เพิ่มรายการแรกด้านบน</div>';
      return;
    }
    box.innerHTML = comps
      .map(
        (c) => `
      <div class="row-item">
        <div class="grow">
          <div class="name">${esc(c.name)}</div>
          <div class="meta">${statusBadge(c.status)}</div>
        </div>
        <button class="btn btn-sm" data-open="${c.id}">จัดการ</button>
      </div>`
      )
      .join("");
    box.querySelectorAll("[data-open]").forEach((b) =>
      b.addEventListener("click", () => openComp(b.dataset.open))
    );
  } catch (e) {
    toast(e.message, "err");
  }
}

document.getElementById("btnAddComp").addEventListener("click", async () => {
  const name = document.getElementById("newCompName").value.trim();
  if (!name) return toast("กรุณาใส่ชื่อรายการ", "err");
  try {
    const r = await API.saveCompetition({ name });
    document.getElementById("newCompName").value = "";
    toast("เพิ่มรายการแล้ว", "ok");
    await loadCompetitions();
    openComp(r.id);
  } catch (e) {
    toast(e.message, "err");
  }
});

/* ---------------- เปิดรายละเอียดรายการ ---------------- */
async function openComp(id) {
  currentCompId = id;
  editingTeamId = null;
  try {
    currentComp = await API.getCompetition(id);
  } catch (e) {
    return toast(e.message, "err");
  }
  document.getElementById("compDetail").classList.remove("hidden");
  document.getElementById("detailTitle").textContent = currentComp.name;
  document.getElementById("detailStatus").innerHTML = statusBadge(
    currentComp.status
  );

  document.getElementById("linkToDraw").href =
    "draw.html?c=" + encodeURIComponent(id);
  document.getElementById("linkToResult").href =
    "result.html?c=" + encodeURIComponent(id);

  renderTeams();
  await renderVoterSection();
  document.getElementById("compDetail").scrollIntoView({ behavior: "smooth" });
}

/* ---------------- ทีม ---------------- */
function renderTeams() {
  const box = document.getElementById("teamList");
  const teams = currentComp.teams || [];
  if (!teams.length) {
    box.innerHTML =
      '<div class="empty"><div class="big">👥</div>ยังไม่มีทีม เพิ่มทีมแรกด้านบน</div>';
    return;
  }
  box.innerHTML = teams
    .map((t) => {
      const img = t.imageUrl
        ? `<img class="avatar" src="${esc(t.imageUrl)}" alt="" onerror="this.classList.add('placeholder');this.removeAttribute('src');this.textContent='🖼️';" />`
        : `<div class="avatar placeholder">👥</div>`;
      const memberCount = (t.members || []).length;
      return `
      <div class="row-item">
        ${img}
        <div class="grow">
          <div class="name">${esc(t.name)}</div>
          <div class="meta">${memberCount} สมาชิก</div>
        </div>
        <button class="btn btn-sm" data-edit="${t.id}">แก้ไข</button>
        <button class="btn btn-sm btn-danger" data-del="${t.id}">ลบ</button>
      </div>`;
    })
    .join("");

  box.querySelectorAll("[data-edit]").forEach((b) =>
    b.addEventListener("click", () => startEditTeam(b.dataset.edit))
  );
  box.querySelectorAll("[data-del]").forEach((b) =>
    b.addEventListener("click", () => deleteTeam(b.dataset.del))
  );
}

function startEditTeam(teamId) {
  const t = currentComp.teams.find((x) => x.id === teamId);
  if (!t) return;
  editingTeamId = teamId;
  document.getElementById("teamName").value = t.name;
  document.getElementById("teamImage").value = t.imageUrl || "";
  document.getElementById("teamMembers").value = (t.members || []).join("\n");
  document.getElementById("btnSaveTeam").textContent = "อัปเดตทีม";
  document.getElementById("btnCancelTeam").classList.remove("hidden");
  document.getElementById("teamName").focus();
}

function resetTeamForm() {
  editingTeamId = null;
  document.getElementById("teamName").value = "";
  document.getElementById("teamImage").value = "";
  document.getElementById("teamMembers").value = "";
  document.getElementById("btnSaveTeam").textContent = "บันทึกทีม";
  document.getElementById("btnCancelTeam").classList.add("hidden");
}

document
  .getElementById("btnCancelTeam")
  .addEventListener("click", resetTeamForm);

document.getElementById("btnSaveTeam").addEventListener("click", async () => {
  const name = document.getElementById("teamName").value.trim();
  if (!name) return toast("กรุณาใส่ชื่อทีม", "err");
  const imageUrl = document.getElementById("teamImage").value.trim();
  const members = document
    .getElementById("teamMembers")
    .value.split("\n")
    .map((s) => s.trim())
    .filter((s) => s);
  try {
    await API.saveTeam(currentCompId, {
      id: editingTeamId,
      name,
      imageUrl,
      members,
    });
    toast(editingTeamId ? "อัปเดตทีมแล้ว" : "เพิ่มทีมแล้ว", "ok");
    resetTeamForm();
    currentComp = await API.getCompetition(currentCompId);
    renderTeams();
  } catch (e) {
    toast(e.message, "err");
  }
});

async function deleteTeam(teamId) {
  const t = currentComp.teams.find((x) => x.id === teamId);
  if (!confirm(`ลบทีม "${t ? t.name : ""}" ?`)) return;
  try {
    await API.deleteTeam(currentCompId, teamId);
    toast("ลบทีมแล้ว", "ok");
    currentComp = await API.getCompetition(currentCompId);
    renderTeams();
  } catch (e) {
    toast(e.message, "err");
  }
}

/* ---------------- ผู้โหวต + การโหวต ---------------- */
async function renderVoterSection() {
  let voters = [];
  try {
    voters = await API.getVoters(currentCompId);
  } catch (e) {
    /* ยังไม่มี */
  }
  document.getElementById("voterNames").value = voters
    .map((v) => v.name)
    .join("\n");

  const status = currentComp.status;
  const ctr = document.getElementById("voteControls");
  const voteUrl = buildVoteUrl(currentCompId);

  let html = "";
  if (status === "setup") {
    html += `<button class="btn btn-pop" id="btnOpenVote">▶ เปิดโหวต</button>`;
  } else if (status === "open") {
    html += `
      <div class="row-item" style="margin-bottom:10px;">
        <div class="grow">
          <div class="meta">ลิงก์สำหรับผู้โหวต</div>
          <div class="name" style="font-size:13px;word-break:break-all;">${esc(voteUrl)}</div>
        </div>
        <button class="btn btn-sm btn-primary" id="btnCopyVote">คัดลอกลิงก์</button>
      </div>
      <div class="btn-row">
        <button class="btn btn-danger" id="btnCloseVote">■ สิ้นสุดการโหวตและคำนวณผล</button>
      </div>`;
  } else if (status === "closed") {
    html += `
      <div class="badge closed" style="margin-bottom:10px;">ปิดโหวตแล้ว — คำนวณผลเรียบร้อย</div>
      <div class="btn-row">
        <a class="btn btn-primary" href="result.html?c=${encodeURIComponent(currentCompId)}">ดูหน้าประกาศผล</a>
        <button class="btn btn-ghost" id="btnReopenVote">เปิดโหวตอีกครั้ง</button>
      </div>`;
  }
  ctr.innerHTML = html;

  const bOpen = document.getElementById("btnOpenVote");
  if (bOpen) bOpen.addEventListener("click", () => changeStatus("open"));
  const bClose = document.getElementById("btnCloseVote");
  if (bClose) bClose.addEventListener("click", () => changeStatus("closed"));
  const bReopen = document.getElementById("btnReopenVote");
  if (bReopen) bReopen.addEventListener("click", () => changeStatus("open"));
  const bCopy = document.getElementById("btnCopyVote");
  if (bCopy) bCopy.addEventListener("click", () => copyText(voteUrl));

  // ความคืบหน้าการโหวต
  const prog = document.getElementById("voteProgress");
  if (status === "open" || status === "closed") {
    try {
      const res = await API.getResults(currentCompId);
      prog.textContent = `โหวตแล้ว ${res.votedCount} / ${res.voterCount} คน`;
    } catch (e) {
      prog.textContent = "";
    }
  } else {
    prog.textContent = "";
  }
}

function buildVoteUrl(compId) {
  const base = location.href.replace(/admin\.html.*$/, "");
  return base + "vote.html?c=" + encodeURIComponent(compId);
}

document.getElementById("btnSaveVoters").addEventListener("click", async () => {
  const names = document
    .getElementById("voterNames")
    .value.split("\n")
    .map((s) => s.trim())
    .filter((s) => s);
  if (!names.length) return toast("กรุณาใส่รายชื่อผู้โหวตอย่างน้อย 1 คน", "err");
  try {
    await API.saveVoters(currentCompId, names);
    toast("บันทึกรายชื่อผู้โหวตแล้ว", "ok");
    await renderVoterSection();
  } catch (e) {
    toast(e.message, "err");
  }
});

async function changeStatus(status) {
  if (status === "closed") {
    if (!confirm("สิ้นสุดการโหวตและคำนวณผล? ผู้โหวตจะลงคะแนนต่อไม่ได้")) return;
  }
  try {
    await API.setStatus(currentCompId, status);
    currentComp.status = status;
    document.getElementById("detailStatus").innerHTML = statusBadge(status);
    await renderVoterSection();
    await loadCompetitions();
    toast(
      status === "open"
        ? "เปิดโหวตแล้ว"
        : status === "closed"
        ? "ปิดโหวตและคำนวณผลแล้ว"
        : "อัปเดตสถานะแล้ว",
      "ok"
    );
  } catch (e) {
    toast(e.message, "err");
  }
}

/* ---------------- ลบรายการ ---------------- */
document.getElementById("btnDeleteComp").addEventListener("click", async () => {
  if (
    !confirm(
      `ลบรายการ "${currentComp.name}" พร้อมทีม สมาชิก และผลโหวตทั้งหมด?`
    )
  )
    return;
  try {
    await API.deleteCompetition(currentCompId);
    toast("ลบรายการแล้ว", "ok");
    document.getElementById("compDetail").classList.add("hidden");
    currentCompId = null;
    await loadCompetitions();
  } catch (e) {
    toast(e.message, "err");
  }
});
