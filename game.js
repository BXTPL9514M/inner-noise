// ================= CANVAS =================
const canvas = document.getElementById("gameCanvas");
const ctx = canvas.getContext("2d");
ctx.clearRect(0,0,canvas.width,canvas.height);
// ================= HORROR BACKGROUND DATA =================
const fogParticles = [];

for (let i = 0; i < 30; i++) {
  fogParticles.push({
    x: Math.random() * canvas.width,
    y: Math.random() * canvas.height,
    radius: 200 + Math.random() * 300,
    speed: 0.1 + Math.random() * 0.3,
    alpha: 0.015 + Math.random() * 0.03
  });
}

let darknessPulse = 0;

canvas.width = window.innerWidth;
canvas.height = window.innerHeight;

// ================= AUDIO =================
function unlockAudio() {
  ambientSound.volume = 0.6;
  ambientSound.play().catch(() => {});
  document.removeEventListener("click", unlockAudio);
  document.removeEventListener("touchstart", unlockAudio);
}

document.addEventListener("click", unlockAudio);
document.addEventListener("touchstart", unlockAudio);

const ambientSound = document.getElementById("ambient");
const heartbeatSound = document.getElementById("heartbeat");
const silenceSound = document.getElementById("silenceSound");

let audioStarted = false;
function startAudio() {
  if (audioStarted) return;
  ambientSound.loop = true;
  ambientSound.volume = 0.6;
  ambientSound.play();
  audioStarted = true;
}

window.addEventListener("keydown", startAudio);
window.addEventListener("mousedown", startAudio);
window.addEventListener("touchstart", startAudio);

// ================= BACKGROUND FOG =================
const mistParticles = [];
for (let i = 0; i < 25; i++) {
  mistParticles.push({
    x: Math.random() * canvas.width,
    y: Math.random() * canvas.height,
    size: 200 + Math.random() * 300,
    speed: 0.1 + Math.random() * 0.3,
    alpha: 0.02 + Math.random() * 0.04
  });
}

// ================= PLAYER =================
const player = {
  x: canvas.width / 2,
  y: canvas.height / 2,
  size: 30,
  speed: 4,
  pulse: 0
};

// ================= GAME STATE =================
let clarity = 100;
let gameOver = false;
let shake = 0;
let redFlash = 0;

let focusActive = false;
let acceptanceActive = false;
let focusTimer = 0;
let acceptanceTimer = 0;

let startTime = Date.now();
let survivedTime = 0;

let activeAbilityText = "";
let abilityTextTimer = 0;

// ================= MOBILE INPUT =================
const mobileMove = {
  up: false,
  down: false,
  left: false,
  right: false
};
function bindMobileButton(id, direction) {
  const btn = document.getElementById(id);
  if (!btn) return;

  btn.addEventListener("touchstart", e => {
    e.preventDefault();
    mobileMove[direction] = true;
  });

  btn.addEventListener("touchend", e => {
    e.preventDefault();
    mobileMove[direction] = false;
  });

  btn.addEventListener("touchcancel", () => {
    mobileMove[direction] = false;
  });
}

bindMobileButton("up", "up");
bindMobileButton("down", "down");
bindMobileButton("left", "left");
bindMobileButton("right", "right");

// ================= INPUT =================
const keys = {};
window.addEventListener("keydown", e => keys[e.key] = true);
window.addEventListener("keyup", e => keys[e.key] = false);

// ================= ANALOG JOYSTICK =================
const joystick = document.getElementById("joystick");
const knob = document.getElementById("joystick-knob");

let joyActive = false;
let joyX = 0;
let joyY = 0;

const JOY_RADIUS = 40;

function getTouchPos(e) {
  const touch = e.touches[0];
  const rect = joystick.getBoundingClientRect();
  return {
    x: touch.clientX - rect.left,
    y: touch.clientY - rect.top
  };
}

joystick.addEventListener("touchstart", e => {
  e.preventDefault();
  joyActive = true;
});

joystick.addEventListener("touchmove", e => {
  if (!joyActive) return;
  e.preventDefault();

  const pos = getTouchPos(e);
  const dx = pos.x - 60;
  const dy = pos.y - 60;

  const dist = Math.min(Math.hypot(dx, dy), JOY_RADIUS);
  const angle = Math.atan2(dy, dx);

  joyX = Math.cos(angle) * (dist / JOY_RADIUS);
  joyY = Math.sin(angle) * (dist / JOY_RADIUS);

  knob.style.left = 60 + joyX * JOY_RADIUS - 25 + "px";
  knob.style.top = 60 + joyY * JOY_RADIUS - 25 + "px";
});

joystick.addEventListener("touchend", () => {
  joyActive = false;
  joyX = 0;
  joyY = 0;
  knob.style.left = "35px";
  knob.style.top = "35px";
});

// ================= ENEMIES =================
const thoughts = [];
const thoughtTypes = ["STRESS", "FEAR", "DOUBT"];

function spawnThought() {
  const size = 26;
  let x, y;
  const edge = Math.floor(Math.random() * 4);

  if (edge === 0) { x = Math.random() * canvas.width; y = -size; }
  if (edge === 1) { x = canvas.width + size; y = Math.random() * canvas.height; }
  if (edge === 2) { x = Math.random() * canvas.width; y = canvas.height + size; }
  if (edge === 3) { x = -size; y = Math.random() * canvas.height; }

  thoughts.push({
    x, y,
    size,
    speed: 1 + Math.random(),
    label: thoughtTypes[Math.floor(Math.random() * thoughtTypes.length)]
  });
}
setInterval(spawnThought, 2000);

// ================= COLLISION =================
function isColliding(a, b) {
  const dx = (a.x + a.size / 2) - b.x;
  const dy = (a.y + a.size / 2) - b.y;
  return Math.hypot(dx, dy) < a.size / 2 + b.size / 2;
}

// ================= ABILITIES =================
function useFocus() {
  focusActive = true;
  focusTimer = 300;
  activeAbilityText = "FOCUS";
  abilityTextTimer = 120;
}

function useSilence() {
  thoughts.length = 0;
  ambientSound.pause();
  heartbeatSound.pause();
  silenceSound.volume = 1;
  silenceSound.play();

  setTimeout(() => {
    ambientSound.play();
  }, 2000);

  activeAbilityText = "SILENCE";
  abilityTextTimer = 120;
}

function useAcceptance() {
  acceptanceActive = true;
  acceptanceTimer = 300;
  activeAbilityText = "ACCEPTANCE";
  abilityTextTimer = 120;
}

// ================= UPDATE =================
function update() {
  if (gameOver) return;

  survivedTime = Math.floor((Date.now() - startTime) / 1000);

// Keyboard movement
let moveX = 0;
let moveY = 0;

if (keys["w"] || keys["ArrowUp"]) moveY -= 1;
if (keys["s"] || keys["ArrowDown"]) moveY += 1;
if (keys["a"] || keys["ArrowLeft"]) moveX -= 1;
if (keys["d"] || keys["ArrowRight"]) moveX += 1;

// Analog joystick movement
moveX += joyX;
moveY += joyY;

// Normalize diagonal speed
const len = Math.hypot(moveX, moveY);
if (len > 0) {
  moveX /= len;
  moveY /= len;
}

player.x += moveX * player.speed;
player.y += moveY * player.speed;

  player.x = Math.max(0, Math.min(canvas.width - player.size, player.x));
  player.y = Math.max(0, Math.min(canvas.height - player.size, player.y));

  player.pulse += 0.1;

  thoughts.forEach(t => {
    const dx = player.x - t.x;
    const dy = player.y - t.y;
    const dist = Math.hypot(dx, dy);
    if (dist > 0) {
      const speed = focusActive ? t.speed * 0.3 : t.speed;
      t.x += (dx / dist) * speed;
      t.y += (dy / dist) * speed;
    }

    if (isColliding(player, t)) {
      if (!acceptanceActive) clarity -= 0.25;
      shake = 10;
      redFlash = 0.4;
      if (clarity <= 0) {
        clarity = 0;
        gameOver = true;
      }
    }
  });

  if (clarity < 60 && heartbeatSound.paused) {
    heartbeatSound.loop = true;
    heartbeatSound.volume = 0.8;
    heartbeatSound.play();
  }
  if (clarity > 70 && !heartbeatSound.paused) {
    heartbeatSound.pause();
    heartbeatSound.currentTime = 0;
  }

  shake *= 0.9;
  redFlash *= 0.9;

  if (focusActive && --focusTimer <= 0) focusActive = false;
  if (acceptanceActive && --acceptanceTimer <= 0) acceptanceActive = false;

  if (abilityTextTimer > 0) abilityTextTimer--;
  else activeAbilityText = "";
}

// ================= DRAW BACKGROUND =================
function drawBackground() {
  const bg = ctx.createLinearGradient(0, 0, 0, canvas.height);
  bg.addColorStop(0, "#020204");
  bg.addColorStop(1, "#0a0a12");
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  mistParticles.forEach(p => {
    p.y -= p.speed;
    if (p.y < -p.size) {
      p.y = canvas.height + p.size;
      p.x = Math.random() * canvas.width;
    }
    const mist = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, p.size);
    mist.addColorStop(0, "rgba(40,40,60," + p.alpha + ")");
    mist.addColorStop(1, "rgba(0,0,0,0)");
    ctx.fillStyle = mist;
    ctx.beginPath();
    ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
    ctx.fill();
  });
}

function drawVoidBackground() {
  const bg = ctx.createLinearGradient(0, 0, 0, canvas.height);
  bg.addColorStop(0, "#020203");
  bg.addColorStop(0.5, "#080810");
  bg.addColorStop(1, "#000000");

  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, canvas.width, canvas.height);
}

function drawFog() {
  fogParticles.forEach(p => {
    p.y -= p.speed;
    if (p.y < -p.radius) {
      p.y = canvas.height + p.radius;
      p.x = Math.random() * canvas.width;
    }

const fog = ctx.createRadialGradient(
  p.x, p.y, 0,
  p.x, p.y, p.radius
);

fog.addColorStop(0, "rgba(30,30,45," + p.alpha + ")");
fog.addColorStop(1, "rgba(0,0,0,0)");

ctx.fillStyle = fog;
ctx.beginPath();
ctx.arc(p.x, p.y, p.radius, 0, Math.PI * 2);
ctx.fill();
  });
}



function drawPanicVignette() {
  const panic = 1 - clarity / 100;

  const vignette = ctx.createRadialGradient(
    canvas.width / 2,
    canvas.height / 2,
    canvas.width * 0.25,
    canvas.width / 2,
    canvas.height / 2,
    canvas.width * 0.8
  );

  vignette.addColorStop(0, "rgba(0,0,0,0)");
  vignette.addColorStop(1, "rgba(0,0,0," + (0.4 + panic * 0.5) + ")");

  ctx.fillStyle = vignette;
}


// ================= HORROR BACKGROUND FUNCTIONS =================

let bgPulse = 0;

function drawBaseVoid(ctx, canvas) {
  const bg = ctx.createLinearGradient(0, 0, 0, canvas.height);
  bg.addColorStop(0, "#030306");
  bg.addColorStop(1, "#0a0a12");

  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, canvas.width, canvas.height);
}

function drawMist(ctx, canvas, mistParticles) {
  mistParticles.forEach(p => {
    p.y -= p.speed;
    if (p.y < -p.size) {
      p.y = canvas.height + p.size;
      p.x = Math.random() * canvas.width;
    }

    const mist = ctx.createRadialGradient(
      p.x, p.y, 0,
      p.x, p.y, p.size
    );

    mist.addColorStop(0, "rgba(40,40,60," + p.alpha + ")");
    mist.addColorStop(1, "rgba(0,0,0,0)");

    ctx.fillStyle = mist;
    ctx.beginPath();
    ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
    ctx.fill();
  });
}



function drawVignette() {
  const panic = 1 - clarity / 100;

  const vignette = ctx.createRadialGradient(
    canvas.width / 2,
    canvas.height / 2,
    canvas.width * 0.25,
    canvas.width / 2,
    canvas.height / 2,
    canvas.width * 0.75
  );

  vignette.addColorStop(0, "rgba(0,0,0,0)");
  vignette.addColorStop(1, "rgba(0,0,0," + (0.5 + panic * 0.4) + ")");

  ctx.fillStyle = vignette;
  ctx.fillRect(0, 0, canvas.width, canvas.height);
}

// ================= HORROR BACKGROUND =================
let fogTime = 0;

function drawBaseDarkness() {
  const bg = ctx.createLinearGradient(0, 0, 0, canvas.height);
  bg.addColorStop(0, "#0b0b1a");   // dark blue-black
  bg.addColorStop(1, "#000000");  // pure black

  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, canvas.width, canvas.height);
}

function drawMovingFog() {
  fogTime += 0.002;

  for (let i = 0; i < 18; i++) {
    const x = (Math.sin(fogTime + i) + 1) * canvas.width / 2;
    const y = (i / 18) * canvas.height;

    const fog = ctx.createRadialGradient(x, y, 0, x, y, 350);
    fog.addColorStop(0, "rgba(40,40,60,0.05)");
    fog.addColorStop(1, "rgba(0,0,0,0)");

    ctx.fillStyle = fog;
    ctx.beginPath();
    ctx.arc(x, y, 350, 0, Math.PI * 2);
    ctx.fill();
  }
}

function drawBreathingDarkness() {
  const breathe = (Math.sin(Date.now() * 0.0015) + 1) / 2;
  ctx.fillStyle = "rgba(0,0,0," + (0.15 + breathe * 0.15) + ")";
  ctx.fillRect(0, 0, canvas.width, canvas.height);
}

// ================= DRAW =================
function draw() {
  ctx.setTransform(
    1, 0, 0, 1,
    (Math.random() - 0.5) * shake,
    (Math.random() - 0.5) * shake
  );

ctx.clearRect(0,0,canvas.width,canvas.height);


  // PLAYER
  const pulseSize = player.size + Math.sin(player.pulse) * 4;
  const px = player.x + pulseSize / 2;
  const py = player.y + pulseSize / 2;

  const glow = ctx.createRadialGradient(px, py, 5, px, py, pulseSize);
  glow.addColorStop(0, "#ffffff");
  glow.addColorStop(1, "rgba(184,198,255,0)");

  ctx.fillStyle = glow;
  ctx.beginPath();
  ctx.arc(px, py, pulseSize / 2, 0, Math.PI * 2);
  ctx.fill();

  // ENEMIES
  thoughts.forEach(t => {
    ctx.fillStyle = "#ff6b6b";
    ctx.beginPath();
    ctx.arc(t.x, t.y, t.size / 2, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = "#fff";
    ctx.font = "10px monospace";
    ctx.textAlign = "center";
    ctx.fillText(t.label, t.x, t.y - t.size);
  });

  // UI
  ctx.fillStyle = "#333";
  ctx.fillRect(20, 20, 200, 12);
  ctx.fillStyle = "#7bed9f";
  ctx.fillRect(20, 20, 200 * (clarity / 100), 12);
  ctx.strokeStyle = "#fff";
  ctx.strokeRect(20, 20, 200, 12);

  ctx.fillStyle = "#fff";
  ctx.font = "14px monospace";
  ctx.fillText("TIME: " + survivedTime + "s", 20, 60);

  if (activeAbilityText) {
    ctx.textAlign = "center";
    ctx.font = "20px monospace";
    ctx.fillText(activeAbilityText + " ACTIVE", canvas.width / 2, canvas.height - 40);
  }

  if (redFlash > 0) {
    ctx.fillStyle = "rgba(255,0,0," + redFlash + ")";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
  }

// ================= GAME OVER SCREEN =================
  if (gameOver) {
    ctx.setTransform(1, 0, 0, 1, 0, 0);

    ctx.fillStyle = "rgba(0,0,0,0.85)";
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    ctx.fillStyle = "#ffdddd";
    ctx.textAlign = "center";

    ctx.font = "36px monospace";
    ctx.fillText(
      "YOUR MIND COLLAPSED",
      canvas.width / 2,
      canvas.height / 2 - 20
    );

    ctx.font = "18px monospace";
    ctx.fillText(
      "You stayed clear for " + survivedTime + " seconds",
      canvas.width / 2,
      canvas.height / 2 + 20
    );

    ctx.font = "14px monospace";
    ctx.fillText(
      "Refresh to try again",
      canvas.width / 2,
      canvas.height / 2 + 50
    );
  }

}


// ================= LOOP =================
function loop() {
  update();
  draw();
  requestAnimationFrame(loop);
}
loop();