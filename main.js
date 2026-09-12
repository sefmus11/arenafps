import * as THREE from "three";

// ---------- Cihaz tespiti ----------
const isMobile = ("ontouchstart" in window) || navigator.maxTouchPoints > 0;
document.getElementById("mobileControls").style.display = isMobile ? "block" : "none";

// ---------- Sahne kurulumu ----------
const scene = new THREE.Scene();
scene.background = new THREE.Color(0x87ceeb);
scene.fog = new THREE.Fog(0x87ceeb, 20, 80);

const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);

const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: "high-performance" });
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.75)); // performans için sınırlı
document.body.appendChild(renderer.domElement);

window.addEventListener("resize", () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});

scene.add(new THREE.HemisphereLight(0xffffff, 0x444444, 1.2));
const sun = new THREE.DirectionalLight(0xffffff, 1);
sun.position.set(30, 40, 20);
scene.add(sun);

// ---------- Harita ----------
const MAP_SIZE = 48;
const ground = new THREE.Mesh(
  new THREE.PlaneGeometry(MAP_SIZE, MAP_SIZE),
  new THREE.MeshStandardMaterial({ color: 0x557a4c })
);
ground.rotation.x = -Math.PI / 2;
scene.add(ground);

const wallMat = new THREE.MeshStandardMaterial({ color: 0x555555 });
function addWall(x, z, w, d) {
  const wall = new THREE.Mesh(new THREE.BoxGeometry(w, 6, d), wallMat);
  wall.position.set(x, 3, z);
  scene.add(wall);
}
addWall(0, -MAP_SIZE / 2, MAP_SIZE, 1);
addWall(0, MAP_SIZE / 2, MAP_SIZE, 1);
addWall(-MAP_SIZE / 2, 0, 1, MAP_SIZE);
addWall(MAP_SIZE / 2, 0, 1, MAP_SIZE);

const coverMat = new THREE.MeshStandardMaterial({ color: 0x8b5a2b });
for (let i = 0; i < 16; i++) {
  const size = 2 + Math.random() * 2;
  const box = new THREE.Mesh(new THREE.BoxGeometry(size, size, size), coverMat);
  box.position.set(
    (Math.random() * 2 - 1) * (MAP_SIZE / 2 - 4),
    size / 2,
    (Math.random() * 2 - 1) * (MAP_SIZE / 2 - 4)
  );
  scene.add(box);
}

// ---------- Kamera kontrolcüsü ----------
let yaw = 0;
let pitch = 0;
const player3D = new THREE.Object3D();
player3D.position.set(0, 1.7, 0);
scene.add(player3D);

function applyLook() {
  camera.rotation.order = "YXZ";
  camera.rotation.y = yaw;
  camera.rotation.x = pitch;
  camera.position.copy(player3D.position);
}

let pointerLocked = false;
renderer.domElement.addEventListener("click", () => {
  if (!isMobile && !pointerLocked && gameStarted) renderer.domElement.requestPointerLock();
});
document.addEventListener("pointerlockchange", () => {
  pointerLocked = document.pointerLockElement === renderer.domElement;
});
document.addEventListener("mousemove", (e) => {
  if (!pointerLocked) return;
  yaw -= e.movementX * 0.0022;
  pitch -= e.movementY * 0.0022;
  pitch = Math.max(-Math.PI / 2 + 0.05, Math.min(Math.PI / 2 - 0.05, pitch));
});

// Mobil bakış (sağ yarı sürükleme) — Pointer Events (dokunmatik + fare uyumlu)
const lookZone = document.getElementById("lookZone");
let lookPointerId = null;
let lastLookX = 0, lastLookY = 0;
lookZone.addEventListener("pointerdown", (e) => {
  lookPointerId = e.pointerId;
  lastLookX = e.clientX;
  lastLookY = e.clientY;
  lookZone.setPointerCapture(e.pointerId);
});
lookZone.addEventListener("pointermove", (e) => {
  if (e.pointerId !== lookPointerId) return;
  const dx = e.clientX - lastLookX;
  const dy = e.clientY - lastLookY;
  yaw -= dx * 0.0035;
  pitch -= dy * 0.0035;
  pitch = Math.max(-Math.PI / 2 + 0.05, Math.min(Math.PI / 2 - 0.05, pitch));
  lastLookX = e.clientX;
  lastLookY = e.clientY;
});
function releaseLook(e) {
  if (e.pointerId === lookPointerId) lookPointerId = null;
}
lookZone.addEventListener("pointerup", releaseLook);
lookZone.addEventListener("pointercancel", releaseLook);

// ---------- Hareket girişleri ----------
const keys = {};
document.addEventListener("keydown", (e) => (keys[e.code] = true));
document.addEventListener("keyup", (e) => (keys[e.code] = false));

// Mobil joystick — Pointer Events
const joystickZone = document.getElementById("joystickZone");
const joystickBase = document.getElementById("joystickBase");
const joystickKnob = document.getElementById("joystickKnob");
let joyPointerId = null;
let joyVec = { x: 0, y: 0 };
const JOY_RADIUS = 55;

joystickZone.addEventListener("pointerdown", (e) => {
  joyPointerId = e.pointerId;
  joystickZone.setPointerCapture(e.pointerId);
  joystickBase.style.display = "block";
  joystickBase.style.left = `${e.clientX - 55}px`;
  joystickBase.style.top = `${e.clientY - 55}px`;
  joystickBase.dataset.cx = e.clientX;
  joystickBase.dataset.cy = e.clientY;
});
joystickZone.addEventListener("pointermove", (e) => {
  if (e.pointerId !== joyPointerId) return;
  const cx = parseFloat(joystickBase.dataset.cx);
  const cy = parseFloat(joystickBase.dataset.cy);
  let dx = e.clientX - cx;
  let dy = e.clientY - cy;
  const dist = Math.min(Math.hypot(dx, dy), JOY_RADIUS);
  const angle = Math.atan2(dy, dx);
  dx = Math.cos(angle) * dist;
  dy = Math.sin(angle) * dist;
  joystickKnob.style.left = `${30 + dx}px`;
  joystickKnob.style.top = `${30 + dy}px`;
  joyVec.x = dx / JOY_RADIUS;
  joyVec.y = dy / JOY_RADIUS;
});
function endJoystick(e) {
  if (e.pointerId !== joyPointerId) return;
  joyPointerId = null;
  joyVec = { x: 0, y: 0 };
  joystickBase.style.display = "none";
  joystickKnob.style.left = "30px";
  joystickKnob.style.top = "30px";
}
joystickZone.addEventListener("pointerup", endJoystick);
joystickZone.addEventListener("pointercancel", endJoystick);

// Koşma
let running = false;
document.addEventListener("keydown", (e) => {
  if (e.code === "ShiftLeft" || e.code === "ShiftRight") running = true;
});
document.addEventListener("keyup", (e) => {
  if (e.code === "ShiftLeft" || e.code === "ShiftRight") running = false;
});
const runBtn = document.getElementById("runBtn");
runBtn.addEventListener("pointerdown", (e) => {
  e.preventDefault();
  running = !running;
  runBtn.classList.toggle("active", running);
});

let velocityY = 0;
let onGround = true;
const WALK_SPEED = 5.5;
const RUN_SPEED = 9.5;
const JUMP_FORCE = 7;
const GRAVITY = -18;

// ================== SİLAHLAR ==================
const WEAPONS = {
  knife: { name: "Bıçak", icon: "🔪", damage: 75, magSize: null, fireDelay: 0.5, range: 3, auto: false, reloadTime: 0 },
  pistol: { name: "Tabanca", icon: "🔫", damage: 20, magSize: 12, fireDelay: 0.28, range: 200, auto: false, reloadTime: 1.2 },
  rifle: { name: "Ağır Tüfek", icon: "💥", damage: 16, magSize: 30, fireDelay: 0.11, range: 200, auto: true, reloadTime: 2.0 },
};
let currentWeapon = "pistol";
let ammo = { pistol: WEAPONS.pistol.magSize, rifle: WEAPONS.rifle.magSize };
let reloading = false;
let lastShotTime = 0;

function updateAmmoHUD() {
  const w = WEAPONS[currentWeapon];
  const ammoEl = document.getElementById("ammo");
  ammoEl.textContent = w.magSize === null ? `${w.icon} —` : `${w.icon} ${ammo[currentWeapon]}/${w.magSize}`;
}

// ---------- Birinci şahıs silah modeli ----------
const weaponRig = new THREE.Group(); // kamera hareketiyle birlikte döner
camera.add(weaponRig);
scene.add(camera);

const weaponModels = {}; // weapon adı -> THREE.Group

function buildKnife() {
  const g = new THREE.Group();
  const blade = new THREE.Mesh(
    new THREE.BoxGeometry(0.05, 0.35, 0.03),
    new THREE.MeshStandardMaterial({ color: 0xd0d0d0, metalness: 0.7, roughness: 0.3 })
  );
  blade.position.set(0, 0.2, 0);
  const handle = new THREE.Mesh(
    new THREE.BoxGeometry(0.06, 0.15, 0.06),
    new THREE.MeshStandardMaterial({ color: 0x3b2a1a })
  );
  handle.position.set(0, 0, 0);
  g.add(blade, handle);
  return g;
}

function buildPistol() {
  const g = new THREE.Group();
  const mat = new THREE.MeshStandardMaterial({ color: 0x2b2b2b, metalness: 0.5, roughness: 0.5 });
  const slide = new THREE.Mesh(new THREE.BoxGeometry(0.09, 0.09, 0.32), mat);
  slide.position.set(0, 0.06, -0.05);
  const grip = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.2, 0.09), mat);
  grip.position.set(0, -0.08, 0.08);
  grip.rotation.x = 0.25;
  g.add(slide, grip);
  return g;
}

// Takıma göre görünüm: mavi -> M4 tarzı (gri/haki, düz gövde), kırmızı -> AK47 tarzı (kahverengi/ahşap, eğik şarjör)
function buildRifle(team) {
  const g = new THREE.Group();
  const isBlue = team === "blue";
  const bodyColor = isBlue ? 0x6b6f5e : 0x4a3423;
  const accentColor = isBlue ? 0x3c3f36 : 0x2e1f14;
  const bodyMat = new THREE.MeshStandardMaterial({ color: bodyColor, roughness: 0.6 });
  const accentMat = new THREE.MeshStandardMaterial({ color: accentColor, roughness: 0.6 });

  const receiver = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.11, 0.55), bodyMat);
  receiver.position.set(0, 0.02, -0.05);
  g.add(receiver);

  const barrel = new THREE.Mesh(new THREE.CylinderGeometry(0.018, 0.018, 0.35, 8), accentMat);
  barrel.rotation.z = Math.PI / 2;
  barrel.position.set(0, 0.02, -0.5);
  g.add(barrel);

  const stock = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.09, 0.3), accentMat);
  stock.position.set(0, 0, 0.32);
  if (!isBlue) stock.rotation.x = -0.08; // AK tarzı hafif eğim
  g.add(stock);

  const mag = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.28, 0.09), accentMat);
  mag.position.set(0, -0.16, -0.05);
  mag.rotation.x = isBlue ? 0.1 : 0.35; // AK'nin eğik şarjörü
  g.add(mag);

  const grip = new THREE.Mesh(new THREE.BoxGeometry(0.07, 0.16, 0.07), accentMat);
  grip.position.set(0, -0.12, 0.12);
  grip.rotation.x = 0.3;
  g.add(grip);

  return g;
}

function rebuildWeaponModels(team) {
  for (const key of Object.keys(weaponModels)) {
    weaponRig.remove(weaponModels[key]);
  }
  weaponModels.knife = buildKnife();
  weaponModels.pistol = buildPistol();
  weaponModels.rifle = buildRifle(team);

  for (const key of Object.keys(weaponModels)) {
    const m = weaponModels[key];
    m.position.set(0.22, -0.22, -0.4);
    m.visible = key === currentWeapon;
    weaponRig.add(m);
  }
}
rebuildWeaponModels("blue");

function setActiveWeaponModel(name) {
  for (const key of Object.keys(weaponModels)) {
    weaponModels[key].visible = key === name;
  }
}

// Ateş anında geri tepme + namlu alevi + mermi izi
let recoilTimer = 0;
const muzzleFlashes = [];
const tracers = [];

function triggerRecoil() {
  recoilTimer = 0.09;
}

function spawnMuzzleFlash() {
  const flashMat = new THREE.SpriteMaterial({ color: 0xffdd55, transparent: true, opacity: 1 });
  const sprite = new THREE.Sprite(flashMat);
  sprite.scale.set(0.15, 0.15, 0.15);
  const model = weaponModels[currentWeapon];
  const tip = new THREE.Vector3(0.22, -0.15, -0.75);
  camera.localToWorld(tip);
  sprite.position.copy(tip);
  scene.add(sprite);
  muzzleFlashes.push({ sprite, life: 0.06 });
}

function spawnTracer(from, to) {
  const geo = new THREE.BufferGeometry().setFromPoints([from, to]);
  const mat = new THREE.LineBasicMaterial({ color: 0xfff2a8, transparent: true, opacity: 0.9 });
  const line = new THREE.Line(geo, mat);
  scene.add(line);
  tracers.push({ line, life: 0.08 });
}

function updateTransientEffects(delta) {
  if (recoilTimer > 0) recoilTimer -= delta;
  const kick = recoilTimer > 0 ? (recoilTimer / 0.09) * 0.08 : 0;
  const model = weaponModels[currentWeapon];
  if (model) model.position.z = -0.4 + kick;

  for (let i = muzzleFlashes.length - 1; i >= 0; i--) {
    const f = muzzleFlashes[i];
    f.life -= delta;
    f.sprite.material.opacity = Math.max(0, f.life / 0.06);
    if (f.life <= 0) {
      scene.remove(f.sprite);
      muzzleFlashes.splice(i, 1);
    }
  }
  for (let i = tracers.length - 1; i >= 0; i--) {
    const t = tracers[i];
    t.life -= delta;
    t.line.material.opacity = Math.max(0, t.life / 0.08);
    if (t.life <= 0) {
      scene.remove(t.line);
      tracers.splice(i, 1);
    }
  }
}

function switchWeapon(name) {
  if (!WEAPONS[name] || currentWeapon === name || reloading) return;
  currentWeapon = name;
  setActiveWeaponModel(name);
  updateAmmoHUD();
  document.querySelectorAll(".weaponBtn").forEach((btn) => {
    btn.classList.toggle("active", btn.dataset.weapon === name);
  });
  ws.send(JSON.stringify({ type: "weapon", weapon: name }));
}

document.querySelectorAll(".weaponBtn").forEach((btn) => {
  btn.addEventListener("pointerdown", (e) => {
    e.preventDefault();
    switchWeapon(btn.dataset.weapon);
  });
});
document.addEventListener("keydown", (e) => {
  if (e.code === "Digit1") switchWeapon("knife");
  if (e.code === "Digit2") switchWeapon("pistol");
  if (e.code === "Digit3") switchWeapon("rifle");
  if (e.code === "KeyR") reload();
});

function reload() {
  const w = WEAPONS[currentWeapon];
  if (w.magSize === null || reloading || ammo[currentWeapon] === w.magSize) return;
  reloading = true;
  document.getElementById("ammo").textContent = "Dolduruluyor...";
  setTimeout(() => {
    ammo[currentWeapon] = w.magSize;
    reloading = false;
    updateAmmoHUD();
  }, w.reloadTime * 1000);
}
document.getElementById("reloadBtn").addEventListener("pointerdown", (e) => {
  e.preventDefault();
  reload();
});

// ================== OYUNCU MODELİ (BLOK İNSAN) ==================
const TEAM_COLOR = { blue: 0x3a6ea8, red: 0xa83a3a };

function makePlayerMesh(name, team) {
  const group = new THREE.Group();
  const shirtColor = TEAM_COLOR[team] || 0x888888;
  const skin = 0xe0ac69;
  const pants = 0x2c2c2c;

  const shirtMat = new THREE.MeshStandardMaterial({ color: shirtColor });
  const skinMat = new THREE.MeshStandardMaterial({ color: skin });
  const pantsMat = new THREE.MeshStandardMaterial({ color: pants });

  const torso = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.65, 0.28), shirtMat);
  torso.position.y = 1.15;
  group.add(torso);

  const head = new THREE.Mesh(new THREE.BoxGeometry(0.32, 0.32, 0.32), skinMat);
  head.position.y = 1.65;
  group.add(head);

  const armGeo = new THREE.BoxGeometry(0.15, 0.55, 0.15);
  const leftArm = new THREE.Mesh(armGeo, shirtMat);
  leftArm.position.set(-0.33, 1.15, 0);
  leftArm.geometry.translate(0, -0.27, 0);
  leftArm.position.y = 1.42;
  const rightArm = new THREE.Mesh(armGeo, shirtMat);
  rightArm.position.set(0.33, 1.15, 0);
  rightArm.geometry.translate(0, -0.27, 0);
  rightArm.position.y = 1.42;
  group.add(leftArm, rightArm);

  const legGeo = new THREE.BoxGeometry(0.18, 0.6, 0.18);
  const leftLeg = new THREE.Mesh(legGeo, pantsMat);
  leftLeg.geometry.translate(0, -0.3, 0);
  leftLeg.position.set(-0.13, 0.82, 0);
  const rightLeg = new THREE.Mesh(legGeo, pantsMat);
  rightLeg.geometry.translate(0, -0.3, 0);
  rightLeg.position.set(0.13, 0.82, 0);
  group.add(leftLeg, rightLeg);

  const canvas = document.createElement("canvas");
  canvas.width = 256;
  canvas.height = 64;
  const ctx = canvas.getContext("2d");
  ctx.fillStyle = team === "blue" ? "#8fc1ff" : "#ff9c8f";
  ctx.font = "bold 32px sans-serif";
  ctx.textAlign = "center";
  ctx.fillText(name, 128, 40);
  const texture = new THREE.CanvasTexture(canvas);
  const sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: texture, depthTest: false }));
  sprite.position.y = 2.05;
  sprite.scale.set(2, 0.5, 1);
  group.add(sprite);

  group.userData.limbs = { leftArm, rightArm, leftLeg, rightLeg };
  group.userData.walkPhase = 0;

  scene.add(group);
  return group;
}

function animateWalk(op, delta, moving) {
  const { leftArm, rightArm, leftLeg, rightLeg } = op.mesh.userData.limbs;
  if (moving) {
    op.mesh.userData.walkPhase += delta * 8;
  } else {
    op.mesh.userData.walkPhase *= 0.8;
  }
  const swing = Math.sin(op.mesh.userData.walkPhase) * (moving ? 0.5 : 0);
  leftLeg.rotation.x = swing;
  rightLeg.rotation.x = -swing;
  leftArm.rotation.x = -swing * 0.7;
  rightArm.rotation.x = swing * 0.7;
}

// ---------- Diğer oyuncular ----------
const otherPlayers = new Map();

// ---------- Ağ bağlantısı ----------
let ws;
let myId = null;
let myTeam = "blue";
let health = 100;
let alive = true;
let gameStarted = false;

function connect() {
  const url =
    window.GAME_SERVER_URL && window.GAME_SERVER_URL.trim() !== ""
      ? window.GAME_SERVER_URL.trim()
      : `${location.protocol === "https:" ? "wss" : "ws"}://${location.host}`;
  ws = new WebSocket(url);

  ws.addEventListener("message", (event) => {
    const msg = JSON.parse(event.data);

    if (msg.type === "welcome") {
      myId = msg.id;
      myTeam = msg.team;
      player3D.position.set(msg.spawn.x, msg.spawn.y, msg.spawn.z);
      rebuildWeaponModels(myTeam);
      setActiveWeaponModel(currentWeapon);
    }

    if (msg.type === "state") {
      const scoreList = document.getElementById("scoreList");
      scoreList.innerHTML = "";
      for (const [id, p] of Object.entries(msg.players)) {
        const cls = p.team === "blue" ? "teamBlue" : "teamRed";
        scoreList.innerHTML += `<div class="${cls}">${p.name}: ${p.kills} / ${p.deaths}</div>`;
        if (id === myId) continue;

        if (!otherPlayers.has(id)) {
          otherPlayers.set(id, {
            mesh: makePlayerMesh(p.name, p.team),
            targetPos: p.position,
            prevPos: p.position,
            targetRotY: p.rotationY,
            team: p.team,
          });
        }
        const op = otherPlayers.get(id);
        op.prevPos = op.targetPos;
        op.targetPos = p.position;
        op.targetRotY = p.rotationY;
        op.mesh.visible = p.alive;
      }
    }

    if (msg.type === "playerLeft") {
      const op = otherPlayers.get(msg.id);
      if (op) {
        scene.remove(op.mesh);
        otherPlayers.delete(msg.id);
      }
    }

    if (msg.type === "hit" && msg.targetId === myId) {
      health = msg.health;
      document.getElementById("health").textContent = `❤️ ${health}`;
      flashDamage();
    }

    if (msg.type === "death") {
      addKillFeed(`${msg.killerName} ${WEAPONS[msg.weapon]?.icon || "🔫"} ${msg.victimName}`);
      if (msg.id === myId) {
        alive = false;
        document.getElementById("deathScreen").style.display = "flex";
      }
    }

    if (msg.type === "respawn" && msg.id === myId) {
      alive = true;
      health = 100;
      document.getElementById("health").textContent = `❤️ 100`;
      document.getElementById("deathScreen").style.display = "none";
      player3D.position.set(msg.position.x, msg.position.y, msg.position.z);
    }
  });

  ws.addEventListener("close", () => {
    setTimeout(connect, 2000);
  });
}

function flashDamage() {
  document.body.style.boxShadow = "inset 0 0 100px 40px red";
  setTimeout(() => (document.body.style.boxShadow = "none"), 150);
}

function addKillFeed(text) {
  const feed = document.getElementById("killfeed");
  const div = document.createElement("div");
  div.textContent = text;
  feed.prepend(div);
  setTimeout(() => div.remove(), 4000);
}

// ---------- Başlangıç ekranı ----------
let selectedTeam = "blue";
document.getElementById("teamBlueBtn").addEventListener("click", () => {
  selectedTeam = "blue";
  document.getElementById("teamBlueBtn").classList.add("selected");
  document.getElementById("teamRedBtn").classList.remove("selected");
});
document.getElementById("teamRedBtn").addEventListener("click", () => {
  selectedTeam = "red";
  document.getElementById("teamRedBtn").classList.add("selected");
  document.getElementById("teamBlueBtn").classList.remove("selected");
});
document.getElementById("teamBlueBtn").classList.add("selected");

document.getElementById("playBtn").addEventListener("click", () => {
  const myName = document.getElementById("nameInput").value.trim() || "Oyuncu";
  document.getElementById("startScreen").style.display = "none";
  gameStarted = true;
  connect();
  setTimeout(() => {
    if (ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify({ type: "join", name: myName, team: selectedTeam }));
    } else {
      ws.addEventListener("open", () => {
        ws.send(JSON.stringify({ type: "join", name: myName, team: selectedTeam }));
      });
    }
  }, 100);
  if (!isMobile) renderer.domElement.requestPointerLock();
});

// ---------- Ateş etme ----------
const raycaster = new THREE.Raycaster();
function tryShoot() {
  if (!gameStarted || !alive || reloading) return;
  const w = WEAPONS[currentWeapon];
  const now = performance.now() / 1000;
  if (now - lastShotTime < w.fireDelay) return;

  if (w.magSize !== null) {
    if (ammo[currentWeapon] <= 0) {
      reload();
      return;
    }
    ammo[currentWeapon]--;
    updateAmmoHUD();
  }
  lastShotTime = now;
  triggerRecoil();
  spawnMuzzleFlash();

  raycaster.setFromCamera({ x: 0, y: 0 }, camera);
  let closestId = null;
  let closestDist = Infinity;
  let closestPoint = null;

  for (const [id, op] of otherPlayers) {
    if (!op.mesh.visible) continue;
    const box = new THREE.Box3().setFromObject(op.mesh);
    const hit = raycaster.ray.intersectBox(box, new THREE.Vector3());
    if (hit) {
      const dist = camera.position.distanceTo(hit);
      if (dist < w.range && dist < closestDist) {
        closestDist = dist;
        closestId = id;
        closestPoint = hit;
      }
    }
  }

  const muzzleWorld = new THREE.Vector3(0.22, -0.15, -0.75);
  camera.localToWorld(muzzleWorld);
  const farPoint = closestPoint || camera.position.clone().addScaledVector(
    new THREE.Vector3().setFromMatrixColumn(camera.matrixWorld, 2).multiplyScalar(-1),
    30
  );
  spawnTracer(muzzleWorld, farPoint);

  if (closestId) {
    ws.send(JSON.stringify({ type: "shoot", targetId: closestId, weapon: currentWeapon }));
  }

  if (w.magSize !== null && ammo[currentWeapon] <= 0) reload();
}

let firing = false;
document.addEventListener("mousedown", () => {
  if (!pointerLocked) return;
  firing = true;
  tryShoot();
});
document.addEventListener("mouseup", () => (firing = false));

const fireBtn = document.getElementById("fireBtn");
fireBtn.addEventListener("pointerdown", (e) => {
  e.preventDefault();
  firing = true;
  tryShoot();
});
fireBtn.addEventListener("pointerup", () => (firing = false));
fireBtn.addEventListener("pointercancel", () => (firing = false));

// ---------- Ağ gönderim hızını sınırlama (optimizasyon) ----------
let lastNetworkSend = 0;
const NETWORK_SEND_INTERVAL = 1 / 20; // saniyede 20 kez yeterli

// ---------- Oyun döngüsü ----------
const clock = new THREE.Clock();

function animate() {
  requestAnimationFrame(animate);
  const delta = Math.min(clock.getDelta(), 0.1);

  applyLook();
  updateTransientEffects(delta);

  if (gameStarted && alive) {
    if (firing && WEAPONS[currentWeapon].auto) tryShoot();

    let forward = 0;
    let strafe = 0;
    let speedScale = 1;

    if (isMobile) {
      forward = -joyVec.y;
      strafe = joyVec.x;
      const mag = Math.hypot(joyVec.x, joyVec.y);
      speedScale = mag;
      if (mag > 0.75) running = true;
      else if (mag < 0.3) running = false;
    } else {
      forward = (keys["KeyW"] ? 1 : 0) - (keys["KeyS"] ? 1 : 0);
      strafe = (keys["KeyD"] ? 1 : 0) - (keys["KeyA"] ? 1 : 0);
    }

    const baseSpeed = running ? RUN_SPEED : WALK_SPEED;
    const speed = baseSpeed * delta * speedScale;

    const dir = new THREE.Vector3();
    camera.getWorldDirection(dir);
    dir.y = 0;
    dir.normalize();
    const right = new THREE.Vector3().crossVectors(dir, camera.up).normalize();

    player3D.position.addScaledVector(dir, forward * speed);
    player3D.position.addScaledVector(right, strafe * speed);

    if (keys["Space"] && onGround) {
      velocityY = JUMP_FORCE;
      onGround = false;
    }
    velocityY += GRAVITY * delta;
    player3D.position.y += velocityY * delta;
    if (player3D.position.y <= 1.7) {
      player3D.position.y = 1.7;
      velocityY = 0;
      onGround = true;
    }

    const limit = MAP_SIZE / 2 - 1;
    player3D.position.x = Math.max(-limit, Math.min(limit, player3D.position.x));
    player3D.position.z = Math.max(-limit, Math.min(limit, player3D.position.z));

    lastNetworkSend += delta;
    if (ws && ws.readyState === WebSocket.OPEN && lastNetworkSend >= NETWORK_SEND_INTERVAL) {
      lastNetworkSend = 0;
      ws.send(
        JSON.stringify({
          type: "move",
          position: { x: player3D.position.x, y: player3D.position.y, z: player3D.position.z },
          rotationY: yaw,
        })
      );
    }
  }

  for (const [, op] of otherPlayers) {
    const dist = Math.hypot(op.targetPos.x - op.mesh.position.x, op.targetPos.z - op.mesh.position.z);
    const moving = dist > 0.02;
    op.mesh.position.lerp(new THREE.Vector3(op.targetPos.x, 0, op.targetPos.z), 0.25);
    op.mesh.rotation.y = op.targetRotY;
    animateWalk(op, delta, moving);
  }

  renderer.render(scene, camera);
}
updateAmmoHUD();
animate();
