import fs from "node:fs";
import path from "node:path";
import bcrypt from "bcryptjs";

const dataDir = path.resolve("data");
const dbPath = path.join(dataDir, "db.json");
const empty = { users: [], rides: [], requests: [], messages: [], ratings: [], reports: [], blocks: [] };


function importBundledRoster(db) {
  const rosterPath = path.join(dataDir, "students-roster.csv");
  if (!fs.existsSync(rosterPath)) return;
  const lines = fs.readFileSync(rosterPath, "utf8").replace(/^\uFEFF/, "").split(/\r?\n/).filter(Boolean);
  if (lines.length < 2) return;
  const parse = line => line.split(",").map(v => v.trim());
  const headers = parse(lines.shift()).map(v => v.toLowerCase());
  const idx = key => headers.indexOf(key);
  for (const line of lines) {
    const c = parse(line);
    const prn = c[idx("prn")], name = c[idx("name")], surname = c[idx("surname")];
    const branch = c[idx("branch")], semester = c[idx("semester")];
    if (!prn || !name || !surname || !branch || !semester) continue;
    if (db.users.some(u => String(u.studentId || "").toUpperCase() === prn.toUpperCase())) continue;
    db.users.push({
      id: `u_${prn}`, studentId: prn, name, email: "", surname,
      passwordHash: bcrypt.hashSync(surname.toUpperCase(), 10),
      branch, semester, year: semester, verified: true, role: "student",
      mustChangePassword: true, createdAt: new Date().toISOString()
    });
  }
}

export function loadDb() {
  fs.mkdirSync(dataDir, { recursive: true });
  if (!fs.existsSync(dbPath)) {
    const db = structuredClone(empty);
    const hash = (p) => bcrypt.hashSync(p, 10);
    db.users = [
      { id:"u_admin", studentId:"ADMIN0001", name:"SafeCommute Admin", email:"admin@bvp.edu.in", passwordHash:hash("Admin123!"), branch:"Administration", semester:"Staff", year:"Staff", verified:true, role:"admin", mustChangePassword:false, createdAt:new Date().toISOString() },
      { id:"u_student", studentId:"2314110686", name:"Ishwam Kshatriya", email:"", passwordHash:hash("KSHATRIYA"), surname:"KSHATRIYA", branch:"Electrical & Computer Engineering", semester:"VII", year:"Final Year", verified:true, role:"student", mustChangePassword:true, createdAt:new Date().toISOString() },
      { id:"u_driver", studentId:"2314110653", name:"Prajyot Godbole", email:"", passwordHash:hash("GODBOLE"), surname:"GODBOLE", branch:"Electrical & Computer Engineering", semester:"VII", year:"Final Year", verified:true, role:"student", mustChangePassword:true, createdAt:new Date().toISOString() }
    ];
    db.rides = [
      { id:"ride_demo", type:"driver", userId:"u_driver", source:"BVP Dhankawadi", destination:"Satara", date:new Date(Date.now()+86400000).toISOString().slice(0,10), time:"09:00", seats:3, seatsAvailable:3, notes:"Leaving from main gate. Bags okay.", status:"open", createdAt:new Date().toISOString() }
    ];
    importBundledRoster(db);
    fs.writeFileSync(dbPath, JSON.stringify(db, null, 2));
  } else {
    // One-time backward-compatible migration for earlier prototype data.
    const db = JSON.parse(fs.readFileSync(dbPath, "utf8"));
    let changed = false;
    for (const u of db.users || []) {
      if (!u.studentId) { u.studentId = u.role === "admin" ? "ADMIN0001" : String(u.id || "").replace(/^u_/, "").toUpperCase(); changed = true; }
      if (!u.semester) { u.semester = u.year || "Unknown"; changed = true; }
      if (u.mustChangePassword === undefined) { u.mustChangePassword = false; changed = true; }
    }
    const before = db.users.length;
    importBundledRoster(db);
    if (changed || db.users.length !== before) fs.writeFileSync(dbPath, JSON.stringify(db, null, 2));
  }
  return JSON.parse(fs.readFileSync(dbPath, "utf8"));
}
export function saveDb(db) {
  fs.mkdirSync(dataDir, {recursive:true});
  fs.writeFileSync(dbPath, JSON.stringify(db, null, 2));
}
