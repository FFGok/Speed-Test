const startButton = document.getElementById("startButton");
const statusText = document.getElementById("status");
const phase = document.getElementById("phase");
const liveSpeed = document.getElementById("liveSpeed");
const liveUnit = document.getElementById("liveUnit");
const gauge = document.querySelector(".gauge");

const pingValue = document.getElementById("pingValue");
const jitterValue = document.getElementById("jitterValue");
const downloadValue = document.getElementById("downloadValue");
const uploadValue = document.getElementById("uploadValue");
const ipAddress = document.getElementById("ipAddress");

const scorePanel = document.getElementById("scorePanel");
const scoreValue = document.getElementById("scoreValue");
const scoreLabel = document.getElementById("scoreLabel");
const scoreDescription = document.getElementById("scoreDescription");

function setGauge(value, max = 500, unit = "Mbps") {
  const safe = Math.max(0, Number(value) || 0);
  const progress = Math.min(safe / max, 1) * 360;

  gauge.style.setProperty(
    "--progress",
    `${progress}deg`
  );

  liveSpeed.textContent =
    safe < 10
      ? safe.toFixed(1)
      : Math.round(safe);

  liveUnit.textContent = unit;
}

async function loadIP() {
  try {
    const response = await fetch(
      "/api/ip",
      {
        cache: "no-store"
      }
    );

    if (!response.ok) {
      throw new Error("IP request failed.");
    }

    const data = await response.json();

    ipAddress.textContent =
      data.ip || "Unavailable";
  } catch (error) {
    console.error(error);

    ipAddress.textContent =
      "Unavailable";
  }
}

async function measurePing(samples = 7) {
  const times = [];

  for (let i = 0; i < samples; i++) {
    const start =
      performance.now();

    const response =
      await fetch(
        `/api/ping?t=${Date.now()}-${i}`,
        {
          cache: "no-store"
        }
      );

    if (!response.ok) {
      throw new Error(
        "Ping test failed."
      );
    }

    const elapsed =
      performance.now() - start;

    times.push(elapsed);

    setGauge(
      elapsed,
      150,
      "ms"
    );

    await new Promise(
      resolve =>
        setTimeout(resolve, 90)
    );
  }

  const ping =
    times.reduce(
      (total, value) =>
        total + value,
      0
    ) / times.length;

  const differences =
    times
      .slice(1)
      .map(
        (value, index) =>
          Math.abs(
            value - times[index]
          )
      );

  const jitter =
    differences.length
      ? differences.reduce(
          (total, value) =>
            total + value,
          0
        ) / differences.length
      : 0;

  return {
    ping,
    jitter
  };
}

async function measureDownload() {
  const requestedBytes =
    12 * 1024 * 1024;

  const start =
    performance.now();

  const response =
    await fetch(
      `/api/download?bytes=${requestedBytes}&t=${Date.now()}`,
      {
        cache: "no-store"
      }
    );

  if (!response.ok) {
    throw new Error(
      "Download test failed."
    );
  }

  let receivedBytes = 0;

  if (response.body) {
    const reader =
      response.body.getReader();

    while (true) {
      const result =
        await reader.read();

      if (result.done) {
        break;
      }

      receivedBytes +=
        result.value.byteLength;

      const seconds =
        (
          performance.now() -
          start
        ) / 1000;

      if (seconds > 0) {
        const currentMbps =
          (
            receivedBytes * 8
          ) /
          seconds /
          1_000_000;

        setGauge(
          currentMbps,
          500,
          "Mbps"
        );
      }
    }
  } else {
    const buffer =
      await response.arrayBuffer();

    receivedBytes =
      buffer.byteLength;
  }

  const seconds =
    (
      performance.now() -
      start
    ) / 1000;

  if (!receivedBytes) {
    receivedBytes =
      requestedBytes;
  }

  return (
    receivedBytes * 8
  ) /
    seconds /
    1_000_000;
}

async function measureUpload() {
  const bytes =
    6 * 1024 * 1024;

  const payload =
    new Uint8Array(bytes);

  const start =
    performance.now();

  const response =
    await fetch(
      `/api/upload?t=${Date.now()}`,
      {
        method: "POST",

        headers: {
          "Content-Type":
            "application/octet-stream"
        },

        body: payload
      }
    );

  if (!response.ok) {
    throw new Error(
      "Upload test failed."
    );
  }

  await response.json();

  const seconds =
    (
      performance.now() -
      start
    ) / 1000;

  const mbps =
    (
      bytes * 8
    ) /
    seconds /
    1_000_000;

  setGauge(
    mbps,
    500,
    "Mbps"
  );

  return mbps;
}

function calculateScore(
  download,
  upload,
  ping,
  jitter
) {
  const downloadScore =
    Math.min(
      download / 200,
      1
    ) * 40;

  const uploadScore =
    Math.min(
      upload / 50,
      1
    ) * 25;

  const pingScore =
    Math.max(
      0,
      1 -
        Math.max(
          ping - 10,
          0
        ) /
          140
    ) * 25;

  const jitterScore =
    Math.max(
      0,
      1 - jitter / 40
    ) * 10;

  return Math.round(
    Math.max(
      0,
      Math.min(
        100,
        downloadScore +
          uploadScore +
          pingScore +
          jitterScore
      )
    )
  );
}

function getScoreInfo(score) {
  if (score >= 90) {
    return [
      "Excellent",
      "Excellent for gaming, 4K streaming, video calls and large downloads."
    ];
  }

  if (score >= 75) {
    return [
      "Very Good",
      "Great for gaming, streaming, video calls and everyday use."
    ];
  }

  if (score >= 60) {
    return [
      "Good",
      "Good for streaming, browsing, calls and most online activities."
    ];
  }

  if (score >= 40) {
    return [
      "Average",
      "Fine for everyday browsing, but demanding tasks may feel slower."
    ];
  }

  if (score >= 20) {
    return [
      "Poor",
      "Your connection may struggle with streaming, calls or large downloads."
    ];
  }

  return [
    "Very Poor",
    "Your connection is currently very limited or unstable."
  ];
}

async function runTest() {
  startButton.disabled = true;

  scorePanel.classList.add(
    "hidden"
  );

  pingValue.textContent = "--";
  jitterValue.textContent = "--";
  downloadValue.textContent = "--";
  uploadValue.textContent = "--";

  try {
    phase.textContent =
      "PING";

    statusText.textContent =
      "Measuring latency...";

    const latency =
      await measurePing();

    pingValue.textContent =
      latency.ping.toFixed(0);

    jitterValue.textContent =
      latency.jitter.toFixed(1);

    phase.textContent =
      "DOWNLOAD";

    liveUnit.textContent =
      "Mbps";

    statusText.textContent =
      "Testing download speed...";

    const download =
      await measureDownload();

    downloadValue.textContent =
      download.toFixed(1);

    phase.textContent =
      "UPLOAD";

    statusText.textContent =
      "Testing upload speed...";

    const upload =
      await measureUpload();

    uploadValue.textContent =
      upload.toFixed(1);

    const score =
      calculateScore(
        download,
        upload,
        latency.ping,
        latency.jitter
      );

    const [
      label,
      description
    ] =
      getScoreInfo(score);

    scoreValue.textContent =
      score;

    scoreLabel.textContent =
      label;

    scoreDescription.textContent =
      description;

    scorePanel.classList.remove(
      "hidden"
    );

    phase.textContent =
      "DONE";

    setGauge(
      score,
      100,
      "/ 100"
    );

    statusText.textContent =
      "Test complete.";
  } catch (error) {
    console.error(error);

    phase.textContent =
      "ERROR";

    liveSpeed.textContent =
      "0";

    liveUnit.textContent =
      "Mbps";

    statusText.textContent =
      "The speed test could not be completed. Please try again.";
  } finally {
    startButton.disabled =
      false;
  }
}

startButton.addEventListener(
  "click",
  runTest
);

loadIP();
