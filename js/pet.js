const FRAME_DIR = "assets/miku/";
const PIXEL = 128;
const TARGET_H = 60;

const ACTIONS = {
  stand:   { frames: [1] },
  walk:    { frames: [1, 2, 3, 2], interval: 175 },
  sit:     { frames: [11], interval: 300 },
  trip:    { frames: [18, 19, 19], interval: 250 },
  think:   { frames: [27, 28], interval: 500 },
  dance:   { frames: [5, 6, 1], interval: 200 },
  drag:    { frames: [7, 5, 8, 6], interval: 210 },
  falling: { frames: [10, 18], interval: 200 },
};

export class PocketPet {
  constructor() {
    this.el = null;
    this.x = 0;
    this.y = 0;
    this.vx = 0;
    this.vy = 0;
    this.w = 60;
    this.h = 60;
    this.targetX = 180;
    this.face = 1;
    this.walking = false;
    this.grabbed = false;
    this.grabDX = 0;
    this.grabDY = 0;
    this.mouseX = 0;
    this.mouseY = 0;
    this.throwVX = 0;
    this.throwVY = 0;
    this.cursorHistory = [];
    this.walkTimer = 0;
    this.flavor = "stand";
    this.flavorT = 0;
    this.action = "falling";
    this.animI = 0;
    this.animT = 0;
    this.frameNum = 0;
    this.lastT = 0;
    this.imgs = {};
    this.boxes = {};
  }

  img(n) {
    if (!this.imgs[n]) {
      const i = new Image();
      i.decoding = "async";
      i.src = FRAME_DIR + "shime" + n + ".png";
      this.imgs[n] = i;
    }
    return this.imgs[n];
  }

  boxOf(n) {
    if (this.boxes[n] !== undefined) return this.boxes[n];
    const img = this.img(n);
    if (!img.complete || !img.naturalWidth) return null;
    try {
      const c = document.createElement("canvas");
      c.width = PIXEL;
      c.height = PIXEL;
      const g = c.getContext("2d", { willReadFrequently: true });
      g.drawImage(img, 0, 0);
      const d = g.getImageData(0, 0, PIXEL, PIXEL).data;
      let minX = PIXEL, maxX = -1, minY = PIXEL, maxY = -1;
      for (let y = 0; y < PIXEL; y++) {
        for (let x = 0; x < PIXEL; x++) {
          if (d[(y * PIXEL + x) * 4 + 3] > 8) {
            if (x < minX) minX = x;
            if (x > maxX) maxX = x;
            if (y < minY) minY = y;
            if (y > maxY) maxY = y;
          }
        }
      }
      const box = (maxX < minX) ? { x: 0, y: 0, w: PIXEL, h: PIXEL } : { x: minX, y: minY, w: maxX - minX + 1, h: maxY - minY + 1 };
      this.boxes[n] = box;
      return box;
    } catch (e) {
      this.boxes[n] = { x: 0, y: 0, w: PIXEL, h: PIXEL };
      return this.boxes[n];
    }
  }

  setFrame(n) {
    if (this.frameNum === n && this._frameReady) return;
    const img = this.img(n);
    if (!img.complete || !img.naturalWidth) {
      img.onload = () => this.setFrame(n);
      return;
    }
    this.frameNum = n;
    const box = this.boxOf(n);
    if (!box) {
      img.onload = () => this.setFrame(n);
      return;
    }
    const scale = TARGET_H / box.h;
    this.w = Math.max(4, Math.round(box.w * scale));
    this.h = Math.max(4, Math.round(box.h * scale));
    const s = PIXEL * scale;
    this.el.style.width = this.w + "px";
    this.el.style.height = this.h + "px";
    this.el.style.backgroundImage = 'url("' + FRAME_DIR + "shime" + n + '.png")';
    this.el.style.backgroundSize = s + "px " + s + "px";
    this.el.style.backgroundPosition = Math.round(-box.x * scale) + "px " + Math.round(-box.y * scale) + "px";
    this._frameReady = true;
  }

  async init() {
    this.el = document.createElement("div");
    this.el.className = "pocket-pet";
    document.body.appendChild(this.el);

    const first = this.img(1);
    await first.decode().catch(() => {});
    await new Promise((res) => {
      if (first.complete) res();
      else first.onload = res;
    });
    this.setFrame(1);

    const vw = window.innerWidth;
    this.x = vw / 2;
    this.y = this.wallY();
    this.targetX = this.x;
    this.apply();

    window.addEventListener("mousemove", (e) => this.onMove(e));
    window.addEventListener("mousedown", (e) => this.onDown(e));
    window.addEventListener("mouseup", () => this.onUp());
    window.addEventListener("touchstart", (e) => this.onDown(e.touches[0]), { passive: false });
    window.addEventListener("touchmove", (e) => {
      e.preventDefault();
      this.onMove(e.touches[0]);
    }, { passive: false });
    window.addEventListener("touchend", () => this.onUp());

    window.addEventListener("resize", () => {
      const wy = this.wallY();
      if (this.y > wy) this.y = wy;
      if (this.x < this.w / 2) this.x = this.w / 2;
      if (this.x > window.innerWidth - this.w / 2) this.x = window.innerWidth - this.w / 2;
    });

    this.lastT = performance.now();
    requestAnimationFrame((t) => this.animate(t));
  }

  wallY() {
    const footer = document.querySelector("footer");
    if (footer) return footer.getBoundingClientRect().top;
    return window.innerHeight - 10;
  }

  setVisible(v) {
    if (this.el) this.el.style.display = v ? "block" : "none";
  }

  onMove(e) {
    this.mouseX = e.clientX;
    this.mouseY = e.clientY;
    if (this.grabbed) {
      this.x = this.mouseX + this.grabDX + this.w / 2;
      this.y = this.mouseY + this.grabDY + this.h;
      this.cursorHistory.push({ x: this.mouseX, y: this.mouseY, t: performance.now() });
      if (this.cursorHistory.length > 5) this.cursorHistory.shift();
      this.apply();
    }
  }

  onDown(e) {
    const r = this.el.getBoundingClientRect();
    if (
      e.clientX >= r.left && e.clientX <= r.right &&
      e.clientY >= r.top && e.clientY <= r.bottom
    ) {
      e.preventDefault();
      this.grabbed = true;
      this.grabDX = r.left - e.clientX;
      this.grabDY = r.top - e.clientY;
      this.vx = 0;
      this.vy = 0;
      this.walking = false;
      this.cursorHistory = [];
      this.el.classList.add("grabbed");
      document.body.classList.add("pet-grabbing");
      this.apply();
    }
  }

  onUp() {
    if (!this.grabbed) return;
    this.grabbed = false;
    this.el.classList.remove("grabbed");
    document.body.classList.remove("pet-grabbing");
    if (this.cursorHistory.length >= 2) {
      const a = this.cursorHistory[0];
      const b = this.cursorHistory[this.cursorHistory.length - 1];
      const dt = (b.t - a.t) / 1000;
      if (dt > 0.03) {
        this.throwVX = (b.x - a.x) / dt;
        this.throwVY = (b.y - a.y) / dt;
      }
    }
  }

  animate(t) {
    const dt = Math.min(0.05, (t - this.lastT) / 1000 || 0.016);
    this.lastT = t;

    if (this.grabbed) {
      this.apply();
    } else {
      this.physics(dt);
      this.behavior(dt);
    }
    this.render(dt);
    requestAnimationFrame((tt) => this.animate(tt));
  }

  physics(dt) {
    const wy = this.wallY();
    const maxVX = 900;
    const maxVY = 7000;

    this.vy += 6000 * dt;

    if (Math.abs(this.vy) < 1 && Math.abs(this.y - wy) < 12) {
      this.vx *= Math.pow(0.0006, dt * 60);
      if (Math.abs(this.vx) < 1) this.vx = 0;
    }

    if (!this.walking && !this.grabbed) {
      this.targetX = Math.max(this.w / 2, Math.min(window.innerWidth - this.w / 2, this.targetX));
      this.vx += (this.targetX - this.x) * 2 * dt;
      if (this.targetX - this.x > 20) this.face = 1;
      else if (this.targetX - this.x < -20) this.face = -1;
    }

    this.x += this.vx * dt;
    this.y += this.vy * dt;

    if (this.vx > maxVX) this.vx = maxVX;
    if (this.vx < -maxVX) this.vx = -maxVX;
    if (this.vy > maxVY) this.vy = maxVY;
    if (this.vy < -maxVY) this.vy = -maxVY;

    const left = this.w / 2;
    const right = window.innerWidth - this.w / 2;
    if (this.x < left) { this.x = left; this.vx = Math.abs(this.vx) * 0.5 * (this.vx < 0 ? -1 : 1); if (Math.abs(this.vx) < 30) this.vx = 0; }
    if (this.x > right) { this.x = right; this.vx = -Math.abs(this.vx) * 0.5; if (Math.abs(this.vx) < 30) this.vx = 0; }
    if (this.y < 0) { this.y = 0; this.vy = Math.abs(this.vy) * 0.3; }
    if (this.y > wy) {
      this.y = wy;
      const bounce = this.vy > 0 ? this.vy : 0;
      this.vy = -bounce * 0.4;
      if (Math.abs(bounce) < 250) this.vy = 0;
    }
  }

  behavior(dt) {
    const wy = this.wallY();
    const onGround = Math.abs(this.y - wy) < 4;

    if (Math.abs(this.throwVX) > 4 || Math.abs(this.throwVY) > 4) {
      this.vx = this.throwVX;
      this.vy = this.throwVY;
      this.throwVX *= Math.pow(0.6, dt);
      this.throwVY *= Math.pow(0.6, dt);
    }

    if (this.walking) {
      this.vx = this.face * 42;
      this.walkTimer -= dt;
      if (this.flavorT > 0) this.flavorT -= dt;
      if (this.flavorT <= 0 && Math.random() < dt * 1.2) {
        this.flavor = "trip";
        this.flavorT = 0.8 + Math.random() * 0.6;
        this.walkTimer = Math.max(this.walkTimer, this.flavorT + 0.1);
        this.vx = 0;
      }
      if (this.walkTimer <= 0 || (onGround && Math.abs(this.vx) < 5)) {
        this.walking = false;
        this.vx = 0;
        this.flavor = this.idleFlavor();
        this.flavorT = 2 + Math.random() * 3;
      }
    } else if (onGround) {
      this.walkTimer -= dt;
      if (this.flavorT > 0) this.flavorT -= dt;
      else if (Math.random() < dt * 0.4) {
        this.walking = true;
        this.face = this.face * (Math.random() < 0.5 ? -1 : 1);
        this.aimNewSpot();
        this.walkTimer = 2 + Math.random() * 3;
      }
    }
  }

  idleFlavor() {
    const r = Math.random();
    if (r < 0.55) return "stand";
    if (r < 0.72) return "think";
    if (r < 0.86) return "dance";
    return "sit";
  }

  aimNewSpot() {
    let target = this.x + this.face * (120 + Math.random() * 260);
    const maxX = window.innerWidth - this.w / 2;
    const minX = this.w / 2;
    if (target > maxX) target = maxX;
    if (target < minX) target = minX;
    this.targetX = target;
  }

  resolveAction() {
    if (this.grabbed) return "drag";
    const onGround = this.y >= this.wallY() - 4;
    if (!onGround) return "falling";
    if (this.walking) return this.flavor === "trip" ? "trip" : "walk";
    return this.flavor === "trip" ? "stand" : this.flavor;
  }

  render(dt) {
    const action = this.resolveAction();
    if (action !== this.action) {
      this.action = action;
      this.animI = 0;
      this.animT = 0;
    }
    const frames = ACTIONS[this.action].frames;
    const interval = ACTIONS[this.action].interval || 250;
    this.animT += dt * 1000;
    if (this.animT >= interval) {
      this.animT -= interval;
      this.animI = (this.animI + 1) % frames.length;
    }
    this.setFrame(frames[this.animI]);
    this.apply();
  }

  apply() {
    this.el.style.left = Math.round(this.x - this.w / 2) + "px";
    this.el.style.top = Math.round(this.y - this.h) + "px";
    this.el.style.transform = `scaleX(${this.face})`;
  }
}