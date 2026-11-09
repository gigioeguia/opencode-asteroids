'use strict';

const canvas = document.getElementById('canvas');
const ctx = canvas.getContext('2d');
const W = 800;
const H = 600;

// ── Input ─────────────────────────────────────────────────────────────────────
const keys = {};
const justPressed = {};

window.addEventListener('keydown', e => {
  justPressed[e.code] = !keys[e.code];
  keys[e.code] = true;
  if (['Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.code))
    e.preventDefault();
});
window.addEventListener('keyup', e => { keys[e.code] = false; });

function pressed(code) {
  const val = justPressed[code];
  justPressed[code] = false;
  return val;
}

// ── Utils ─────────────────────────────────────────────────────────────────────
const wrap  = (v, max) => ((v % max) + max) % max;
const dist  = (a, b)   => Math.hypot(a.x - b.x, a.y - b.y);
const rand  = (min, max) => min + Math.random() * (max - min);
const randInt = (min, max) => Math.floor(rand(min, max + 1));

// ── Bullet ────────────────────────────────────────────────────────────────────
class Bullet {
  constructor(x, y, angle) {
    this.x = x;
    this.y = y;
    const SPEED = 520;
    this.vx = Math.cos(angle) * SPEED;
    this.vy = Math.sin(angle) * SPEED;
    this.ttl  = 1.1;
    this.radius = 2;
    this.dead = false;
  }

  update(dt) {
    this.x = wrap(this.x + this.vx * dt, W);
    this.y = wrap(this.y + this.vy * dt, H);
    this.ttl -= dt;
    if (this.ttl <= 0) this.dead = true;
  }

  draw() {
    ctx.fillStyle = '#fff';
    ctx.beginPath();
    ctx.arc(this.x, this.y, this.radius, 0, Math.PI * 2);
    ctx.fill();
  }
}

// ── Bala enemiga ──────────────────────────────────────────────────────────────
const ENEMY_BULLET_SPEED = 280;  // px/s — más lenta que la del jugador
const ENEMY_BULLET_TTL   = 2.5;  // s de vida

class EnemyBullet {
  constructor(x, y, angle) {
    this.x = x;
    this.y = y;
    this.vx = Math.cos(angle) * ENEMY_BULLET_SPEED;
    this.vy = Math.sin(angle) * ENEMY_BULLET_SPEED;
    this.ttl    = ENEMY_BULLET_TTL;
    this.radius = 3;
    this.dead   = false;
  }

  update(dt) {
    this.x = wrap(this.x + this.vx * dt, W);
    this.y = wrap(this.y + this.vy * dt, H);
    this.ttl -= dt;
    if (this.ttl <= 0) this.dead = true;
  }

  draw() {
    ctx.fillStyle = '#ff5a5a';
    ctx.beginPath();
    ctx.arc(this.x, this.y, this.radius, 0, Math.PI * 2);
    ctx.fill();
  }
}

// ── Asteroid ──────────────────────────────────────────────────────────────────
const RADII  = [0, 16, 30, 50];   // por tamaño 1, 2, 3
const SPEEDS = [0, 85, 55, 32];   // velocidad base por tamaño
const POINTS = [0, 100, 50, 20];  // puntos por tamaño

class Asteroid {
  constructor(x, y, size = 3) {
    this.x    = x;
    this.y    = y;
    this.size = size;
    this.radius = RADII[size];
    this.dead = false;

    const angle = rand(0, Math.PI * 2);
    const speed = SPEEDS[size] + rand(-15, 15);
    this.vx = Math.cos(angle) * speed;
    this.vy = Math.sin(angle) * speed;
    this.rotSpeed = rand(-1.2, 1.2);
    this.rot = rand(0, Math.PI * 2);

    // Polígono irregular
    const n = randInt(8, 13);
    this.verts = [];
    for (let i = 0; i < n; i++) {
      const a = (i / n) * Math.PI * 2;
      const r = this.radius * rand(0.6, 1.0);
      this.verts.push([Math.cos(a) * r, Math.sin(a) * r]);
    }
  }

  update(dt) {
    this.x   = wrap(this.x + this.vx * dt, W);
    this.y   = wrap(this.y + this.vy * dt, H);
    this.rot += this.rotSpeed * dt;
  }

  split() {
    if (this.size <= 1) return [];
    return [
      new Asteroid(this.x, this.y, this.size - 1),
      new Asteroid(this.x, this.y, this.size - 1),
    ];
  }

  draw() {
    ctx.save();
    ctx.translate(this.x, this.y);
    ctx.rotate(this.rot);
    ctx.strokeStyle = '#fff';
    ctx.lineWidth   = 1.5;
    ctx.lineJoin    = 'round';
    ctx.beginPath();
    ctx.moveTo(this.verts[0][0], this.verts[0][1]);
    for (let i = 1; i < this.verts.length; i++)
      ctx.lineTo(this.verts[i][0], this.verts[i][1]);
    ctx.closePath();
    ctx.stroke();
    ctx.restore();
  }
}

// ── Estrella fugaz (asteroide especial) ───────────────────────────────────────
const STAR_SPEED_MIN = 160;  // px/s — mucho más rápida que los asteroides
const STAR_SPEED_MAX = 220;
const STAR_TTL_MIN   = 6;    // s en pantalla antes de desaparecer sola
const STAR_TTL_MAX   = 9;

class ShootingStar extends Asteroid {
  constructor(x, y) {
    super(x, y, 2);

    // Vértices de estrella de 5 puntas (radio alterno)
    this.verts = [];
    for (let i = 0; i < 10; i++) {
      const a = (i / 10) * Math.PI * 2 - Math.PI / 2;
      const r = i % 2 === 0 ? this.radius : this.radius * 0.45;
      this.verts.push([Math.cos(a) * r, Math.sin(a) * r]);
    }

    // Trayectoria recta y veloz
    const angle = rand(0, Math.PI * 2);
    const speed = rand(STAR_SPEED_MIN, STAR_SPEED_MAX);
    this.vx = Math.cos(angle) * speed;
    this.vy = Math.sin(angle) * speed;

    this.rotSpeed = rand(3, 5) * (Math.random() < 0.5 ? -1 : 1);
    this.ttl = rand(STAR_TTL_MIN, STAR_TTL_MAX);
  }

  update(dt) {
    super.update(dt);
    this.ttl -= dt;
    if (this.ttl <= 0) this.dead = true;

    // Estela de chispas en dirección contraria al movimiento
    const back = Math.atan2(-this.vy, -this.vx);
    particles.push(new Particle(this.x, this.y, back + rand(-0.3, 0.3), rand(20, 60)));
  }

  draw() {
    // Parpadeo antes de desaparecer
    if (this.ttl < 2 && Math.floor(this.ttl * 8) % 2 === 0) return;

    ctx.save();
    ctx.translate(this.x, this.y);
    ctx.rotate(this.rot);
    ctx.strokeStyle = '#ffe9a8';
    ctx.lineWidth   = 1.5;
    ctx.lineJoin    = 'round';
    ctx.beginPath();
    ctx.moveTo(this.verts[0][0], this.verts[0][1]);
    for (let i = 1; i < this.verts.length; i++)
      ctx.lineTo(this.verts[i][0], this.verts[i][1]);
    ctx.closePath();
    ctx.stroke();
    ctx.restore();
  }
}

// ── OVNI (enemigo) ────────────────────────────────────────────────────────────
const UFO_SPEED      = 90;    // px/s
const UFO_POINTS     = 200;
const UFO_TTL_MIN    = 12;    // s en pantalla antes de irse solo
const UFO_TTL_MAX    = 15;
const UFO_FIRE_EVERY = 1.2;   // s entre disparos

class Ufo {
  constructor(x, y) {
    this.x = x;
    this.y = y;
    this.radius = 14;
    this.ttl     = rand(UFO_TTL_MIN, UFO_TTL_MAX);
    this.t       = 0;
    this.fireCooldown = 0.5;
    this.dead    = false;
    this.changeDirection();
  }

  // Zigzag: rumbo aleatorio cada cierto tiempo
  changeDirection() {
    const angle = rand(0, Math.PI * 2);
    this.vx = Math.cos(angle) * UFO_SPEED;
    this.vy = Math.sin(angle) * UFO_SPEED;
    this.dirTimer = rand(0.8, 1.6);
  }

  update(dt) {
    this.t   += dt;
    this.ttl -= dt;
    if (this.ttl <= 0) this.dead = true;

    this.dirTimer -= dt;
    if (this.dirTimer <= 0) this.changeDirection();

    this.x = wrap(this.x + this.vx * dt, W);
    this.y = wrap(this.y + this.vy * dt, H);

    // Dispara hacia la nave mientras esté viva
    if (!ship.dead) {
      this.fireCooldown -= dt;
      if (this.fireCooldown <= 0) {
        this.fireCooldown = UFO_FIRE_EVERY;
        const angle = Math.atan2(ship.y - this.y, ship.x - this.x) + rand(-0.15, 0.15);
        enemyBullets.push(new EnemyBullet(this.x, this.y, angle));
      }
    }
  }

  draw() {
    // Parpadeo antes de irse
    if (this.ttl < 2 && Math.floor(this.ttl * 8) % 2 === 0) return;

    ctx.save();
    ctx.translate(this.x, this.y);
    ctx.strokeStyle = '#7dff7d';
    ctx.lineWidth   = 1.5;
    ctx.lineJoin    = 'round';

    // Platillo
    ctx.beginPath();
    ctx.ellipse(0, 3, 16, 6, 0, 0, Math.PI * 2);
    ctx.stroke();

    // Cúpula
    ctx.beginPath();
    ctx.arc(0, 0, 7, Math.PI, 0);
    ctx.stroke();

    // Luz que recorre el borde del platillo
    const on = Math.floor(this.t * 6) % 3;
    ctx.fillStyle = '#7dff7d';
    ctx.beginPath();
    ctx.arc(-10 + on * 10, 8, 1.5, 0, Math.PI * 2);
    ctx.fill();

    ctx.restore();
  }
}

// ── Ship ──────────────────────────────────────────────────────────────────────
class Ship {
  constructor() { this.reset(); }

  reset() {
    this.x      = W / 2;
    this.y      = H / 2;
    this.angle  = -Math.PI / 2;
    this.vx     = 0;
    this.vy     = 0;
    this.radius = 12;
    this.thrusting     = false;
    this.invincible    = 3;
    this.shootCooldown = 0;
    this.speedBoost    = 0;
    this.shield        = 0;
    this.dead          = false;
  }

  update(dt) {
    if (this.dead) return;
    if (this.invincible    > 0) this.invincible    -= dt;
    if (this.shootCooldown > 0) this.shootCooldown -= dt;
    if (this.speedBoost    > 0) this.speedBoost    -= dt;
    if (this.shield        > 0) this.shield        -= dt;

    const ROT   = 3.5;   // rad/s
    // Propulsión duplicada mientras dura el power-up de velocidad
    const THRUST = this.speedBoost > 0 ? 520 : 260;  // px/s²
    const DRAG   = 0.987;

    if (keys['ArrowLeft'])  this.angle -= ROT * dt;
    if (keys['ArrowRight']) this.angle += ROT * dt;

    this.thrusting = !!keys['ArrowUp'];
    if (this.thrusting) {
      this.vx += Math.cos(this.angle) * THRUST * dt;
      this.vy += Math.sin(this.angle) * THRUST * dt;
    }

    this.vx *= DRAG;
    this.vy *= DRAG;
    this.x = wrap(this.x + this.vx * dt, W);
    this.y = wrap(this.y + this.vy * dt, H);
  }

  tryShoot() {
    if (this.shootCooldown > 0 || this.dead) return [];
    this.shootCooldown = 0.2;
    const NOSE = 21;
    const ox = this.x + Math.cos(this.angle) * NOSE;
    const oy = this.y + Math.sin(this.angle) * NOSE;
    return [new Bullet(ox, oy, this.angle)];
  }

  draw() {
    if (this.dead) return;
    // Parpadeo durante invencibilidad de reaparición
    if (this.invincible > 0 && Math.floor(this.invincible * 8) % 2 === 0) return;

    ctx.save();
    ctx.translate(this.x, this.y);
    ctx.rotate(this.angle);
    ctx.strokeStyle = '#fff';
    ctx.lineWidth   = 1.5;
    ctx.lineJoin    = 'round';

    // Silueta clásica: triángulo con muesca trasera
    ctx.beginPath();
    ctx.moveTo( 20,  0);   // nariz
    ctx.lineTo(-12, -9);   // ala izquierda
    ctx.lineTo( -7,  0);   // muesca trasera
    ctx.lineTo(-12,  9);   // ala derecha
    ctx.closePath();
    ctx.stroke();

    // Llama del propulsor (más larga y cian con boost activo)
    if (this.thrusting && Math.random() > 0.35) {
      const boosted = this.speedBoost > 0;
      ctx.beginPath();
      ctx.moveTo(-8, -4);
      ctx.lineTo(-8 - rand(6, boosted ? 20 : 14), 0);
      ctx.lineTo(-8, 4);
      ctx.strokeStyle = boosted ? 'rgba(0, 220, 255, 0.9)' : 'rgba(255, 130, 0, 0.85)';
      ctx.stroke();
    }

    ctx.restore();
    this.drawShield();
  }

  // Burbuja de escudo (power-up): círculo cian pulsante alrededor de la nave
  drawShield() {
    if (this.shield <= 0) return;
    // Parpadeo antes de expirar
    if (this.shield < 2 && Math.floor(this.shield * 8) % 2 === 0) return;

    const alpha = 0.4 + 0.25 * Math.sin(this.shield * 6);
    ctx.strokeStyle = `rgba(77, 216, 255, ${alpha.toFixed(2)})`;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(this.x, this.y, SHIELD_RADIUS, 0, Math.PI * 2);
    ctx.stroke();
  }
}

// ── Partículas (explosión) ────────────────────────────────────────────────────
class Particle {
  constructor(x, y, angle = rand(0, Math.PI * 2), speed = rand(30, 130)) {
    this.x  = x;
    this.y  = y;
    this.vx   = Math.cos(angle) * speed;
    this.vy   = Math.sin(angle) * speed;
    this.life = rand(0.4, 1.1);
    this.ttl  = this.life;
    this.dead = false;
  }

  update(dt) {
    this.x  += this.vx * dt;
    this.y  += this.vy * dt;
    this.ttl -= dt;
    if (this.ttl <= 0) this.dead = true;
  }

  draw() {
    const alpha = this.ttl / this.life;
    ctx.strokeStyle = `rgba(255,255,255,${alpha.toFixed(2)})`;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(this.x, this.y);
    ctx.lineTo(this.x - this.vx * 0.05, this.y - this.vy * 0.05);
    ctx.stroke();
  }
}

// ── Power-ups (Velocidad y Escudo) ────────────────────────────────────────────
const BOOST_DURATION  = 5;   // s de efecto al recogerlo
const SHIELD_DURATION = 5;   // s de escudo al recogerlo
const SHIELD_RADIUS   = 24;  // px de radio de la burbuja
const POWERUP_TTL     = 10;  // s en pantalla antes de expirar
const POWERUP_TYPES   = ['boost', 'shield'];

class PowerUp {
  constructor(x, y, type = 'boost') {
    this.type = type;
    this.x = x;
    this.y = y;
    this.radius = 12;
    this.ttl = POWERUP_TTL;
    this.t = 0;
    this.dead = false;

    const angle = rand(0, Math.PI * 2);
    const speed = rand(20, 50);
    this.vx = Math.cos(angle) * speed;
    this.vy = Math.sin(angle) * speed;
  }

  update(dt) {
    this.x = wrap(this.x + this.vx * dt, W);
    this.y = wrap(this.y + this.vy * dt, H);
    this.t   += dt;
    this.ttl -= dt;
    if (this.ttl <= 0) this.dead = true;
  }

  draw() {
    // Parpadeo antes de expirar
    if (this.ttl < 3 && Math.floor(this.ttl * 8) % 2 === 0) return;

    const pulse = 1 + 0.12 * Math.sin(this.t * 5);
    ctx.save();
    ctx.translate(this.x, this.y);
    ctx.scale(pulse, pulse);
    ctx.strokeStyle = this.type === 'shield' ? '#4dd8ff' : '#ffd24a';
    ctx.lineWidth   = 1.5;
    ctx.lineJoin    = 'round';

    if (this.type === 'shield') {
      // Contorno de escudo
      ctx.beginPath();
      ctx.moveTo( 0, -10);
      ctx.lineTo( 8,  -6);
      ctx.lineTo( 8,   2);
      ctx.lineTo( 0,  10);
      ctx.lineTo(-8,   2);
      ctx.lineTo(-8,  -6);
      ctx.closePath();
      ctx.stroke();
    } else {
      // Rayo
      ctx.beginPath();
      ctx.moveTo( 2, -10);
      ctx.lineTo(-4,   2);
      ctx.lineTo( 0,   2);
      ctx.lineTo(-2,  10);
      ctx.lineTo( 4,  -2);
      ctx.lineTo( 0,  -2);
      ctx.closePath();
      ctx.stroke();
    }
    ctx.restore();
  }
}

// ── Estado del juego ──────────────────────────────────────────────────────────
let ship, bullets, asteroids, particles, powerUps;
let enemyBullets, ufo;
let score, lives, level;
let state;      // 'playing' | 'dead' | 'gameover'
let deadTimer;
let powerUpTimer;
let starTimer;
let ufoTimer;

function spawnAsteroids(count) {
  const SAFE_DIST = 130;
  for (let i = 0; i < count; i++) {
    let x, y;
    do {
      x = rand(0, W);
      y = rand(0, H);
    } while (Math.hypot(x - W / 2, y - H / 2) < SAFE_DIST);
    asteroids.push(new Asteroid(x, y, 3));
  }
}

function posAwayFromShip(minDist) {
  let x, y;
  do {
    x = rand(0, W);
    y = rand(0, H);
  } while (Math.hypot(x - ship.x, y - ship.y) < minDist);
  return { x, y };
}

function spawnPowerUp() {
  const { x, y } = posAwayFromShip(120);
  powerUps.push(new PowerUp(x, y, POWERUP_TYPES[randInt(0, POWERUP_TYPES.length - 1)]));
  powerUpTimer = rand(12, 15);
}

function spawnUfo() {
  const { x, y } = posAwayFromShip(120);
  ufo = new Ufo(x, y);
}

// Mueve OVNI y balas enemigas; el OVNI no dispara si la nave está muerta
function updateEnemies(dt) {
  if (ufo) ufo.update(dt);
  if (ufo && ufo.dead) ufo = null;
  enemyBullets.forEach(b => b.update(dt));
  enemyBullets = enemyBullets.filter(b => !b.dead);
}

function spawnShootingStar() {
  const { x, y } = posAwayFromShip(120);
  asteroids.push(new ShootingStar(x, y));
  starTimer = rand(10, 18);
}

function initGame() {
  ship          = new Ship();
  bullets       = [];
  asteroids     = [];
  particles     = [];
  powerUps      = [];
  enemyBullets  = [];
  ufo           = null;
  score  = 0;
  lives  = 3;
  level  = 1;
  state  = 'playing';
  powerUpTimer = rand(12, 15);
  starTimer    = rand(10, 18);
  ufoTimer     = rand(15, 25);
  spawnAsteroids(4);
}

function nextLevel() {
  level++;
  bullets      = [];
  particles    = [];
  powerUps     = [];
  enemyBullets = [];
  ufo          = null;
  powerUpTimer = rand(12, 15);
  starTimer    = rand(10, 18);
  ufoTimer     = rand(15, 25);
  ship.reset();
  spawnAsteroids(3 + level);
}

function explode(x, y, count = 8) {
  for (let i = 0; i < count; i++) particles.push(new Particle(x, y));
}

function killShip() {
  explode(ship.x, ship.y, 14);
  ship.dead = true;
  lives--;
  if (lives <= 0) {
    state = 'gameover';
  } else {
    state     = 'dead';
    deadTimer = 2;
  }
}

// ── Update ────────────────────────────────────────────────────────────────────
function update(dt) {
  if (state === 'gameover') {
    if (pressed('Space')) initGame();
    particles.forEach(p => p.update(dt));
    particles = particles.filter(p => !p.dead);
    return;
  }

  if (state === 'dead') {
    deadTimer -= dt;
    particles.forEach(p => p.update(dt));
    particles = particles.filter(p => !p.dead);
    asteroids.forEach(a => a.update(dt));
    updateEnemies(dt);
    if (deadTimer <= 0) { state = 'playing'; ship.reset(); }
    return;
  }

  // Disparar
  if (pressed('Space')) {
    bullets.push(...ship.tryShoot());
  }

  // Apariciones periódicas: power-up, estrella fugaz y OVNI
  powerUpTimer -= dt;
  if (powerUpTimer <= 0)
    spawnPowerUp();

  starTimer -= dt;
  if (starTimer <= 0)
    spawnShootingStar();

  ufoTimer -= dt;
  if (ufoTimer <= 0) {
    ufoTimer = rand(15, 25);
    if (!ufo) spawnUfo();
  }

  ship.update(dt);
  bullets.forEach(b => b.update(dt));
  asteroids.forEach(a => a.update(dt));
  particles.forEach(p => p.update(dt));
  powerUps.forEach(p => p.update(dt));
  updateEnemies(dt);

  // Nave recoge el power-up (velocidad o escudo)
  for (const p of powerUps) {
    if (dist(ship, p) < ship.radius + p.radius) {
      p.dead = true;
      // Reinician el temporizador, no acumulan
      if (p.type === 'shield') ship.shield     = SHIELD_DURATION;
      else                     ship.speedBoost = BOOST_DURATION;
      break;
    }
  }

  // Estela de chispas durante el boost
  if (ship.speedBoost > 0) {
    const tx = ship.x - Math.cos(ship.angle) * 14;
    const ty = ship.y - Math.sin(ship.angle) * 14;
    particles.push(new Particle(tx, ty, ship.angle + Math.PI + rand(-0.4, 0.4), rand(40, 90)));
  }

  bullets   = bullets.filter(b => !b.dead);
  particles = particles.filter(p => !p.dead);
  powerUps  = powerUps.filter(p => !p.dead);

  // Bala vs asteroide
  const newAsteroids = [];
  for (const b of bullets) {
    for (const a of asteroids) {
      if (!a.dead && !b.dead && dist(b, a) < a.radius) {
        b.dead = true;
        a.dead = true;
        score += POINTS[a.size];
        explode(a.x, a.y, a.size * 5);
        newAsteroids.push(...a.split());
      }
    }
  }
  asteroids = asteroids.filter(a => !a.dead).concat(newAsteroids);
  bullets   = bullets.filter(b => !b.dead);

  // Bala del jugador vs OVNI
  if (ufo) {
    for (const b of bullets) {
      if (!b.dead && dist(b, ufo) < ufo.radius) {
        b.dead = true;
        ufo.dead = true;
        score += UFO_POINTS;
        explode(ufo.x, ufo.y, 12);
        break;
      }
    }
    bullets = bullets.filter(b => !b.dead);
  }

  // Bala enemiga vs nave (el escudo la destruye)
  if (!ship.dead && ship.invincible <= 0) {
    for (const b of enemyBullets) {
      if (b.dead) continue;
      if (ship.shield > 0 && dist(ship, b) < SHIELD_RADIUS) {
        b.dead = true;
        explode(b.x, b.y, 3);
      } else if (dist(ship, b) < ship.radius + b.radius) {
        killShip();
        break;
      }
    }
  }

  // Nave vs OVNI (el escudo lo destruye)
  if (ufo && !ship.dead && ship.invincible <= 0) {
    if (ship.shield > 0) {
      if (dist(ship, ufo) < SHIELD_RADIUS + ufo.radius) {
        ufo.dead = true;
        score += UFO_POINTS;
        explode(ufo.x, ufo.y, 12);
      }
    } else if (dist(ship, ufo) < ship.radius + ufo.radius * 0.8) {
      killShip();
    }
  }

  // Nave vs asteroide (el escudo lo destruye)
  if (!ship.dead && ship.invincible <= 0) {
    const fragments = [];
    for (const a of asteroids) {
      if (ship.shield > 0) {
        if (dist(ship, a) < SHIELD_RADIUS + a.radius * 0.8) {
          a.dead = true;
          score += POINTS[a.size];
          explode(a.x, a.y, a.size * 5);
          fragments.push(...a.split());
        }
      } else if (dist(ship, a) < ship.radius + a.radius * 0.82) {
        killShip();
        break;
      }
    }
    asteroids = asteroids.filter(a => !a.dead).concat(fragments);
  }

  // Limpieza tras colisiones
  if (ufo && ufo.dead) ufo = null;
  enemyBullets = enemyBullets.filter(b => !b.dead);

  // Nivel completado
  if (asteroids.length === 0 && state === 'playing') nextLevel();
}

// ── Draw ──────────────────────────────────────────────────────────────────────
function drawLifeIcon(x, y) {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(-Math.PI / 2);
  ctx.strokeStyle = '#fff';
  ctx.lineWidth   = 1.2;
  ctx.lineJoin    = 'round';
  ctx.beginPath();
  ctx.moveTo( 9,  0);
  ctx.lineTo(-6, -5);
  ctx.lineTo(-3,  0);
  ctx.lineTo(-6,  5);
  ctx.closePath();
  ctx.stroke();
  ctx.restore();
}

function drawHUD() {
  ctx.fillStyle = '#fff';
  ctx.font = '15px monospace';

  ctx.textAlign = 'left';
  ctx.fillText(`SCORE  ${score}`, 14, 26);

  ctx.textAlign = 'center';
  ctx.fillText(`NIVEL ${level}`, W / 2, 26);

  for (let i = 0; i < lives; i++)
    drawLifeIcon(W - 16 - i * 22, 18);

  // Contadores de power-ups activos (velocidad y escudo)
  const activeTimers = [];
  if (!ship.dead) {
    if (ship.speedBoost > 0)
      activeTimers.push([`VELOCIDAD x2  ${ship.speedBoost.toFixed(1)}s`, '#ffd24a']);
    if (ship.shield > 0)
      activeTimers.push([`ESCUDO  ${ship.shield.toFixed(1)}s`, '#4dd8ff']);
  }
  activeTimers.forEach(([text, color], i) => {
    ctx.textAlign = 'center';
    ctx.fillStyle = color;
    ctx.fillText(text, W / 2, H - 14 - i * 20);
  });
}

function drawOverlay(title, sub) {
  ctx.textAlign   = 'center';
  ctx.fillStyle   = '#fff';
  ctx.font        = 'bold 46px monospace';
  ctx.fillText(title, W / 2, H / 2 - 18);
  ctx.font        = '18px monospace';
  ctx.fillStyle   = 'rgba(255,255,255,0.65)';
  ctx.fillText(sub, W / 2, H / 2 + 22);
}

function draw() {
  ctx.fillStyle = '#000';
  ctx.fillRect(0, 0, W, H);

  particles.forEach(p => p.draw());
  asteroids.forEach(a => a.draw());
  powerUps.forEach(p => p.draw());
  if (ufo) ufo.draw();
  bullets.forEach(b => b.draw());
  enemyBullets.forEach(b => b.draw());
  ship.draw();

  drawHUD();

  if (state === 'gameover')
    drawOverlay('GAME OVER', `PUNTAJE: ${score}   —   ESPACIO PARA REINICIAR`);
}

// ── Loop principal ────────────────────────────────────────────────────────────
let lastTime = null;

function loop(ts) {
  const dt = lastTime === null ? 0 : Math.min((ts - lastTime) / 1000, 0.05);
  lastTime = ts;
  update(dt);
  draw();
  requestAnimationFrame(loop);
}

initGame();
requestAnimationFrame(loop);
