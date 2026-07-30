const express = require("express");
const path = require("path");
const crypto = require("crypto");

const app = express();

const PORT = process.env.PORT || 3000;

/*
  Upload speed test için raw body.
  25 MB'a kadar kabul ediyoruz.
*/
app.use(
  express.raw({
    type: "application/octet-stream",
    limit: "25mb"
  })
);

/*
  HTML, CSS, JS ve logo gibi
  dosyaları yayınla.
*/
app.use(
  express.static(
    path.join(__dirname)
  )
);


/* =========================
   CLIENT IP
========================= */

app.get("/api/ip", (req, res) => {
  let ip =
    req.headers["x-forwarded-for"] ||
    req.socket.remoteAddress ||
    "";

  if (Array.isArray(ip)) {
    ip = ip[0];
  }

  if (typeof ip === "string") {
    ip = ip
      .split(",")[0]
      .trim()
      .replace("::ffff:", "");
  }

  res.json({
    ip: ip || "Unavailable"
  });
});


/* =========================
   PING
========================= */

app.get("/api/ping", (req, res) => {
  res.set({
    "Cache-Control":
      "no-store, no-cache, must-revalidate",
    "Content-Type":
      "application/json"
  });

  res.json({
    ok: true,
    timestamp: Date.now()
  });
});


/* =========================
   DOWNLOAD TEST
========================= */

app.get(
  "/api/download",
  (req, res) => {
    const DEFAULT_BYTES =
      12 * 1024 * 1024;

    const MAX_BYTES =
      25 * 1024 * 1024;

    let bytes =
      Number(req.query.bytes) ||
      DEFAULT_BYTES;

    bytes = Math.max(
      1024,
      Math.min(
        bytes,
        MAX_BYTES
      )
    );

    res.set({
      "Content-Type":
        "application/octet-stream",

      "Content-Length":
        String(bytes),

      "Cache-Control":
        "no-store, no-cache, must-revalidate",

      "Content-Encoding":
        "identity"
    });

    /*
      Random veri kullanıyoruz.
      Böylece sıkıştırma sonucu
      sahte yüksek hız çıkma
      ihtimali azalır.
    */

    const CHUNK_SIZE =
      64 * 1024;

    let sent = 0;

    function sendChunk() {
      while (sent < bytes) {
        const remaining =
          bytes - sent;

        const size =
          Math.min(
            CHUNK_SIZE,
            remaining
          );

        const chunk =
          crypto.randomBytes(size);

        sent += size;

        const canContinue =
          res.write(chunk);

        if (!canContinue) {
          res.once(
            "drain",
            sendChunk
          );

          return;
        }
      }

      res.end();
    }

    sendChunk();
  }
);


/* =========================
   UPLOAD TEST
========================= */

app.post(
  "/api/upload",
  (req, res) => {
    const receivedBytes =
      Buffer.isBuffer(req.body)
        ? req.body.length
        : 0;

    res.set({
      "Cache-Control":
        "no-store, no-cache, must-revalidate"
    });

    res.json({
      ok: true,
      receivedBytes
    });
  }
);


/* =========================
   HEALTH CHECK
========================= */

app.get(
  "/api/health",
  (req, res) => {
    res.json({
      status: "ok",
      service: "Speed Test"
    });
  }
);


/* =========================
   FALLBACK
========================= */

app.get("*", (req, res) => {
  res.sendFile(
    path.join(
      __dirname,
      "index.html"
    )
  );
});


/* =========================
   START SERVER
========================= */

app.listen(
  PORT,
  "0.0.0.0",
  () => {
    console.log(
      `Speed Test running on port ${PORT}`
    );
  }
);
