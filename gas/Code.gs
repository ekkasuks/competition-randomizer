/*
 * Code.gs — Backend สำหรับ "ระบบสุ่มและโหวตการแข่งขัน"
 * Google Apps Script Web App + Google Sheets
 * ------------------------------------------------------------------
 * วิธีติดตั้ง (ดูละเอียดใน README.md):
 *   1) สร้าง Google Sheets ใหม่ 1 ไฟล์ แล้วเปิด Extensions > Apps Script
 *   2) วางโค้ดนี้ทั้งหมด บันทึก
 *   3) รันฟังก์ชัน setup() หนึ่งครั้ง เพื่อสร้างชีตและตั้งรหัสแอดมิน
 *   4) Deploy > New deployment > Web app
 *        - Execute as: Me
 *        - Who has access: Anyone
 *   5) คัดลอก URL (ลงท้าย /exec) ไปวางใน js/config.js -> GAS_URL
 *
 * ตั้งรหัสแอดมิน: แก้ค่า ADMIN_KEY ในฟังก์ชัน setup() ให้ตรงกับใน config.js
 */

var SHEETS = {
  Competitions: ["id", "name", "status", "drawOrder", "createdAt"],
  Teams: ["id", "compId", "name", "imageUrl", "members", "createdAt"],
  Voters: ["id", "compId", "name", "createdAt"],
  Votes: ["id", "compId", "voterId", "scores", "updatedAt"],
};

/* ============ ติดตั้งครั้งแรก ============ */
function setup() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  Object.keys(SHEETS).forEach(function (name) {
    var sh = ss.getSheetByName(name);
    if (!sh) sh = ss.insertSheet(name);
    sh.clear();
    sh.getRange(1, 1, 1, SHEETS[name].length).setValues([SHEETS[name]]);
    sh.setFrozenRows(1);
  });
  // ลบชีตเริ่มต้นถ้าไม่ใช้
  var def = ss.getSheetByName("Sheet1") || ss.getSheetByName("ชีต1");
  if (def && ss.getSheets().length > 1) ss.deleteSheet(def);

  // ตั้งรหัสแอดมิน — แก้ค่านี้ให้ตรงกับ config.js (ADMIN_KEY)
  PropertiesService.getScriptProperties().setProperty("ADMIN_KEY", "banmai2569");
  return "ติดตั้งเรียบร้อย";
}

/* ============ ตัวช่วยเข้าถึงชีต ============ */
function sheet(name) {
  return SpreadsheetApp.getActiveSpreadsheet().getSheetByName(name);
}

function readAll(name) {
  var sh = sheet(name);
  var values = sh.getDataRange().getValues();
  var headers = values[0];
  var rows = [];
  for (var i = 1; i < values.length; i++) {
    var obj = { _row: i + 1 };
    for (var j = 0; j < headers.length; j++) obj[headers[j]] = values[i][j];
    rows.push(obj);
  }
  return rows;
}

function appendRow(name, obj) {
  var sh = sheet(name);
  var row = SHEETS[name].map(function (h) {
    return obj[h] != null ? obj[h] : "";
  });
  sh.appendRow(row);
}

function updateRow(name, rowIndex, obj) {
  var sh = sheet(name);
  var row = SHEETS[name].map(function (h) {
    return obj[h] != null ? obj[h] : "";
  });
  sh.getRange(rowIndex, 1, 1, row.length).setValues([row]);
}

function deleteRows(name, rowIndexes) {
  var sh = sheet(name);
  rowIndexes
    .sort(function (a, b) {
      return b - a;
    })
    .forEach(function (r) {
      sh.deleteRow(r);
    });
}

function uid(prefix) {
  return (
    prefix + "_" + Date.now().toString(36) + Math.random().toString(36).slice(2, 7)
  );
}

function json(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(
    ContentService.MimeType.JSON
  );
}

function ok(data) {
  return json({ ok: true, data: data == null ? { ok: true } : data });
}
function fail(msg) {
  return json({ ok: false, error: msg });
}

function checkAdmin(key) {
  var real = PropertiesService.getScriptProperties().getProperty("ADMIN_KEY");
  if (!real) return true; // ยังไม่ตั้ง = ไม่ตรวจ
  return key === real;
}

/* ============ ROUTER ============ */
function doGet(e) {
  try {
    var a = e.parameter.action;
    if (a === "listCompetitions") return ok(listCompetitions());
    if (a === "getCompetition") return ok(getCompetition(e.parameter.id));
    if (a === "getVoters") return ok(getVoters(e.parameter.compId));
    if (a === "getResults") return ok(getResults(e.parameter.compId));
    return fail("ไม่รู้จัก action: " + a);
  } catch (err) {
    return fail(String(err));
  }
}

function doPost(e) {
  try {
    var body = JSON.parse(e.postData.contents);
    var a = body.action;

    // action ที่ต้องเป็นแอดมิน
    var adminActions = [
      "saveCompetition",
      "deleteCompetition",
      "saveTeam",
      "deleteTeam",
      "saveDrawOrder",
      "setStatus",
      "saveVoters",
    ];
    if (adminActions.indexOf(a) >= 0 && !checkAdmin(body.adminKey)) {
      return fail("รหัสแอดมินไม่ถูกต้อง");
    }

    if (a === "saveCompetition") return ok(saveCompetition(body));
    if (a === "deleteCompetition") return ok(deleteCompetition(body.id));
    if (a === "saveTeam") return ok(saveTeam(body.compId, body.team));
    if (a === "deleteTeam") return ok(deleteTeam(body.compId, body.teamId));
    if (a === "saveDrawOrder")
      return ok(saveDrawOrder(body.compId, body.orderIds));
    if (a === "setStatus") return ok(setStatus(body.compId, body.status));
    if (a === "saveVoters") return ok(saveVoters(body.compId, body.names));
    if (a === "submitVote")
      return ok(submitVote(body.compId, body.voterId, body.scores));
    return fail("ไม่รู้จัก action: " + a);
  } catch (err) {
    return fail(String(err));
  }
}

/* ============ Competition ============ */
function listCompetitions() {
  return readAll("Competitions")
    .map(function (c) {
      return { id: c.id, name: c.name, status: c.status || "setup" };
    })
    .sort(function (a, b) {
      return a.name > b.name ? 1 : -1;
    });
}

function getCompetition(id) {
  var comp = readAll("Competitions").filter(function (c) {
    return c.id === id;
  })[0];
  if (!comp) throw "ไม่พบรายการแข่งขันนี้";
  var teams = readAll("Teams")
    .filter(function (t) {
      return t.compId === id;
    })
    .map(function (t) {
      return {
        id: t.id,
        name: t.name,
        imageUrl: t.imageUrl || "",
        members: parseJson(t.members, []),
      };
    });
  return {
    id: comp.id,
    name: comp.name,
    status: comp.status || "setup",
    drawOrder: parseJson(comp.drawOrder, []),
    teams: teams,
  };
}

function saveCompetition(body) {
  var rows = readAll("Competitions");
  if (body.id) {
    var r = rows.filter(function (c) {
      return c.id === body.id;
    })[0];
    if (r) {
      r.name = body.name;
      updateRow("Competitions", r._row, r);
      return { id: body.id };
    }
  }
  var id = uid("comp");
  appendRow("Competitions", {
    id: id,
    name: body.name,
    status: "setup",
    drawOrder: "[]",
    createdAt: new Date().toISOString(),
  });
  return { id: id };
}

function deleteCompetition(id) {
  del("Competitions", function (c) {
    return c.id === id;
  });
  del("Teams", function (t) {
    return t.compId === id;
  });
  del("Voters", function (v) {
    return v.compId === id;
  });
  del("Votes", function (v) {
    return v.compId === id;
  });
  return { ok: true };
}

/* ============ Team ============ */
function saveTeam(compId, team) {
  var membersJson = JSON.stringify(team.members || []);
  if (team.id) {
    var rows = readAll("Teams");
    var r = rows.filter(function (t) {
      return t.id === team.id;
    })[0];
    if (r) {
      r.name = team.name;
      r.imageUrl = team.imageUrl || "";
      r.members = membersJson;
      updateRow("Teams", r._row, r);
      return { id: team.id };
    }
  }
  var id = uid("team");
  appendRow("Teams", {
    id: id,
    compId: compId,
    name: team.name,
    imageUrl: team.imageUrl || "",
    members: membersJson,
    createdAt: new Date().toISOString(),
  });
  return { id: id };
}

function deleteTeam(compId, teamId) {
  del("Teams", function (t) {
    return t.id === teamId;
  });
  // เอาออกจาก drawOrder
  var comp = readAll("Competitions").filter(function (c) {
    return c.id === compId;
  })[0];
  if (comp) {
    var order = parseJson(comp.drawOrder, []).filter(function (x) {
      return x !== teamId;
    });
    comp.drawOrder = JSON.stringify(order);
    updateRow("Competitions", comp._row, comp);
  }
  return { ok: true };
}

function saveDrawOrder(compId, orderIds) {
  var comp = readAll("Competitions").filter(function (c) {
    return c.id === compId;
  })[0];
  if (comp) {
    comp.drawOrder = JSON.stringify(orderIds || []);
    updateRow("Competitions", comp._row, comp);
  }
  return { ok: true };
}

function setStatus(compId, status) {
  var comp = readAll("Competitions").filter(function (c) {
    return c.id === compId;
  })[0];
  if (comp) {
    comp.status = status;
    updateRow("Competitions", comp._row, comp);
  }
  return { ok: true };
}

/* ============ Voters ============ */
function saveVoters(compId, names) {
  names = (names || [])
    .map(function (n) {
      return String(n).trim();
    })
    .filter(function (n) {
      return n;
    });
  var existing = readAll("Voters").filter(function (v) {
    return v.compId === compId;
  });
  var existingNames = existing.map(function (v) {
    return v.name;
  });

  // ลบผู้โหวตที่ชื่อหายไป + โหวตของเขา
  var toDelete = existing.filter(function (v) {
    return names.indexOf(v.name) < 0;
  });
  var deleteIds = toDelete.map(function (v) {
    return v.id;
  });
  del("Voters", function (v) {
    return v.compId === compId && names.indexOf(v.name) < 0;
  });
  del("Votes", function (vt) {
    return vt.compId === compId && deleteIds.indexOf(vt.voterId) >= 0;
  });

  // เพิ่มชื่อใหม่
  names.forEach(function (name) {
    if (existingNames.indexOf(name) < 0) {
      appendRow("Voters", {
        id: uid("voter"),
        compId: compId,
        name: name,
        createdAt: new Date().toISOString(),
      });
    }
  });
  return { ok: true };
}

function getVoters(compId) {
  var voters = readAll("Voters").filter(function (v) {
    return v.compId === compId;
  });
  var votedSet = {};
  readAll("Votes")
    .filter(function (vt) {
      return vt.compId === compId;
    })
    .forEach(function (vt) {
      votedSet[vt.voterId] = true;
    });
  return voters
    .map(function (v) {
      return { id: v.id, name: v.name, voted: !!votedSet[v.id] };
    })
    .sort(function (a, b) {
      return a.name > b.name ? 1 : -1;
    });
}

/* ============ Vote ============ */
function submitVote(compId, voterId, scores) {
  var comp = readAll("Competitions").filter(function (c) {
    return c.id === compId;
  })[0];
  if (!comp) throw "ไม่พบรายการแข่งขัน";
  if (comp.status !== "open") throw "รายการนี้ยังไม่เปิด/ปิดโหวตแล้ว";

  // ลบโหวตเดิม
  del("Votes", function (vt) {
    return vt.compId === compId && vt.voterId === voterId;
  });
  appendRow("Votes", {
    id: uid("vote"),
    compId: compId,
    voterId: voterId,
    scores: JSON.stringify(scores || {}),
    updatedAt: new Date().toISOString(),
  });
  return { ok: true };
}

/* ============ Results ============ */
function getResults(compId) {
  var comp = readAll("Competitions").filter(function (c) {
    return c.id === compId;
  })[0];
  if (!comp) throw "ไม่พบรายการแข่งขัน";
  var teams = readAll("Teams").filter(function (t) {
    return t.compId === compId;
  });
  var voters = readAll("Voters").filter(function (v) {
    return v.compId === compId;
  });
  var votes = readAll("Votes").filter(function (v) {
    return v.compId === compId;
  });

  var agg = {};
  teams.forEach(function (t) {
    agg[t.id] = { total: 0, count: 0 };
  });
  votes.forEach(function (v) {
    var s = parseJson(v.scores, {});
    Object.keys(s).forEach(function (tid) {
      var val = Number(s[tid]);
      if (agg[tid] && val > 0) {
        agg[tid].total += val;
        agg[tid].count += 1;
      }
    });
  });

  var ranked = teams
    .map(function (t) {
      var a = agg[t.id];
      var avg = a.count ? a.total / a.count : 0;
      return {
        id: t.id,
        name: t.name,
        imageUrl: t.imageUrl || "",
        members: parseJson(t.members, []),
        total: a.total,
        count: a.count,
        avg: Math.round(avg * 100) / 100,
      };
    })
    .sort(function (a, b) {
      return b.avg - a.avg || b.count - a.count || b.total - a.total;
    });
  ranked.forEach(function (t, i) {
    t.rank = i + 1;
  });

  var votedSet = {};
  votes.forEach(function (v) {
    votedSet[v.voterId] = true;
  });

  return {
    teams: ranked,
    voterCount: voters.length,
    votedCount: Object.keys(votedSet).length,
    status: comp.status || "setup",
  };
}

/* ============ ตัวช่วย ============ */
function del(name, predicate) {
  var rows = readAll(name).filter(predicate);
  if (rows.length) {
    deleteRows(
      name,
      rows.map(function (r) {
        return r._row;
      })
    );
  }
}

function parseJson(str, fallback) {
  try {
    var v = JSON.parse(str);
    return v == null ? fallback : v;
  } catch (e) {
    return fallback;
  }
}
