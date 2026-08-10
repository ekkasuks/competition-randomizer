/*
 * draw.js — ลอจิกหน้าสุ่มการแข่งขัน (จัดคิวทีม)
 */

document.getElementById("topbar").innerHTML = renderTopbar("draw");

let comp = null; // รายการที่เลือก
let remaining = []; // ทีมที่ยังไม่ถูกสุ่ม
let queue = []; // teamId ตามลำดับที่สุ่มได้
let spinning = false;

const reel = document.getElementById("reel");
const reelImg = document.getElementById("reelImg");
const revealMembers = document.getElementById("revealMembers");
const stageLabel = document.getElementById("stageLabel");
const btnDraw = document.getElementById("btnDraw");

/* ---------------- โหลดรายการ ---------------- */
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
      comps.map((c) => `<option value="${c.id}">${esc(c.name)}</option>`).join("");

    // ถ้ามี ?c= ให้เลือกอัตโนมัติ
    const pre = qs("c");
    if (pre && comps.some((c) => c.id === pre)) {
      sel.value = pre;
      await selectComp(pre);
    }
    sel.addEventListener("change", () => selectComp(sel.value));
  } catch (e) {
    toast(e.message, "err");
  }
}

async function selectComp(id) {
  if (!id) {
    document.getElementById("drawArea").classList.add("hidden");
    return;
  }
  try {
    comp = await API.getCompetition(id);
  } catch (e) {
    return toast(e.message, "err");
  }
  queue = (comp.drawOrder || []).filter((tid) =>
    comp.teams.some((t) => t.id === tid)
  );
  refreshRemaining();
  document.getElementById("drawArea").classList.remove("hidden");
  resetStageDisplay();
  renderLists();
}

function refreshRemaining() {
  remaining = comp.teams.filter((t) => !queue.includes(t.id));
}

function resetStageDisplay() {
  reel.textContent = remaining.length
    ? "กดปุ่มเพื่อเริ่มสุ่ม"
    : "สุ่มครบทุกทีมแล้ว 🎉";
  reel.classList.remove("reveal-flash");
  reelImg.style.display = "none";
  revealMembers.innerHTML = "";
  stageLabel.textContent = remaining.length ? "พร้อมสุ่ม" : "เสร็จสิ้น";
  btnDraw.disabled = remaining.length === 0;
  btnDraw.textContent = remaining.length ? "🎲 สุ่มทีม" : "สุ่มครบแล้ว";
}

/* ---------------- แสดงรายการคิว/คงเหลือ ---------------- */
function teamById(id) {
  return comp.teams.find((t) => t.id === id);
}

function renderLists() {
  const q = document.getElementById("queueList");
  if (!queue.length) {
    q.innerHTML = '<div class="empty">ยังไม่มีทีมที่สุ่ม</div>';
  } else {
    q.innerHTML = queue
      .map((tid, i) => {
        const t = teamById(tid);
        if (!t) return "";
        const img = t.imageUrl
          ? `<img class="avatar" src="${esc(t.imageUrl)}" onerror="this.classList.add('placeholder');this.removeAttribute('src');this.textContent='👥';" />`
          : `<div class="avatar placeholder">👥</div>`;
        return `<div class="row-item">
          <div class="queue-num">${i + 1}</div>
          ${img}
          <div class="grow"><div class="name">${esc(t.name)}</div>
          <div class="meta">${(t.members || []).length} สมาชิก</div></div>
        </div>`;
      })
      .join("");
  }

  const r = document.getElementById("remainList");
  if (!remaining.length) {
    r.innerHTML = '<div class="empty">— ครบแล้ว —</div>';
  } else {
    r.innerHTML = remaining
      .map((t) => `<div class="row-item"><div class="grow"><div class="name">${esc(t.name)}</div></div></div>`)
      .join("");
  }
}

/* ---------------- การสุ่ม ---------------- */
btnDraw.addEventListener("click", () => {
  if (spinning || !remaining.length) return;
  FX.unlock(); // ปลดล็อกเสียงจาก user gesture
  spin();
});

function spin() {
  spinning = true;
  btnDraw.disabled = true;
  reel.classList.add("spinning");
  reelImg.style.display = "none";
  revealMembers.innerHTML = "";
  stageLabel.textContent = "กำลังสุ่ม...";

  const duration = 2600;
  const winner = remaining[(Math.random() * remaining.length) | 0];
  const stopRiser = FX.riser(duration);

  const start = performance.now();
  let lastSwap = 0;

  function frame(now) {
    const elapsed = now - start;
    const progress = Math.min(elapsed / duration, 1);
    // ช่วงห่างการสลับชื่อจะค่อยๆ ช้าลง (ease-out)
    const interval = 60 + progress * progress * 320;
    if (now - lastSwap >= interval) {
      const pick = remaining[(Math.random() * remaining.length) | 0];
      reel.textContent = pick.name;
      FX.tick();
      lastSwap = now;
    }
    if (progress < 1) {
      requestAnimationFrame(frame);
    } else {
      stopRiser();
      revealWinner(winner);
    }
  }
  requestAnimationFrame(frame);
}

function revealWinner(team) {
  reel.classList.remove("spinning");
  reel.textContent = team.name;
  reel.classList.remove("reveal-flash");
  void reel.offsetWidth; // reflow เพื่อรีสตาร์ท animation
  reel.classList.add("reveal-flash");
  stageLabel.textContent = "ทีมที่สุ่มได้";

  if (team.imageUrl) {
    reelImg.src = team.imageUrl;
    reelImg.style.display = "block";
    reelImg.onerror = () => {
      reelImg.style.display = "none";
    };
  } else {
    reelImg.style.display = "none";
  }

  const members = team.members || [];
  revealMembers.innerHTML = members
    .map(
      (m, i) =>
        `<span class="member-chip" style="animation-delay:${0.15 + i * 0.08}s">${esc(m)}</span>`
    )
    .join("");

  FX.fanfare();
  FX.confetti(180);

  // บันทึกคิว
  queue.push(team.id);
  refreshRemaining();
  renderLists();
  persistOrder();

  spinning = false;
  btnDraw.disabled = remaining.length === 0;
  btnDraw.textContent = remaining.length ? "🎲 สุ่มทีมต่อไป" : "สุ่มครบแล้ว";
  if (!remaining.length) stageLabel.textContent = "สุ่มครบทุกทีมแล้ว 🎉";
}

async function persistOrder() {
  try {
    await API.saveDrawOrder(comp.id, queue);
  } catch (e) {
    toast("บันทึกลำดับไม่สำเร็จ: " + e.message, "err");
  }
}

/* ---------------- รีเซ็ต ---------------- */
document.getElementById("btnReset").addEventListener("click", async () => {
  if (!confirm("รีเซ็ตการสุ่มทั้งหมดของรายการนี้?")) return;
  queue = [];
  refreshRemaining();
  await persistOrder();
  resetStageDisplay();
  renderLists();
  toast("รีเซ็ตแล้ว", "ok");
});

/* ---------------- ปุ่มเสียง ---------------- */
const btnMute = document.getElementById("btnMute");
btnMute.addEventListener("click", () => {
  const m = !FX.isMuted();
  FX.setMuted(m);
  btnMute.textContent = m ? "🔇 ปิดเสียง" : "🔊 เสียง";
});

init();
