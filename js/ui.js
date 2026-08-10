/*
 * ui.js — ตัวช่วยส่วนติดต่อผู้ใช้ที่ใช้ร่วมกันทุกหน้า
 */

/** แปลงข้อความให้ปลอดภัยก่อนใส่ใน HTML */
function esc(str) {
  const d = document.createElement("div");
  d.textContent = str == null ? "" : String(str);
  return d.innerHTML;
}

/** แสดงข้อความแจ้งเตือนชั่วคราว */
function toast(msg, type) {
  let el = document.getElementById("toast");
  if (!el) {
    el = document.createElement("div");
    el.id = "toast";
    document.body.appendChild(el);
  }
  el.className = "";
  el.textContent = msg;
  if (type) el.classList.add(type);
  requestAnimationFrame(() => el.classList.add("show"));
  clearTimeout(el._t);
  el._t = setTimeout(() => el.classList.remove("show"), 2600);
}

/** สร้างแถบหัวเว็บ + เมนู */
function renderTopbar(active) {
  const modeFlag =
    API_MODE === "gas"
      ? '<span class="mode-flag gas">เชื่อมต่อ Google Sheets</span>'
      : '<span class="mode-flag local">โหมดทดลอง (เครื่องนี้)</span>';

  const links = [
    ["index.html", "หน้าแรก", "home"],
    ["admin.html", "แอดมิน", "admin"],
    ["draw.html", "สุ่มการแข่งขัน", "draw"],
    ["result.html", "ประกาศผล", "result"],
  ];

  const nav = links
    .map(
      ([href, label, key]) =>
        `<a href="${href}" class="${key === active ? "active" : ""}">${label}</a>`
    )
    .join("");

  return `
    <div class="topbar">
      <div class="brand">
        <div class="mark">🏆</div>
        <div>
          <h1>${esc(CONFIG.APP_NAME)}</h1>
          <div class="sub">${esc(CONFIG.SCHOOL_NAME)} · ${modeFlag}</div>
        </div>
      </div>
      <nav class="nav">${nav}</nav>
    </div>`;
}

/** คัดลอกข้อความไปคลิปบอร์ด */
async function copyText(text) {
  try {
    await navigator.clipboard.writeText(text);
    toast("คัดลอกลิงก์แล้ว", "ok");
  } catch (e) {
    // สำรอง: เลือกข้อความให้ผู้ใช้ก๊อปเอง
    const ta = document.createElement("textarea");
    ta.value = text;
    document.body.appendChild(ta);
    ta.select();
    try {
      document.execCommand("copy");
      toast("คัดลอกลิงก์แล้ว", "ok");
    } catch (_) {
      toast("คัดลอกไม่สำเร็จ กรุณาคัดลอกเอง", "err");
    }
    document.body.removeChild(ta);
  }
}

/** อ่านค่าพารามิเตอร์จาก URL */
function qs(name) {
  return new URLSearchParams(location.search).get(name);
}

/** ป้ายสถานะรายการแข่งขัน */
function statusBadge(status) {
  const map = {
    setup: ["setup", "ยังไม่เปิดโหวต"],
    open: ["open", "เปิดโหวต"],
    closed: ["closed", "ปิดโหวตแล้ว"],
  };
  const [cls, label] = map[status] || map.setup;
  return `<span class="badge ${cls}">${label}</span>`;
}
