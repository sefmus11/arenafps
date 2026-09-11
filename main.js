import * as THREE from "three";

// ---------- Cihaz tespiti ----------
const isMobile = ("ontouchstart" in window) || navigator.maxTouchPoints > 0;
document.getElementById("mobileControls").style.display = isMobile ? "block" : "none";

// ---------- Sahne kurulumu ----------
const scene = new THREE.Scene();
scene.background = new THREE.Color(0x87ceeb);
scene.fog = new THREE.Fog(0x87ceeb, 20, 80);

const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);

const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
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
for (let i = 0; i < 18; i++) {
  const size = 2 + Math.random() * 2;
  const box = new THREE.Mesh(new THREE.BoxGeometry(size, size, size), coverMat);
  box.position.set(
    (Math.random() * 2 - 1) * (MAP_SIZE / 2 - 4),
    size / 2,
    (Math.random() * 2 - 1) * (MAP_SIZE / 2 - 4)
  );
  scene.add(box);
}

// ---------- Kamera kontrolcüsü (masaüstü fare + mobil dokunmatik ortak) ----------
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

// Mobil bakış (sağ yarı sürükleme)
const lookZone = document.getElementById("lookZone");
let lookTouchId = null;
let lastLookX = 0, lastLookY = 0;
lookZone.addEventListener("touchstart", (e) => {
  const t = e.changedTouches[0];
  lookTouchId = t.identifier;
  lastLookX = t.clientX;
  lastLookY = t.clientY;
});
lookZone.addEventListener("touchmove", (e) => {
  for (const t of e.changedTouches) {
    if (t.identifier !== lookTouchId) continue;
    const dx = t.clientX - lastLookX;
    const dy = t.clientY - lastLookY;
    yaw -= dx * 0.0035;
    pitch -= dy * 0.0035;
    pitch = Math.max(-Math.PI / 2 + 0.05, Math.min(Math.PI / 2 - 0.05, pitch));
    lastLookX = t.clientX;
    lastLookY = t.clientY;
  }
});
lookZone.addEventListener("touchend", (e) => {
  for (const t of e.changedTouches) {
    if (t.identifier === lookTouchId) lookTouchId = null;
  }
});

// ---------- Hareket girişleri ----------
const keys = {};
document.addEventListener("keydown", (e) => (keys[e.code] = true));
document.addEventListener("keyup", (e) => (keys[e.code] = false));

// Mobil joystick
const joystickZone = document.getElementById("joystickZone");
const joystickBase = document.getElementById("joystickBase");
const joystickKnob = document.getElementById("joystickKnob");
let joyTouchId = null;
let joyVec = { x: 0, y: 0 }; // -1..1
const JOY_RADIUS = 55;

joystickZone.addEventListener("touchstart", (e) => {
  const t = e.changedTouches[0];
  joyTouchId = t.identifier;
  joystickBase.style.display = "block";
  joystickBase.style.left = `${t.clientX - 55}px`;
  joystickBase.style.top = `${t.clientY - 55}px`;
  joystickBase.dataset.cx = t.clientX;
  joystickBase.dataset.cy = t.clientY;
});
joystickZone.addEventListener("touchmove", (e) => {
  for (const t of e.changedTouches) {
    if (t.identifier !== joyTouchId) continue;
    const cx = parseFloat(joystickBase.dataset.cx);
    const cy = parseFloat(joystickBase.dataset.cy);
    let dx = t.clientX - cx;
    let dy = t.clientY - cy;
    const dist = Math.min(Math.hypot(dx, dy), JOY_RADIUS);
    const angle = Math.atan2(dy, dx);
    dx = Math.cos(angle) * dist;
    dy = Math.sin(angle) * dist;
    joystickKnob.style.left = `${30 + dx}px`;
    joystickKnob.style.top = `${30 + dy}px`;
    joyVec.x = dx / JOY_RADIUS;
    joyVec.y = dy / JOY_RADIUS;
  }
});
function endJoystick(e) {
  for (const t of e.changedTouches) {
    if (t.identifier === joyTouchId) {
      joyTouchId = null;
      joyVec = { x: 0, y: 0 };
      joystickBase.style.display = "none";
      joystickKnob.style.left = "30px";
      joystickKnob.style.top = "30px";
    }
  }
}
joystickZone.addEventListener("touchend", endJoystick);
joystickZone.addEventListener("touchcancel", endJoystick);

// Koşma
let running = false;
document.addEventListener("keydown", (e) => {
  if (e.code === "ShiftLeft" || e.code === "ShiftRight") running = true;
});
document.addEventListener("keyup", (e) => {
  if (e.code === "ShiftLeft" || e.code === "ShiftRight") running = false;
});
const runBtn = document.getElementById("runBtn");
runBtn.addEventListener("touchstart", () => {
  running = !running;
  runBtn.classList.toggle("active", running);
});

let velocityY = 0;
let onGround = true;
const WALK_SPEED = 5.5;
const RUN_SPEED = 9.5;
const JUMP_FORCE = 7;
const GRAVITY = -18;

// ---------- Silahlar ----------
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
  if (w.magSize === null) {
    ammoEl.textContent = `${w.icon} —`;
  } else {
    ammoEl.textContent = `${w.icon} ${ammo[currentWeapon]}/${w.magSize}`;
  }
}

function switchWeapon(name) {
  if (!WEAPONS[name] || currentWeapon === name || reloading) return;
  currentWeapon = name;
  updateAmmoHUD();
  document.querySelectorAll(".weaponBtn").forEach((btn) => {
    btn.classList.toggle("active", btn.dataset.weapon === name);
  });
  ws.send(JSON.stringify({ type: "weapon", weapon: name }));
}

document.querySelectorAll(".weaponBtn").forEach((btn) => {
  btn.addEventListener("click", () => switchWeapon(btn.dataset.weapon));
  btn.addEventListener("touchstart", (e) => {
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
document.getElementById("reloadBtn").addEventListener("touchstart", (e) => {
  e.preventDefault();
  reload();
});

// ---------- Diğer oyuncular ----------
const otherPlayers = new Map();
const TEAM_COLOR = { blue: 0x3498db, red: 0xe74c3c };

function makePlayerMesh(name, team) {
  const group = new THREE.Group();
  const body = new THREE.Mesh(
    new THREE.CapsuleGeometry(0.4, 1.2, 4, 8),
    new THREE.MeshStandardMaterial({ color: TEAM_COLOR[team] || 0xffffff })
  );
  body.position.y = 1;
  group.add(body);

  const canvas = document.createElement("canvas");
  canvas.width = 256;
  canvas.height = 64;
  const ctx = canvas.getContext("2d");
  ctx.fillStyle = team === "blue" ? "#5dade2" : "#ff6b5b";
  ctx.font = "bold 32px sans-serif";
  ctx.textAlign = "center";
  ctx.fillText(name, 128, 40);
  const texture = new THREE.CanvasTexture(canvas);
  const sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: texture, depthTest: false }));
  sprite.position.y = 2.3;
  sprite.scale.set(2, 0.5, 1);
  group.add(sprite);

  scene.add(group);
  return group;
}

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
            targetRotY: p.rotationY,
            team: p.team,
          });
        }
        const op = otherPlayers.get(id);
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
    setTimeout(connect, 2000); // bağlantı koparsa yeniden dene
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

  raycaster.setFromCamera({ x: 0, y: 0 }, camera);
  let closestId = null;
  let closestDist = Infinity;

  for (const [id, op] of otherPlayers) {
    if (!op.mesh.visible) continue;
    const box = new THREE.Box3().setFromObject(op.mesh);
    const hit = raycaster.ray.intersectBox(box, new THREE.Vector3());
    if (hit) {
      const dist = camera.position.distanceTo(hit);
      if (dist < w.range && dist < closestDist) {
        closestDist = dist;
        closestId = id;
      }
    }
  }

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
fireBtn.addEventListener("touchstart", (e) => {
  e.preventDefault();
  firing = true;
  tryShoot();
});
fireBtn.addEventListener("touchend", () => (firing = false));

// ---------- Oyun döngüsü ----------
const clock = new THREE.Clock();

function animate() {
  requestAnimationFrame(animate);
  const delta = Math.min(clock.getDelta(), 0.1);

  applyLook();

  if (gameStarted && alive) {
    // Otomatik silah tetiği basılı tutuluyorsa
    if (firing && WEAPONS[currentWeapon].auto) tryShoot();

    let forward = 0;
    let strafe = 0;
    let speedScale = 1;

    if (isMobile) {
      forward = -joyVec.y;
      strafe = joyVec.x;
      const mag = Math.hypot(joyVec.x, joyVec.y);
      speedScale = mag; // joystick ne kadar iterse o kadar hızlı
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

    if (ws && ws.readyState === WebSocket.OPEN) {
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
    op.mesh.position.lerp(new THREE.Vector3(op.targetPos.x, 0, op.targetPos.z), 0.25);
    op.mesh.rotation.y = op.targetRotY;
  }

  renderer.render(scene, camera);
}
updateAmmoHUD();
animate();
