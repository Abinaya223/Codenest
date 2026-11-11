require("dotenv").config();
const express = require("express");
const cors = require("cors");
const path = require("path");
const fs = require("fs");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const mysql = require("mysql2/promise");

const app = express();
const PORT = Number(process.env.PORT || 3000);

// ==========================================
// MIDDLEWARE
// ==========================================

app.use(cors({
  origin: process.env.FRONTEND_ORIGIN || true
}));

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Menampilkan file HTML, CSS, dan JavaScript
app.use(express.static(path.join(__dirname, "public")));

// ==========================================
// DATABASE CONNECTION
// ==========================================

const required = [
  "DB_HOST",
  "DB_USER",
  "DB_PASSWORD",
  "JWT_SECRET"
];

const missing = required.filter(
  (key) => !process.env[key]
);

let pool = null;

if (missing.length === 0) {
  try {
    let sslConfig;

    if (process.env.DB_SSL === "true") {
      const caPath = path.resolve(
        __dirname,
        process.env.DB_SSL_CA || "ca.pem"
      );

      if (!fs.existsSync(caPath)) {
        throw new Error(
          `CA Certificate tidak ditemukan: ${caPath}`
        );
      }

      sslConfig = {
        ca: fs.readFileSync(caPath, "utf8"),
        rejectUnauthorized: true
      };
    }

    pool = mysql.createPool({
      host: process.env.DB_HOST,
      port: Number(process.env.DB_PORT || 3306),
      user: process.env.DB_USER,
      password: process.env.DB_PASSWORD,
      database: process.env.DB_NAME || "codenest",

      waitForConnections: true,
      connectionLimit: 10,
      queueLimit: 0,

      ssl: sslConfig
    });

    console.log("Konfigurasi database berhasil dibuat.");
  } catch (error) {
    console.error("Database configuration error:", error.message);
  }
} else {
  console.warn(
    "Database/JWT belum siap. Isi .env:",
    missing.join(", ")
  );
}

// Fungsi query database
async function db(sql, params = []) {
  if (!pool) {
    throw new Error(
      "Database belum dikonfigurasi. Periksa .env dan CA Certificate."
    );
  }

  const [rows] = await pool.execute(sql, params);
  return rows;
}

// ==========================================
// AUTHENTICATION MIDDLEWARE
// ==========================================

function auth(req, res, next) {
  const header = req.headers.authorization || "";

  const token = header.startsWith("Bearer ")
    ? header.slice(7)
    : null;

  if (!token) {
    return res.status(401).json({
      message: "Token tidak ditemukan. Silakan login."
    });
  }

  try {
    req.user = jwt.verify(
      token,
      process.env.JWT_SECRET
    );

    next();
  } catch (error) {
    return res.status(401).json({
      message: "Token tidak valid atau sudah kedaluwarsa."
    });
  }
}

// ==========================================
// HEALTH CHECK
// ==========================================

app.get("/api/health", async (req, res) => {
  try {
    await db("SELECT 1");

    res.json({
      status: "ok",
      database: "connected"
    });
  } catch (error) {
    res.status(503).json({
      status: "error",
      database: "disconnected",
      message: error.message
    });
  }
});

// ==========================================
// AUTH REGISTER
// ==========================================

app.post("/api/auth/register", async (req, res) => {
  const { name, email, password } = req.body || {};

  if (!name || !email || !password) {
    return res.status(400).json({
      message: "Nama, email, dan password wajib diisi."
    });
  }

  if (String(password).length < 6) {
    return res.status(400).json({
      message: "Password minimal 6 karakter."
    });
  }

  try {
    const normalizedEmail = String(email).trim().toLowerCase();

    const exists = await db(
      "SELECT id FROM users WHERE email = ?",
      [normalizedEmail]
    );

    if (exists.length > 0) {
      return res.status(409).json({
        message: "Email sudah terdaftar."
      });
    }

    const hashedPassword = await bcrypt.hash(password, 12);

    const result = await db(
      "INSERT INTO users (name, email, password) VALUES (?, ?, ?)",
      [
        String(name).trim(),
        normalizedEmail,
        hashedPassword
      ]
    );

    const user = {
      id: result.insertId,
      name: String(name).trim(),
      email: normalizedEmail
    };

    const token = jwt.sign(
      user,
      process.env.JWT_SECRET,
      { expiresIn: "7d" }
    );

    res.status(201).json({
      message: "Akun berhasil dibuat.",
      token,
      user
    });

  } catch (error) {
    res.status(500).json({
      message: error.message
    });
  }
});

// ==========================================
// AUTH LOGIN
// ==========================================

app.post("/api/auth/login", async (req, res) => {
  const { email, password } = req.body || {};

  if (!email || !password) {
    return res.status(400).json({
      message: "Email dan password wajib diisi."
    });
  }

  try {
    const rows = await db(
      "SELECT id, name, email, password FROM users WHERE email = ?",
      [String(email).trim().toLowerCase()]
    );

    if (
      !rows.length ||
      !(await bcrypt.compare(password, rows[0].password))
    ) {
      return res.status(401).json({
        message: "Email atau password salah."
      });
    }

    const user = {
      id: rows[0].id,
      name: rows[0].name,
      email: rows[0].email
    };

    const token = jwt.sign(
      user,
      process.env.JWT_SECRET,
      { expiresIn: "7d" }
    );

    res.json({
      message: "Login berhasil.",
      token,
      user
    });

  } catch (error) {
    res.status(500).json({
      message: error.message
    });
  }
});

// ==========================================
// AUTH CURRENT USER
// ==========================================

app.get("/api/auth/me", auth, (req, res) => {
  res.json({
    user: req.user
  });
});

// ==========================================
// GET ALL COURSES
// ==========================================

app.get("/api/courses", async (req, res) => {
  try {
    const rows = await db(`
      SELECT
        c.id,
        c.slug,
        c.title,
        c.category,
        c.description,
        c.level,
        c.icon,
        c.color,
        COUNT(DISTINCT l.id) AS lesson_count
      FROM courses c
      LEFT JOIN lessons l ON l.course_id = c.id
      GROUP BY c.id
      ORDER BY c.sort_order
    `);

    res.json({
      data: rows
    });

  } catch (error) {
    res.status(500).json({
      message: error.message
    });
  }
});

// ==========================================
// GET COURSE DETAIL
// ==========================================

app.get("/api/courses/:slug", async (req, res) => {
  try {
    const courses = await db(
      "SELECT * FROM courses WHERE slug = ?",
      [req.params.slug]
    );

    if (!courses.length) {
      return res.status(404).json({
        message: "Course tidak ditemukan."
      });
    }

    const lessons = await db(
      `SELECT id, title, sort_order
       FROM lessons
       WHERE course_id = ?
       ORDER BY sort_order`,
      [courses[0].id]
    );

    res.json({
      course: courses[0],
      lessons
    });

  } catch (error) {
    res.status(500).json({
      message: error.message
    });
  }
});

// ==========================================
// GET LESSON DETAIL
// ==========================================

app.get("/api/lessons/:id", async (req, res) => {
  try {
    const rows = await db(
      `SELECT
        l.id,
        l.title,
        l.content,
        l.code_example,
        l.sort_order,
        c.title AS course_title,
        c.slug AS course_slug
       FROM lessons l
       JOIN courses c ON c.id = l.course_id
       WHERE l.id = ?`,
      [req.params.id]
    );

    if (!rows.length) {
      return res.status(404).json({
        message: "Lesson tidak ditemukan."
      });
    }

    const quizzes = await db(
      `SELECT id, question, options_json, explanation
       FROM quizzes
       WHERE lesson_id = ?`,
      [req.params.id]
    );

    res.json({
      lesson: rows[0],
      quizzes: quizzes.map((q) => ({
        ...q,
        options:
          typeof q.options_json === "string"
            ? JSON.parse(q.options_json)
            : q.options_json
      }))
    });

  } catch (error) {
    res.status(500).json({
      message: error.message
    });
  }
});

// ==========================================
// COMPLETE LESSON
// ==========================================

app.post("/api/lessons/:id/complete", auth, async (req, res) => {
  try {
    await db(
      `INSERT INTO user_progress (user_id, lesson_id)
       VALUES (?, ?)
       ON DUPLICATE KEY UPDATE
       completed_at = CURRENT_TIMESTAMP`,
      [
        req.user.id,
        req.params.id
      ]
    );

    res.json({
      message: "Progress berhasil disimpan."
    });

  } catch (error) {
    res.status(500).json({
      message: error.message
    });
  }
});

// ==========================================
// GET USER PROGRESS
// ==========================================

app.get("/api/progress", auth, async (req, res) => {
  try {
    const rows = await db(
      `SELECT
        l.id AS lesson_id,
        l.title,
        c.slug AS course_slug,
        c.title AS course_title,
        p.completed_at
       FROM user_progress p
       JOIN lessons l ON l.id = p.lesson_id
       JOIN courses c ON c.id = l.course_id
       WHERE p.user_id = ?
       ORDER BY p.completed_at DESC`,
      [req.user.id]
    );

    const totals = await db(
      "SELECT COUNT(*) AS total FROM lessons"
    );

    res.json({
      completed: rows,
      total_lessons: totals[0].total,
      completed_count: rows.length
    });

  } catch (error) {
    res.status(500).json({
      message: error.message
    });
  }
});

// ==========================================
// SUBMIT QUIZ ANSWER
// ==========================================

app.post("/api/quizzes/:id/answer", auth, async (req, res) => {
  const selected = Number(req.body?.selected);

  if (!Number.isInteger(selected) || selected < 0) {
    return res.status(400).json({
      message: "Pilihan jawaban tidak valid."
    });
  }

  try {
    const rows = await db(
      `SELECT correct_option, explanation
       FROM quizzes
       WHERE id = ?`,
      [req.params.id]
    );

    if (!rows.length) {
      return res.status(404).json({
        message: "Quiz tidak ditemukan."
      });
    }

    res.json({
      correct: selected === Number(rows[0].correct_option),
      explanation: rows[0].explanation
    });

  } catch (error) {
    res.status(500).json({
      message: error.message
    });
  }
});

// ==========================================
// START SERVER
// ==========================================

app.listen(PORT, async () => {
  console.log(`CodeNest berjalan di http://localhost:${PORT}`);

  if (pool) {
    try {
      const connection = await pool.getConnection();

      console.log("Database Aiven berhasil terhubung!");

      connection.release();
    } catch (error) {
      console.error("Koneksi database gagal:", error.message);
    }
  }
});