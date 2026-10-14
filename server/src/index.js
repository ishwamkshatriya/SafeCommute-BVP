import "dotenv/config";
import express from "express";
import cors from "cors";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { createServer } from "node:http";
import { Server } from "socket.io";
import { randomUUID } from "node:crypto";
import { loadDb, saveDb } from "./store.js";

const app = express();
const server = createServer(app);

const allowedOrigins = (
  process.env.CLIENT_ORIGIN || "http://localhost:5173"
)
  .split(",")
  .map(value => value.trim())
  .filter(Boolean);

const corsOrigin = (requestOrigin, callback) => {
  if (
    !requestOrigin ||
    allowedOrigins.includes("*") ||
    allowedOrigins.includes(requestOrigin)
  ) {
    return callback(null, true);
  }

  return callback(
    new Error("Origin is not allowed by SafeCommute CORS policy")
  );
};

const io = new Server(server, {
  cors: {
    origin: corsOrigin,
    methods: ["GET", "POST"]
  }
});

app.use(cors({ origin: corsOrigin }));
app.use(express.json({ limit: "1mb" }));

const PORT = Number(process.env.PORT || 5000);
const SECRET = process.env.JWT_SECRET || "development-only-change-me";

let db = loadDb();

const id = () => randomUUID();

const publicUser = u => ({
  id: u.id,
  studentId: u.studentId,
  name: u.name,
  email: u.email || "",
  branch: u.branch,
  semester: u.semester || u.year,
  year: u.year,
  verified: u.verified,
  role: u.role,
  mustChangePassword: Boolean(u.mustChangePassword),
  createdAt: u.createdAt
});

function auth(req, res, next) {
  const token = (req.headers.authorization || "").replace(
    /^Bearer\s+/i,
    ""
  );

  if (!token) {
    return res.status(401).json({
      error: "Sign in required"
    });
  }

  try {
    req.user = jwt.verify(token, SECRET);
    next();
  } catch {
    return res.status(401).json({
      error: "Session expired. Sign in again."
    });
  }
}

const me = req => db.users.find(u => u.id === req.user.id);

function verified(req, res, next) {
  const u = me(req);

  if (!u || !u.verified) {
    return res.status(403).json({
      error: "Your student account is awaiting admin verification."
    });
  }

  next();
}

function admin(req, res, next) {
  if (me(req)?.role !== "admin") {
    return res.status(403).json({
      error: "Admin access required"
    });
  }

  next();
}

function persist() {
  saveDb(db);
}

function visibleRide(ride) {
  const owner = db.users.find(u => u.id === ride.userId);

  return {
    ...ride,
    owner: owner ? publicUser(owner) : null
  };
}

function blocked(a, b) {
  return db.blocks.some(
    x =>
      (x.by === a && x.target === b) ||
      (x.by === b && x.target === a)
  );
}

// --------------------------------------------------
// HEALTH CHECK
// --------------------------------------------------

app.get("/api/health", (_, res) => {
  res.json({
    ok: true,
    service: "SafeCommute BVP API"
  });
});

// --------------------------------------------------
// AUTHENTICATION
// --------------------------------------------------

app.post("/api/auth/register", (_req, res) => {
  res.status(403).json({
    error:
      "Self-registration is disabled. Ask your college project administrator to add your PRN to the roster."
  });
});

app.post("/api/auth/login", async (req, res) => {
  const { prn, password, email } = req.body || {};

  const loginId = String(prn || email || "")
    .trim()
    .toUpperCase();

  const u = db.users.find(
    x => String(x.studentId || "").toUpperCase() === loginId
  );

  if (
    !u ||
    !(await bcrypt.compare(String(password || ""), u.passwordHash))
  ) {
    return res.status(401).json({
      error: "Invalid PRN or password"
    });
  }

  const token = jwt.sign(
    { id: u.id },
    SECRET,
    { expiresIn: "7d" }
  );

  res.json({
    token,
    user: publicUser(u),
    mustChangePassword: Boolean(u.mustChangePassword)
  });
});

app.get("/api/auth/me", auth, (req, res) => {
  res.json({
    user: publicUser(me(req))
  });
});

app.post("/api/auth/change-password", auth, async (req, res) => {
  const { currentPassword, newPassword } = req.body || {};
  const u = me(req);

  if (
    !u ||
    !(await bcrypt.compare(
      String(currentPassword || ""),
      u.passwordHash
    ))
  ) {
    return res.status(400).json({
      error: "Current password is incorrect"
    });
  }

  if (
    typeof newPassword !== "string" ||
    newPassword.length < 8
  ) {
    return res.status(400).json({
      error: "New password must be at least 8 characters"
    });
  }

  if (newPassword === currentPassword) {
    return res.status(400).json({
      error: "Choose a password different from the current password"
    });
  }

  u.passwordHash = await bcrypt.hash(newPassword, 10);
  u.mustChangePassword = false;

  persist();

  res.json({
    message: "Password changed successfully",
    user: publicUser(u)
  });
});

// --------------------------------------------------
// CSV ROSTER IMPORT
// Required columns: PRN, Name, Surname, Branch, Semester
// --------------------------------------------------

app.post(
  "/api/admin/import-roster",
  auth,
  admin,
  async (req, res) => {
    const csv = String(req.body?.csv ?? "");

    if (!csv.trim()) {
      return res.status(400).json({
        error: "Paste CSV content first"
      });
    }

    // Remove a UTF-8 BOM and support both actual line breaks
    // and escaped line breaks pasted into the import field.
    const normalizedCsv = csv
      .replace(/^\uFEFF/, "")
      .replace(/\\r\\n/g, "\n")
      .replace(/\\n/g, "\n")
      .replace(/\\r/g, "\n");

    const lines = normalizedCsv
      .split(/\r?\n/)
      .filter(line => line.trim());

    if (lines.length < 2) {
      return res.status(400).json({
        error: "CSV must contain a header row and at least one student row"
      });
    }

    // Parse CSV rows while respecting quoted commas.
    const parseLine = line => {
      const out = [];
      let value = "";
      let quoted = false;

      for (let i = 0; i < line.length; i++) {
        const c = line[i];

        if (
          c === '"' &&
          line[i + 1] === '"' &&
          quoted
        ) {
          value += '"';
          i++;
        } else if (c === '"') {
          quoted = !quoted;
        } else if (c === "," && !quoted) {
          out.push(value.trim());
          value = "";
        } else {
          value += c;
        }
      }

      out.push(value.trim());

      return out;
    };

    const headerLine = lines.shift() || "";

    const headers = parseLine(headerLine)
      .map(value =>
        value
          .replace(/^\uFEFF/, "")
          .trim()
          .toLowerCase()
          .replace(/[ _-]/g, "")
      );

    const find = (...names) =>
      headers.findIndex(header => names.includes(header));

    const pi = find(
      "prn",
      "studentid",
      "rollno",
      "loginid"
    );

    const ni = find(
      "name",
      "fullname",
      "studentname"
    );

    const si = find(
      "surname",
      "lastname",
      "familyname"
    );

    const bi = find(
      "branch",
      "department"
    );

    const mi = find(
      "semester",
      "sem"
    );

    // Include the headers received in the error so that
    // unexpected formatting can be diagnosed.
    if ([pi, ni, si, bi, mi].some(index => index < 0)) {
      return res.status(400).json({
        error: "CSV needs columns: PRN, Name, Surname, Branch, Semester",
        receivedHeaders: headers
      });
    }

    let added = 0;
    let updated = 0;
    let skipped = 0;

    for (const line of lines) {
      const cols = parseLine(line);

      const prn = (cols[pi] || "").trim();
      const name = (cols[ni] || "").trim();
      const surname = (cols[si] || "").trim().toUpperCase();
      const branch = (cols[bi] || "").trim();
      const semester = (cols[mi] || "").trim();

      if (!prn || !name || !surname || !branch || !semester) {
        skipped++;
        continue;
      }

      let u = db.users.find(
        x =>
          String(x.studentId || "").toUpperCase() ===
          prn.toUpperCase()
      );

      if (u) {
        // Update student information without resetting an
        // existing student's password.
        u.name = name;
        u.surname = surname;
        u.branch = branch;
        u.semester = semester;
        u.year = semester;

        updated++;
      } else {
        // New students initially use their uppercase surname
        // as their password and must change it after logging in.
        u = {
          id: id(),
          studentId: prn,
          name,
          email: "",
          surname,
          branch,
          semester,
          year: semester,
          passwordHash: await bcrypt.hash(surname, 10),
          verified: true,
          role: "student",
          mustChangePassword: true,
          createdAt: new Date().toISOString()
        };

        db.users.push(u);
        added++;
      }
    }

    persist();

    res.json({
      message: "Roster import completed",
      added,
      updated,
      skipped,
      total: db.users.filter(u => u.role !== "admin").length
    });
  }
);

// --------------------------------------------------
// RIDES
// --------------------------------------------------

app.get("/api/rides", auth, verified, (req, res) => {
  const {
    destination = "",
    date = "",
    type = "all"
  } = req.query;

  const list = db.rides
    .filter(
      r =>
        r.status === "open" &&
        r.userId !== req.user.id &&
        !blocked(req.user.id, r.userId) &&
        (
          !destination ||
          r.destination
            .toLowerCase()
            .includes(String(destination).toLowerCase())
        ) &&
        (!date || r.date === date) &&
        (type === "all" || r.type === type)
    )
    .sort((a, b) =>
      (a.date + a.time).localeCompare(b.date + b.time)
    )
    .map(visibleRide);

  res.json({ rides: list });
});

app.post("/api/rides", auth, verified, (req, res) => {
  const {
    type,
    source,
    destination,
    date,
    time,
    seats,
    notes = "",
    genderPreference = "any"
  } = req.body || {};

  if (
    !["driver", "rider"].includes(type) ||
    !source?.trim() ||
    !destination?.trim() ||
    !date ||
    !time
  ) {
    return res.status(400).json({
      error: "Type, source, destination, date and time are required"
    });
  }

  if (
    new Date(`${date}T${time}:00`) <
    new Date(Date.now() - 60000)
  ) {
    return res.status(400).json({
      error: "Choose a future departure"
    });
  }

  const ride = {
    id: id(),
    type,
    userId: req.user.id,
    source: source.trim(),
    destination: destination.trim(),
    date,
    time,
    seats:
      type === "driver"
        ? Math.max(1, Math.min(7, Number(seats) || 1))
        : 1,
    seatsAvailable:
      type === "driver"
        ? Math.max(1, Math.min(7, Number(seats) || 1))
        : 1,
    notes: String(notes).slice(0, 500),
    genderPreference: ["any", "women"].includes(genderPreference)
      ? genderPreference
      : "any",
    status: "open",
    createdAt: new Date().toISOString()
  };

  db.rides.unshift(ride);
  persist();

  res.status(201).json({
    ride: visibleRide(ride)
  });
});

app.get("/api/rides/matches", auth, verified, (req, res) => {
  const {
    destination = "",
    date = "",
    time = "12:00",
    windowHours = "4"
  } = req.query;

  const target = String(destination).trim().toLowerCase();

  const [hh, mm] = String(time).split(":").map(Number);
  const mins = hh * 60 + (mm || 0);

  const win =
    Math.max(0, Math.min(12, Number(windowHours) || 4)) * 60;

  const matches = db.rides
    .filter(
      r =>
        r.status === "open" &&
        r.userId !== req.user.id &&
        !blocked(req.user.id, r.userId) &&
        (
          !target ||
          r.destination.toLowerCase().includes(target) ||
          target.includes(r.destination.toLowerCase())
        ) &&
        (!date || r.date === date) &&
        Math.abs(
          Number(r.time.split(":")[0]) * 60 +
          Number(r.time.split(":")[1]) -
          mins
        ) <= win &&
        (r.type === "driver" ? r.seatsAvailable > 0 : true)
    )
    .map(visibleRide);

  res.json({
    matches,
    criteria: {
      destination,
      date,
      time,
      windowHours: win / 60
    }
  });
});

app.post(
  "/api/rides/:rideId/request",
  auth,
  verified,
  (req, res) => {
    const ride = db.rides.find(
      r => r.id === req.params.rideId
    );

    if (!ride || ride.status !== "open") {
      return res.status(404).json({
        error: "Ride not available"
      });
    }

    if (ride.userId === req.user.id) {
      return res.status(400).json({
        error: "You cannot request your own ride"
      });
    }

    if (blocked(req.user.id, ride.userId)) {
      return res.status(403).json({
        error: "This match is unavailable"
      });
    }

    if (ride.type !== "driver") {
      return res.status(400).json({
        error: "You can request seats on driver rides only"
      });
    }

    if (ride.seatsAvailable < 1) {
      return res.status(409).json({
        error: "No seats left"
      });
    }

    if (
      db.requests.some(
        r =>
          r.rideId === ride.id &&
          r.riderId === req.user.id &&
          r.status !== "rejected"
      )
    ) {
      return res.status(409).json({
        error: "You already requested this ride"
      });
    }

    const request = {
      id: id(),
      rideId: ride.id,
      riderId: req.user.id,
      driverId: ride.userId,
      status: "pending",
      createdAt: new Date().toISOString()
    };

    db.requests.push(request);
    persist();

    res.status(201).json({ request });
  }
);

app.get("/api/requests", auth, verified, (req, res) => {
  const list = db.requests
    .filter(
      r =>
        r.riderId === req.user.id ||
        r.driverId === req.user.id
    )
    .map(r => ({
      ...r,
      ride: visibleRide(
        db.rides.find(x => x.id === r.rideId) || {}
      ),
      rider: publicUser(
        db.users.find(x => x.id === r.riderId) || {}
      ),
      driver: publicUser(
        db.users.find(x => x.id === r.driverId) || {}
      )
    }));

  res.json({ requests: list });
});

app.patch(
  "/api/requests/:requestId",
  auth,
  verified,
  (req, res) => {
    const request = db.requests.find(
      r => r.id === req.params.requestId
    );

    if (!request) {
      return res.status(404).json({
        error: "Request not found"
      });
    }

    if (request.driverId !== req.user.id) {
      return res.status(403).json({
        error: "Only the driver can respond"
      });
    }

    const { status } = req.body || {};

    if (!["accepted", "rejected"].includes(status)) {
      return res.status(400).json({
        error: "Invalid status"
      });
    }

    const ride = db.rides.find(
      r => r.id === request.rideId
    );

    if (status === "accepted" && ride.seatsAvailable < 1) {
      return res.status(409).json({
        error: "No seats remaining"
      });
    }

    if (request.status !== "pending") {
      return res.status(409).json({
        error: "Request already handled"
      });
    }

    request.status = status;

    if (status === "accepted") {
      ride.seatsAvailable--;

      if (ride.seatsAvailable === 0) {
        ride.status = "full";
      }
    }

    persist();

    io.to(`ride:${ride.id}`).emit("request:update", request);

    res.json({ request });
  }
);

app.get("/api/rides/mine", auth, (req, res) => {
  res.json({
    rides: db.rides
      .filter(r => r.userId === req.user.id)
      .map(visibleRide)
  });
});

app.patch(
  "/api/rides/:rideId/status",
  auth,
  verified,
  (req, res) => {
    const ride = db.rides.find(
      r => r.id === req.params.rideId
    );

    if (!ride) {
      return res.status(404).json({
        error: "Ride not found"
      });
    }

    if (
      ride.userId !== req.user.id &&
      me(req).role !== "admin"
    ) {
      return res.status(403).json({
        error: "Not your ride"
      });
    }

    if (
      !["open", "completed", "cancelled"].includes(
        req.body.status
      )
    ) {
      return res.status(400).json({
        error: "Invalid status"
      });
    }

    ride.status = req.body.status;
    persist();

    res.json({ ride });
  }
);

// --------------------------------------------------
// CHAT
// --------------------------------------------------

app.get(
  "/api/chat/:rideId",
  auth,
  verified,
  (req, res) => {
    const ride = db.rides.find(
      r => r.id === req.params.rideId
    );

    const accepted = db.requests.some(
      r =>
        r.rideId === req.params.rideId &&
        r.status === "accepted" &&
        (
          r.riderId === req.user.id ||
          r.driverId === req.user.id
        )
    );

    if (
      !ride ||
      (ride.userId !== req.user.id && !accepted)
    ) {
      return res.status(403).json({
        error:
          "Chat is available to the driver and accepted riders only"
      });
    }

    res.json({
      messages: db.messages
        .filter(m => m.rideId === ride.id)
        .map(m => ({
          ...m,
          sender: publicUser(
            db.users.find(u => u.id === m.senderId) || {}
          )
        }))
    });
  }
);

app.post(
  "/api/chat/:rideId",
  auth,
  verified,
  (req, res) => {
    const ride = db.rides.find(
      r => r.id === req.params.rideId
    );

    const accepted = db.requests.some(
      r =>
        r.rideId === req.params.rideId &&
        r.status === "accepted" &&
        (
          r.riderId === req.user.id ||
          r.driverId === req.user.id
        )
    );

    if (
      !ride ||
      (ride.userId !== req.user.id && !accepted)
    ) {
      return res.status(403).json({
        error:
          "Chat is available to the driver and accepted riders only"
      });
    }

    const messageText = String(req.body.text || "").trim();

    if (!messageText || messageText.length > 1000) {
      return res.status(400).json({
        error: "Message must be 1–1000 characters"
      });
    }

    const message = {
      id: id(),
      rideId: ride.id,
      senderId: req.user.id,
      text: messageText,
      createdAt: new Date().toISOString()
    };

    db.messages.push(message);
    persist();

    const out = {
      ...message,
      sender: publicUser(me(req))
    };

    io.to(`ride:${ride.id}`).emit("chat:message", out);

    res.status(201).json({
      message: out
    });
  }
);

// --------------------------------------------------
// RATINGS
// --------------------------------------------------

app.post("/api/ratings", auth, verified, (req, res) => {
  const {
    rideId,
    targetId,
    score,
    comment = ""
  } = req.body || {};

  const ride = db.rides.find(r => r.id === rideId);

  if (!ride || ride.status !== "completed") {
    return res.status(400).json({
      error: "Ratings are enabled after a ride is completed"
    });
  }

  const participants = [
    ride.userId,
    ...db.requests
      .filter(
        r => r.rideId === rideId && r.status === "accepted"
      )
      .map(r => r.riderId)
  ];

  if (!participants.includes(req.user.id)) {
    return res.status(403).json({
      error: "You were not part of this ride"
    });
  }

  if (
    !Number.isInteger(Number(score)) ||
    Number(score) < 1 ||
    Number(score) > 5
  ) {
    return res.status(400).json({
      error: "Score must be 1–5"
    });
  }

  if (
    db.ratings.some(
      r =>
        r.rideId === rideId &&
        r.fromId === req.user.id &&
        r.targetId === targetId
    )
  ) {
    return res.status(409).json({
      error: "Already rated this user"
    });
  }

  db.ratings.push({
    id: id(),
    rideId,
    fromId: req.user.id,
    targetId,
    score: Number(score),
    comment: String(comment).slice(0, 300),
    createdAt: new Date().toISOString()
  });

  persist();

  res.status(201).json({
    message: "Rating saved"
  });
});

// --------------------------------------------------
// REPORTING AND BLOCKING
// --------------------------------------------------

app.post("/api/report", auth, verified, (req, res) => {
  const {
    targetId,
    reason,
    details = ""
  } = req.body || {};

  if (
    !db.users.some(u => u.id === targetId) ||
    targetId === req.user.id ||
    !reason
  ) {
    return res.status(400).json({
      error: "Choose a valid user and reason"
    });
  }

  db.reports.push({
    id: id(),
    by: req.user.id,
    targetId,
    reason: String(reason).slice(0, 100),
    details: String(details).slice(0, 500),
    status: "open",
    createdAt: new Date().toISOString()
  });

  persist();

  res.status(201).json({
    message: "Report submitted to admins"
  });
});

app.post("/api/block", auth, verified, (req, res) => {
  const { targetId } = req.body || {};

  if (
    !db.users.some(u => u.id === targetId) ||
    targetId === req.user.id
  ) {
    return res.status(400).json({
      error: "Invalid user"
    });
  }

  if (
    !db.blocks.some(
      b =>
        b.by === req.user.id &&
        b.target === targetId
    )
  ) {
    db.blocks.push({
      by: req.user.id,
      target: targetId,
      createdAt: new Date().toISOString()
    });
  }

  persist();

  res.json({
    message: "User blocked"
  });
});

// --------------------------------------------------
// ADMIN
// --------------------------------------------------

app.get("/api/admin/overview", auth, admin, (_, res) => {
  res.json({
    users: db.users.map(publicUser),
    rides: db.rides.map(visibleRide),
    requests: db.requests,
    reports: db.reports
  });
});

app.patch(
  "/api/admin/users/:userId/verify",
  auth,
  admin,
  (req, res) => {
    const u = db.users.find(
      x => x.id === req.params.userId
    );

    if (!u) {
      return res.status(404).json({
        error: "User not found"
      });
    }

    u.verified = Boolean(req.body.verified);
    persist();

    res.json({
      user: publicUser(u)
    });
  }
);

app.patch(
  "/api/admin/reports/:reportId",
  auth,
  admin,
  (req, res) => {
    const report = db.reports.find(
      x => x.id === req.params.reportId
    );

    if (!report) {
      return res.status(404).json({
        error: "Report not found"
      });
    }

    report.status =
      req.body.status === "resolved"
        ? "resolved"
        : "open";

    persist();

    res.json({ report });
  }
);

// --------------------------------------------------
// OPTIONAL BLABLACAR PARTNER INTEGRATION
// --------------------------------------------------

app.get(
  "/api/external/blablacar",
  auth,
  verified,
  async (req, res) => {
    const {
      origin = "",
      destination = "",
      date = ""
    } = req.query;

    const base = process.env.BLABLACAR_DAILY_BASE_URL;
    const key = process.env.BLABLACAR_DAILY_API_KEY;

    if (base && key) {
      try {
        const url = new URL(
          "/2/third_party/public/search",
          base
        );

        if (origin) {
          url.searchParams.set("from_city", origin);
        }

        if (destination) {
          url.searchParams.set("to_city", destination);
        }

        if (date) {
          url.searchParams.set("from_date", date);
        }

        const response = await fetch(url, {
          headers: {
            Authorization: `Bearer ${key}`,
            Accept: "application/json"
          }
        });

        if (!response.ok) {
          throw new Error(
            `Partner API returned ${response.status}`
          );
        }

        return res.json({
          source: "BlaBlaCar Daily API",
          live: true,
          data: await response.json()
        });
      } catch (e) {
        return res.status(502).json({
          error: "Partner API unavailable",
          details: e.message,
          live: false
        });
      }
    }

    const q = new URLSearchParams();

    if (origin) q.set("from", origin);
    if (destination) q.set("to", destination);
    if (date) q.set("date", date);

    res.json({
      source: "BlaBlaCar",
      live: false,
      message:
        "Live ride inventory requires authorized API access. Use the search link below.",
      searchUrl:
        `https://www.blablacar.in/search?${q.toString()}`
    });
  }
);

// --------------------------------------------------
// SERVER AND SOCKET.IO
// --------------------------------------------------

server.listen(PORT, () => {
  console.log(
    `SafeCommute API listening on http://localhost:${PORT}`
  );
});

io.on("connection", socket => {
  socket.on("chat:join", rideId => {
    if (typeof rideId === "string") {
      socket.join(`ride:${rideId}`);
    }
  });

  socket.on("chat:leave", rideId => {
    socket.leave(`ride:${rideId}`);
  });
});
