/*
 * result.js — ลอจิกหน้าประกาศผลโหวต
 */

document.getElementById("topbar").innerHTML = renderTopbar("result");

let results = null;
let currentId = null;

async function init() {
  try {
    const comps = await API.listCompetitions();
    const sel = document.getElementById("compSelect");
    if (!comps.length) {
      sel.innerHTML = '<option value="">ยังไม่มีรายการแข่งขัน</option>';
      return;
    }
    sel.innerHTML =
      '<option value="">— เลือกรายการ —</option>' +
      comps
        .map(
          (c) =>
            `<option value="${c.id}">${esc(c.name)}${
              c.status === "closed" ? " ✓" : ""
            }</option>`
        )
        .join("");
    const pre = qs("c");
    if (pre && comps.some((c) => c.id === pre)) {
      sel.value = pre;
      await loadResult(pre);
    }
    sel.addEventListener("change", () => loadResult(sel.value));
  } catch (e) {
    toast(e.message, "err");
  }
}

async function loadResult(id) {
  if (!id) {
    document.getElementById("resultArea").classList.add("hidden");
    return;
  }
  currentId = id;
  try {
    results = await API.getResults(id);
  } catch (e) {
    return toast(e.message, "err");
  }
  const statusText =
    results.status === "closed"
      ? "ปิดโหวตแล้ว — ผลอย่างเป็นทางการ"
      : results.status === "open"
      ? "กำลังเปิดโหวต — ผลอาจเปลี่ยนแปลง"
      : "ยังไม่เปิดโหวต";
  document.getElementById(
    "statusLine"
  ).innerHTML = `${statusBadge(results.status)} · ${statusText} · โหวตแล้ว ${results.votedCount}/${results.voterCount} คน`;

  document.getElementById("resultArea").classList.remove("hidden");
  renderPodium();
  renderFullRank();
}

function avatarHtml(t, cls) {
  return t.imageUrl
    ? `<img class="avatar ${cls || ""}" src="${esc(t.imageUrl)}" onerror="this.classList.add('placeholder');this.removeAttribute('src');this.textContent='👥';" />`
    : `<div class="avatar placeholder ${cls || ""}">👥</div>`;
}

function renderPodium() {
  const top = results.teams.slice(0, 3);
  const box = document.getElementById("podium");
  if (!top.length || top.every((t) => t.count === 0)) {
    box.innerHTML =
      '<div class="empty"><div class="big">🗳️</div>ยังไม่มีคะแนนโหวต</div>';
    return;
  }
  const medals = ["🥇", "🥈", "🥉"];
  // จัดเรียงตำแหน่งโพเดียม: ที่2 ซ้าย, ที่1 กลาง, ที่3 ขวา
  const order = [top[1], top[0], top[2]];
  const podClass = ["pod-2", "pod-1", "pod-3"];
  const medalIdx = [1, 0, 2];
  box.className = "podium";
  box.innerHTML = order
    .map((t, i) => {
      if (!t) return `<div class="pod ${podClass[i]}"></div>`;
      return `
      <div class="pod ${podClass[i]}">
        <div class="medal">${medals[medalIdx[i]]}</div>
        ${avatarHtml(t)}
        <div class="pname">${esc(t.name)}</div>
        <div class="pscore">เฉลี่ย ${t.avg.toFixed(2)}</div>
        <div class="meta">รวม ${t.total} · ${t.count} คน</div>
      </div>`;
    })
    .join("");
}

function renderFullRank() {
  const box = document.getElementById("fullRank");
  box.innerHTML = results.teams
    .map((t) => {
      const medal =
        t.rank === 1 ? "🥇" : t.rank === 2 ? "🥈" : t.rank === 3 ? "🥉" : t.rank;
      return `
      <div class="rank-row">
        <div class="rank-badge">${medal}</div>
        ${avatarHtml(t)}
        <div class="grow">
          <div class="name">${esc(t.name)}</div>
          <div class="meta">คะแนนรวม ${t.total} · จากผู้โหวต ${t.count} คน</div>
        </div>
        <div style="text-align:right;">
          <div style="font-family:var(--font-display);font-weight:700;color:var(--gold);font-size:20px;line-height:1;">
            ${t.avg.toFixed(2)}
          </div>
          <div class="meta" style="font-size:12px;">เฉลี่ย</div>
        </div>
      </div>`;
    })
    .join("");
}

/* ---------------- โหมดประกาศเต็มจอ ---------------- */
let announceStep = 0; // 0=ที่3, 1=ที่2, 2=ที่1
const announceEl = document.getElementById("announce");

document.getElementById("btnAnnounce").addEventListener("click", () => {
  if (!results || results.teams.every((t) => t.count === 0)) {
    return toast("ยังไม่มีคะแนนให้ประกาศ", "err");
  }
  FX.unlock();
  announceStep = 0;
  announceEl.classList.remove("hidden");
  showAnnounceStep();
});

function showAnnounceStep() {
  const ranks = [
    { idx: 2, eyebrow: "รางวัลที่ 3", medal: "🥉" },
    { idx: 1, eyebrow: "รางวัลที่ 2", medal: "🥈" },
    { idx: 0, eyebrow: "รางวัลชนะเลิศ", medal: "🥇" },
  ];
  const r = ranks[announceStep];
  const team = results.teams[r.idx];

  document.getElementById("aEyebrow").textContent = r.eyebrow;
  document.getElementById("aMedal").textContent = r.medal;
  const nameEl = document.getElementById("aName");
  nameEl.textContent = team ? team.name : "—";
  nameEl.classList.remove("flash");
  void nameEl.offsetWidth;
  nameEl.style.animation = "none";
  void nameEl.offsetWidth;
  nameEl.style.animation = "";

  document.getElementById("aScore").textContent = team
    ? "เฉลี่ย " + team.avg.toFixed(2) + " · รวม " + team.total
    : "";
  document.getElementById("aMembers").innerHTML = team
    ? (team.members || [])
        .map((m) => `<span class="member-chip">${esc(m)}</span>`)
        .join("")
    : "";

  FX.fanfare();
  FX.confetti(announceStep === 2 ? 300 : 160);

  const nextBtn = document.getElementById("aNext");
  const hint = document.getElementById("aHint");
  if (announceStep >= 2) {
    nextBtn.classList.add("hidden");
    hint.textContent = "🎊 ยินดีด้วยกับทุกทีม 🎊";
  } else {
    nextBtn.classList.remove("hidden");
    nextBtn.textContent = "เฉลยต่อ ▶";
    hint.textContent = "กดปุ่มเพื่อเฉลยลำดับถัดไป";
  }
}

document.getElementById("aNext").addEventListener("click", () => {
  if (announceStep < 2) {
    announceStep++;
    showAnnounceStep();
  }
});

document.getElementById("aClose").addEventListener("click", () => {
  announceEl.classList.add("hidden");
});

init();
