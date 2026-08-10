/*
 * api.js — ชั้นเชื่อมต่อข้อมูล (Data layer)
 * ------------------------------------------------------------------
 * มี 2 backend ที่ให้ผลลัพธ์รูปแบบเดียวกันทุกฟังก์ชัน:
 *   - LocalBackend : เก็บใน localStorage (ทดลองเครื่องเดียว)
 *   - GasBackend   : เรียก Google Apps Script (ใช้จริง หลายเครื่อง)
 *
 * ทุกเมธอดคืนค่าเป็น Promise ที่ resolve ด้วยข้อมูล หรือ reject ด้วย Error
 *
 * โครงสร้างข้อมูลหลัก:
 *   competition = { id, name, status, drawOrder:[teamId], createdAt }
 *       status: "setup" | "open" | "closed"
 *   team        = { id, compId, name, imageUrl, members:[string] }
 *   voter       = { id, compId, name, voted:boolean }
 *   result      = { teams:[{...team, score, r1, r2, r3, rank}], voterCount, votedCount }
 */

/* =========================================================
 *  ตัวช่วยทั่วไป
 * ========================================================= */
function uid(prefix) {
  return (
    (prefix || "id") +
    "_" +
    Date.now().toString(36) +
    Math.random().toString(36).slice(2, 7)
  );
}

/* =========================================================
 *  LocalBackend — localStorage
 * ========================================================= */
const LocalBackend = (() => {
  const KEY = "crv_db_v1";

  function load() {
    try {
      return (
        JSON.parse(localStorage.getItem(KEY)) || {
          competitions: {},
          teams: {},
          voters: {},
          votes: {},
        }
      );
    } catch (e) {
      return { competitions: {}, teams: {}, voters: {}, votes: {} };
    }
  }

  function save(db) {
    localStorage.setItem(KEY, JSON.stringify(db));
  }

  // ---------- Competition ----------
  async function listCompetitions() {
    const db = load();
    return Object.values(db.competitions)
      .map((c) => ({ id: c.id, name: c.name, status: c.status }))
      .sort((a, b) => (a.name > b.name ? 1 : -1));
  }

  async function getCompetition(id) {
    const db = load();
    const comp = db.competitions[id];
    if (!comp) throw new Error("ไม่พบรายการแข่งขันนี้");
    const teams = Object.values(db.teams)
      .filter((t) => t.compId === id)
      .map((t) => ({
        id: t.id,
        name: t.name,
        imageUrl: t.imageUrl || "",
        members: t.members || [],
      }));
    return {
      id: comp.id,
      name: comp.name,
      status: comp.status,
      drawOrder: comp.drawOrder || [],
      teams,
    };
  }

  async function saveCompetition(payload) {
    const db = load();
    if (payload.id && db.competitions[payload.id]) {
      db.competitions[payload.id].name = payload.name;
    } else {
      const id = uid("comp");
      db.competitions[id] = {
        id,
        name: payload.name,
        status: "setup",
        drawOrder: [],
        createdAt: Date.now(),
      };
      payload = { id };
    }
    save(db);
    return { id: payload.id };
  }

  async function deleteCompetition(id) {
    const db = load();
    delete db.competitions[id];
    Object.values(db.teams)
      .filter((t) => t.compId === id)
      .forEach((t) => delete db.teams[t.id]);
    Object.values(db.voters)
      .filter((v) => v.compId === id)
      .forEach((v) => delete db.voters[v.id]);
    Object.values(db.votes)
      .filter((v) => v.compId === id)
      .forEach((v) => delete db.votes[v.id]);
    save(db);
    return { ok: true };
  }

  // ---------- Team ----------
  async function saveTeam(compId, team) {
    const db = load();
    if (team.id && db.teams[team.id]) {
      Object.assign(db.teams[team.id], {
        name: team.name,
        imageUrl: team.imageUrl || "",
        members: team.members || [],
      });
    } else {
      const id = uid("team");
      db.teams[id] = {
        id,
        compId,
        name: team.name,
        imageUrl: team.imageUrl || "",
        members: team.members || [],
      };
      team = { id };
    }
    save(db);
    return { id: team.id };
  }

  async function deleteTeam(compId, teamId) {
    const db = load();
    delete db.teams[teamId];
    const comp = db.competitions[compId];
    if (comp && comp.drawOrder) {
      comp.drawOrder = comp.drawOrder.filter((x) => x !== teamId);
    }
    save(db);
    return { ok: true };
  }

  // ---------- Draw order ----------
  async function saveDrawOrder(compId, orderIds) {
    const db = load();
    if (db.competitions[compId]) {
      db.competitions[compId].drawOrder = orderIds;
      save(db);
    }
    return { ok: true };
  }

  // ---------- Status ----------
  async function setStatus(compId, status) {
    const db = load();
    if (db.competitions[compId]) {
      db.competitions[compId].status = status;
      save(db);
    }
    return { ok: true };
  }

  // ---------- Voters ----------
  async function saveVoters(compId, names) {
    const db = load();
    const clean = names.map((n) => String(n).trim()).filter((n) => n);
    const existing = Object.values(db.voters).filter((v) => v.compId === compId);
    const existingNames = existing.map((v) => v.name);

    // ลบผู้โหวตที่ชื่อหายไป + โหวตของเขา (คงคะแนนของชื่อที่ยังอยู่)
    existing
      .filter((v) => !clean.includes(v.name))
      .forEach((v) => {
        Object.values(db.votes)
          .filter((vt) => vt.voterId === v.id)
          .forEach((vt) => delete db.votes[vt.id]);
        delete db.voters[v.id];
      });

    // เพิ่มชื่อใหม่
    clean.forEach((name) => {
      if (!existingNames.includes(name)) {
        const id = uid("voter");
        db.voters[id] = { id, compId, name };
      }
    });

    save(db);
    return { ok: true };
  }

  async function getVoters(compId) {
    const db = load();
    const voters = Object.values(db.voters).filter((v) => v.compId === compId);
    const votedSet = new Set(
      Object.values(db.votes)
        .filter((v) => v.compId === compId)
        .map((v) => v.voterId)
    );
    return voters
      .map((v) => ({ id: v.id, name: v.name, voted: votedSet.has(v.id) }))
      .sort((a, b) => (a.name > b.name ? 1 : -1));
  }

  // ---------- Vote ----------
  // scores = { [teamId]: number(1..10) }
  async function submitVote(compId, voterId, scores) {
    const db = load();
    const comp = db.competitions[compId];
    if (!comp) throw new Error("ไม่พบรายการแข่งขัน");
    if (comp.status !== "open") throw new Error("รายการนี้ยังไม่เปิด/ปิดโหวตแล้ว");
    // ลบโหวตเดิมของผู้โหวตคนนี้ (อนุญาตแก้ไข)
    Object.values(db.votes)
      .filter((v) => v.compId === compId && v.voterId === voterId)
      .forEach((v) => delete db.votes[v.id]);
    const id = uid("vote");
    db.votes[id] = {
      id,
      compId,
      voterId,
      scores: scores || {},
      updatedAt: Date.now(),
    };
    save(db);
    return { ok: true };
  }

  // ---------- Results ----------
  async function getResults(compId) {
    const db = load();
    const comp = db.competitions[compId];
    if (!comp) throw new Error("ไม่พบรายการแข่งขัน");
    const teams = Object.values(db.teams).filter((t) => t.compId === compId);
    const voters = Object.values(db.voters).filter((v) => v.compId === compId);
    const votes = Object.values(db.votes).filter((v) => v.compId === compId);

    const agg = {};
    teams.forEach((t) => {
      agg[t.id] = { total: 0, count: 0 };
    });
    votes.forEach((v) => {
      const s = v.scores || {};
      Object.keys(s).forEach((tid) => {
        const val = Number(s[tid]);
        if (agg[tid] && val > 0) {
          agg[tid].total += val;
          agg[tid].count += 1;
        }
      });
    });

    const ranked = teams
      .map((t) => {
        const a = agg[t.id];
        const avg = a.count ? a.total / a.count : 0;
        return {
          id: t.id,
          name: t.name,
          imageUrl: t.imageUrl || "",
          members: t.members || [],
          total: a.total,
          count: a.count,
          avg: Math.round(avg * 100) / 100,
        };
      })
      .sort((a, b) => b.avg - a.avg || b.count - a.count || b.total - a.total);

    ranked.forEach((t, i) => {
      t.rank = i + 1;
    });

    return {
      teams: ranked,
      voterCount: voters.length,
      votedCount: new Set(votes.map((v) => v.voterId)).size,
      status: comp.status,
    };
  }

  return {
    listCompetitions,
    getCompetition,
    saveCompetition,
    deleteCompetition,
    saveTeam,
    deleteTeam,
    saveDrawOrder,
    setStatus,
    saveVoters,
    getVoters,
    submitVote,
    getResults,
  };
})();

/* =========================================================
 *  GasBackend — Google Apps Script
 * ========================================================= */
const GasBackend = (() => {
  async function callGet(action, params) {
    const url = new URL(CONFIG.GAS_URL);
    url.searchParams.set("action", action);
    Object.entries(params || {}).forEach(([k, v]) =>
      url.searchParams.set(k, v)
    );
    const res = await fetch(url.toString(), { method: "GET" });
    const json = await res.json();
    if (!json.ok) throw new Error(json.error || "เกิดข้อผิดพลาด");
    return json.data;
  }

  async function callPost(action, payload) {
    // ใช้ text/plain เพื่อเลี่ยง CORS preflight ของ Apps Script
    const body = JSON.stringify({
      action,
      adminKey: CONFIG.ADMIN_KEY,
      ...payload,
    });
    const res = await fetch(CONFIG.GAS_URL, {
      method: "POST",
      headers: { "Content-Type": "text/plain;charset=utf-8" },
      body,
    });
    const json = await res.json();
    if (!json.ok) throw new Error(json.error || "เกิดข้อผิดพลาด");
    return json.data;
  }

  return {
    listCompetitions: () => callGet("listCompetitions"),
    getCompetition: (id) => callGet("getCompetition", { id }),
    saveCompetition: (payload) => callPost("saveCompetition", payload),
    deleteCompetition: (id) => callPost("deleteCompetition", { id }),
    saveTeam: (compId, team) => callPost("saveTeam", { compId, team }),
    deleteTeam: (compId, teamId) => callPost("deleteTeam", { compId, teamId }),
    saveDrawOrder: (compId, orderIds) =>
      callPost("saveDrawOrder", { compId, orderIds }),
    setStatus: (compId, status) => callPost("setStatus", { compId, status }),
    saveVoters: (compId, names) => callPost("saveVoters", { compId, names }),
    getVoters: (compId) => callGet("getVoters", { compId }),
    submitVote: (compId, voterId, scores) =>
      callPost("submitVote", { compId, voterId, scores }),
    getResults: (compId) => callGet("getResults", { compId }),
  };
})();

/* =========================================================
 *  เลือก backend ตาม config
 * ========================================================= */
const API =
  CONFIG.GAS_URL && CONFIG.GAS_URL.trim() ? GasBackend : LocalBackend;

const API_MODE = CONFIG.GAS_URL && CONFIG.GAS_URL.trim() ? "gas" : "local";
