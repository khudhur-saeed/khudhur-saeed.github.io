/**
 * Main Application Script (High Performance Optimized)
 * 1. PullCord - Physics-driven Ceiling Pull-Cord Component (mortspace / FeralUI)
 * 2. LetterGlitch - Canvas Glitch Background (React Bits - Performance Optimized)
 * 3. ProfileCard - 3D Tilt Card with Holographic Sheen (React Bits - Idle Sleep Optimized)
 */

(function () {
  'use strict';

  /* =========================================================================
     ProfileCard Component (React Bits - Optimized with Idle Sleep)
     ========================================================================= */

  const clamp = (v, min = 0, max = 100) => Math.min(Math.max(v, min), max);
  const round = (v, precision = 3) => parseFloat(v.toFixed(precision));
  const adjust = (v, fMin, fMax, tMin, tMax) => round(tMin + ((tMax - tMin) * (v - fMin)) / (fMax - fMin));

  class ProfileCardComponent {
    constructor(wrapperEl, options = {}) {
      this.wrapper = wrapperEl;
      this.shell = wrapperEl.querySelector('.pc-card-shell');
      this.card = wrapperEl.querySelector('.pc-card');
      this.enableTilt = options.enableTilt !== false;
      this.reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

      if (!this.shell || !this.enableTilt || this.reduceMotion) return;

      this.running = false;
      this.lastTs = 0;
      this.currentX = 0;
      this.currentY = 0;
      this.targetX = 0;
      this.targetY = 0;
      this.initialUntil = 0;
      this.rafId = null;

      this.DEFAULT_TAU = 0.14;
      this.INITIAL_TAU = 0.6;

      this.init();
    }

    setVarsFromXY(x, y) {
      if (!this.shell || !this.wrapper) return;
      const width = this.shell.clientWidth || 1;
      const height = this.shell.clientHeight || 1;

      const percentX = clamp((100 / width) * x);
      const percentY = clamp((100 / height) * y);

      const centerX = percentX - 50;
      const centerY = percentY - 50;

      this.wrapper.style.setProperty('--pointer-x', `${percentX}%`);
      this.wrapper.style.setProperty('--pointer-y', `${percentY}%`);
      this.wrapper.style.setProperty('--background-x', `${adjust(percentX, 0, 100, 35, 65)}%`);
      this.wrapper.style.setProperty('--background-y', `${adjust(percentY, 0, 100, 35, 65)}%`);
      this.wrapper.style.setProperty('--pointer-from-center', `${clamp(Math.hypot(percentY - 50, percentX - 50) / 50, 0, 1)}`);
      this.wrapper.style.setProperty('--pointer-from-top', `${percentY / 100}`);
      this.wrapper.style.setProperty('--pointer-from-left', `${percentX / 100}`);
      this.wrapper.style.setProperty('--rotate-x', `${round(-(centerX / 6))}deg`);
      this.wrapper.style.setProperty('--rotate-y', `${round(centerY / 5)}deg`);
    }

    step(ts) {
      if (!this.running) return;
      if (this.lastTs === 0) this.lastTs = ts;
      const dt = Math.min(0.05, (ts - this.lastTs) / 1000);
      this.lastTs = ts;

      const tau = ts < this.initialUntil ? this.INITIAL_TAU : this.DEFAULT_TAU;
      const k = 1 - Math.exp(-dt / tau);

      this.currentX += (this.targetX - this.currentX) * k;
      this.currentY += (this.targetY - this.currentY) * k;

      this.setVarsFromXY(this.currentX, this.currentY);

      const stillFar = Math.abs(this.targetX - this.currentX) > 0.08 || Math.abs(this.targetY - this.currentY) > 0.08;

      // Critical optimization: Stop RAF loop completely when settled to free CPU/GPU
      if (stillFar) {
        this.rafId = requestAnimationFrame((t) => this.step(t));
      } else {
        this.running = false;
        this.lastTs = 0;
        this.rafId = null;
      }
    }

    start() {
      if (this.running) return;
      this.running = true;
      this.lastTs = 0;
      this.rafId = requestAnimationFrame((ts) => this.step(ts));
    }

    setTarget(x, y) {
      this.targetX = x;
      this.targetY = y;
      this.start();
    }

    toCenter() {
      if (!this.shell) return;
      this.setTarget(this.shell.clientWidth / 2, this.shell.clientHeight / 2);
    }

    init() {
      const getOffsets = (evt) => {
        const rect = this.shell.getBoundingClientRect();
        return { x: evt.clientX - rect.left, y: evt.clientY - rect.top };
      };

      this.shell.addEventListener('pointerenter', (e) => {
        this.shell.classList.add('active');
        this.wrapper.classList.add('active');
        const { x, y } = getOffsets(e);
        this.setTarget(x, y);
      });

      this.shell.addEventListener('pointermove', (e) => {
        const { x, y } = getOffsets(e);
        this.setTarget(x, y);
      });

      this.shell.addEventListener('pointerleave', () => {
        this.toCenter();
        const checkSettle = () => {
          const settled = Math.hypot(this.targetX - this.currentX, this.targetY - this.currentY) < 0.6;
          if (settled) {
            this.shell.classList.remove('active');
            this.wrapper.classList.remove('active');
          } else {
            requestAnimationFrame(checkSettle);
          }
        };
        requestAnimationFrame(checkSettle);
      });

      // Contact button smooth scroll
      const contactBtn = this.wrapper.querySelector('.pc-contact-btn');
      if (contactBtn) {
        contactBtn.addEventListener('click', (e) => {
          e.preventDefault();
          const target = document.querySelector('#contact');
          if (target) {
            target.scrollIntoView({ behavior: 'smooth' });
          } else {
            window.location.href = '#contact';
          }
        });
      }

      // Initial intro tilt animation (runs once for 1.2s then sleeps)
      const initialX = (this.shell.clientWidth || 300) - 70;
      const initialY = 60;
      this.currentX = initialX;
      this.currentY = initialY;
      this.setVarsFromXY(initialX, initialY);
      this.toCenter();
      this.initialUntil = performance.now() + 1200;
      this.start();
    }
  }


  /* =========================================================================
     LetterGlitch Background Canvas Component (Static Snapshot)
     - Random character grid generated ONCE on page load, then frozen
     - Zero animation loop: 0% CPU/GPU after the first paint
     - Capped devicePixelRatio
     - Redrawn only on resize (width change) or theme switch
     ========================================================================= */

  const FALLBACK_RGB = { r: 171, g: 170, b: 173 };

  class LetterGlitch {
    constructor(canvas, options = {}) {
      this.canvas = canvas;
      this.ctx = canvas.getContext('2d', { alpha: true });
      this.characters = options.characters || 'ABCDEFGHIJKLMNOPQRSTUVWXYZ!@#$&*()-_+=/[]{};:<>.,0123456789';
      this.lettersAndSymbols = Array.from(this.characters);

      // Web page color matched palettes
      this.glitchColorsDark = ['#1e1e23', '#2d2d35', '#4d4c55', '#787780', '#abaaad'];
      this.glitchColorsLight = ['#b8b7ba', '#8c8b90', '#5c5b60', '#323136', '#121214'];

      this.isLight = options.isLight ?? false;
      this.glitchColors = this.isLight ? this.glitchColorsLight : this.glitchColorsDark;

      // Larger cell size for crisp readability and massive performance savings
      this.fontSize = 17;
      this.charWidth = 20;
      this.charHeight = 32;

      this.letters = [];
      this.grid = { columns: 0, rows: 0 };
      this.resizeTimeout = null;

      this.init();
    }

    hexToRgb(hex) {
      const shorthandRegex = /^#?([a-f\d])([a-f\d])([a-f\d])$/i;
      hex = hex.replace(shorthandRegex, (m, r, g, b) => r + r + g + g + b + b);
      const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
      return result
        ? {
            r: parseInt(result[1], 16),
            g: parseInt(result[2], 16),
            b: parseInt(result[3], 16)
          }
        : null;
    }

    rgbToCss({ r, g, b }) {
      return `rgb(${r}, ${g}, ${b})`;
    }

    getRandomChar() {
      return this.lettersAndSymbols[Math.floor(Math.random() * this.lettersAndSymbols.length)];
    }

    getRandomColor() {
      return this.glitchColors[Math.floor(Math.random() * this.glitchColors.length)];
    }

    getRandomRgb() {
      return this.hexToRgb(this.getRandomColor()) || FALLBACK_RGB;
    }

    calculateGrid(width, height) {
      const columns = Math.ceil(width / this.charWidth);
      const rows = Math.ceil(height / this.charHeight);
      return { columns, rows };
    }

    initializeLetters(columns, rows) {
      this.grid = { columns, rows };
      const totalLetters = columns * rows;
      this.letters = Array.from({ length: totalLetters }, () => {
        return {
          char: this.getRandomChar(),
          rgb: this.getRandomRgb()
        };
      });
    }

    resizeCanvas() {
      if (!this.canvas) return;
      const parent = this.canvas.parentElement;
      if (!parent) return;

      // Cap DPR to 1.5 to prevent massive 4K texture overhead
      const dpr = Math.min(window.devicePixelRatio || 1, 1.5);
      const rect = parent.getBoundingClientRect();

      this.canvas.width = Math.floor(rect.width * dpr);
      this.canvas.height = Math.floor(rect.height * dpr);
      this.canvas.style.width = `${rect.width}px`;
      this.canvas.style.height = `${rect.height}px`;

      if (this.ctx) {
        this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      }

      const { columns, rows } = this.calculateGrid(rect.width, rect.height);
      this.initializeLetters(columns, rows);
      this.drawLetters();
    }

    drawLetters() {
      if (!this.ctx || this.letters.length === 0) return;
      const rect = this.canvas.getBoundingClientRect();
      this.ctx.clearRect(0, 0, rect.width, rect.height);
      this.ctx.font = `${this.fontSize}px 'Geist Mono', monospace`;
      this.ctx.textBaseline = 'top';

      const cols = this.grid.columns;
      const cw = this.charWidth;
      const ch = this.charHeight;

      for (let i = 0; i < this.letters.length; i++) {
        const letter = this.letters[i];
        const x = (i % cols) * cw;
        const y = Math.floor(i / cols) * ch;
        this.ctx.fillStyle = this.rgbToCss(letter.rgb);
        this.ctx.fillText(letter.char, x, y);
      }
    }

    /*
     * STATIC MODE: the glitch grid is generated once on page load and drawn a
     * single time. No requestAnimationFrame loop, no timers, no per-frame work.
     * It is only redrawn when the viewport is resized or the theme changes.
     */
    setTheme(isLight) {
      this.isLight = isLight;
      this.glitchColors = this.isLight ? this.glitchColorsLight : this.glitchColorsDark;
      // Re-colour existing characters instantly (same letters, new palette)
      for (let i = 0; i < this.letters.length; i++) {
        this.letters[i].rgb = this.getRandomRgb();
      }
      this.drawLetters();
    }

    init() {
      this.resizeCanvas();

      // Redraw once the web font is ready so the glyphs use Geist Mono
      if (document.fonts && document.fonts.ready) {
        document.fonts.ready.then(() => this.drawLetters());
      }

      // Debounced resize handler (only regenerates on width change to avoid
      // mobile URL-bar show/hide triggering a redraw while scrolling)
      let lastWidth = window.innerWidth;
      window.addEventListener('resize', () => {
        clearTimeout(this.resizeTimeout);
        this.resizeTimeout = setTimeout(() => {
          if (window.innerWidth === lastWidth) return;
          lastWidth = window.innerWidth;
          this.resizeCanvas();
        }, 200);
      }, { passive: true });
    }
  }


  /* =========================================================================
     PullCord Physics-driven Ceiling Rope Switch (Theme Switcher)
     ========================================================================= */

  const DEFAULT_CONFIG = {
    gravity: 1250,
    damping: 0.94,
    iterations: 20,
    stretchMax: 26,
    stretchToggle: 20,
    maxVelocity: 22,
    sleepVelocity: 0.15
  };

  const W = 64;
  const ANCHOR_X = W / 2; // 32
  const REST_Y = 176;
  const SEGMENTS = 16;
  const REST_SEG = REST_Y / SEGMENTS; // 11

  function playDetentSound() {
    try {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      if (!AudioCtx) return;
      const ctx = new AudioCtx();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = 'sine';
      osc.frequency.setValueAtTime(260, ctx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(60, ctx.currentTime + 0.035);

      gain.gain.setValueAtTime(0.15, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.035);

      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + 0.04);
    } catch (_) {}
  }

  function buildPath(p) {
    let d = `M ${p[0].x.toFixed(1)} ${p[0].y.toFixed(1)}`;
    for (let i = 1; i < p.length - 1; i++) {
      const xc = (p[i].x + p[i + 1].x) / 2;
      const yc = (p[i].y + p[i + 1].y) / 2;
      d += ` Q ${p[i].x.toFixed(1)} ${p[i].y.toFixed(1)} ${xc.toFixed(1)} ${yc.toFixed(1)}`;
    }
    const n = p.length - 1;
    d += ` L ${p[n].x.toFixed(1)} ${p[n].y.toFixed(1)}`;
    return d;
  }

  function makeNodes() {
    const arr = [];
    for (let i = 0; i <= SEGMENTS; i++) {
      const y = REST_SEG * i;
      arr.push({ x: ANCHOR_X, y, ox: ANCHOR_X, oy: y, fixed: i === 0 });
    }
    return arr;
  }

  class PullCordComponent {
    constructor(element, options = {}) {
      this.container = element;
      this.config = Object.assign({}, DEFAULT_CONFIG, options.config || {});
      this.onPull = options.onPull || (() => {});
      this.pulled = !!options.pulled;

      this.inner = this.container.querySelector('.pullcord-inner');
      this.cordPath = this.container.querySelector('.pullcord-path');
      this.knobGroup = this.container.querySelector('.pullcord-knob-group');
      this.knobBtn = this.container.querySelector('.pullcord-knob-btn');

      this.reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
      this.nodes = makeNodes();
      this.dragging = false;
      this.didDrag = false;
      this.clicked = false;
      this.target = { x: ANCHOR_X, y: REST_Y };
      this.dropDone = false;
      this.dragStartPos = { x: 0, y: 0 };

      this.running = false;
      this.raf = 0;
      this.prevT = 0;
      this.prevDt = 0;

      this.init();
    }

    init() {
      this.render();

      if (this.inner) {
        this.inner.addEventListener('animationend', (e) => {
          if (e.animationName === 'pullcord-drop') {
            this.endDrop();
          }
        });
        setTimeout(() => this.endDrop(), 1600);
      }

      if (this.knobBtn && !this.reduceMotion) {
        this.knobBtn.addEventListener('pointerdown', (e) => this.onPanStart(e));
        this.knobBtn.addEventListener('click', (e) => this.onClick(e));
        this.knobBtn.addEventListener('keydown', (e) => this.onKeyDown(e));
      } else if (this.knobBtn) {
        this.knobBtn.addEventListener('click', (e) => this.onClick(e));
        this.knobBtn.addEventListener('keydown', (e) => this.onKeyDown(e));
      }
    }

    render() {
      const pts = this.nodes;
      const last = pts.length - 1;
      if (this.cordPath) {
        this.cordPath.setAttribute('d', buildPath(pts));
      }
      if (this.knobGroup) {
        const tx = (pts[last].x - ANCHOR_X).toFixed(2);
        const ty = (pts[last].y - REST_Y).toFixed(2);
        this.knobGroup.setAttribute('transform', `translate(${tx} ${ty})`);
      }
      if (this.knobBtn) {
        const tx = pts[last].x - ANCHOR_X;
        const ty = pts[last].y - REST_Y;
        this.knobBtn.style.transform = `translate(${tx.toFixed(2)}px, ${ty.toFixed(2)}px)`;
      }
    }

    wake() {
      if (this.running) return;
      this.running = true;
      this.prevT = 0;
      this.prevDt = 0;
      this.raf = requestAnimationFrame((now) => this.step(now));
    }

    step(now) {
      const { gravity, damping, iterations, sleepVelocity } = this.config;
      const dt = this.prevT ? Math.min(0.04, Math.max(0.004, (now - this.prevT) / 1000)) : 1 / 60;
      this.prevT = now;
      const tc = this.prevDt > 0 ? dt / this.prevDt : 1;
      const velCoef = tc * Math.pow(damping, dt * 60);
      const accCoef = dt * dt;
      const pts = this.nodes;
      const last = pts.length - 1;

      pts[last].fixed = this.dragging;

      for (let i = 1; i < pts.length; i++) {
        const p = pts[i];
        if (p.fixed) continue;
        const vx = p.x - p.ox;
        const vy = p.y - p.oy;
        p.ox = p.x;
        p.oy = p.y;
        p.x += vx * velCoef;
        p.y += vy * velCoef + gravity * accCoef;
      }

      pts[0].x = ANCHOR_X;
      pts[0].y = 0;

      if (this.dragging) {
        pts[last].ox = pts[last].x;
        pts[last].oy = pts[last].y;
        pts[last].x = this.target.x;
        pts[last].y = this.target.y;
      }

      for (let k = 0; k < iterations; k++) {
        for (let i = 0; i < last; i++) {
          const a = pts[i];
          const b = pts[i + 1];
          const dx = b.x - a.x;
          const dy = b.y - a.y;
          const dist = Math.hypot(dx, dy) || 0.0001;
          const diff = ((REST_SEG - dist) / dist) * 0.5;
          const ox = dx * diff;
          const oy = dy * diff;

          if (!a.fixed) {
            a.x -= ox;
            a.y -= oy;
          }
          if (!b.fixed) {
            b.x += ox;
            b.y += oy;
          }
        }
      }

      this.prevDt = dt;
      this.render();

      let speed = 0;
      for (let i = 1; i < pts.length; i++) {
        speed += Math.abs(pts[i].x - pts[i].ox) + Math.abs(pts[i].y - pts[i].oy);
      }

      if (!this.dragging && speed < sleepVelocity * dt * 60) {
        this.render();
        this.running = false;
        return;
      }

      this.raf = requestAnimationFrame((n) => this.step(n));
    }

    triggerPull() {
      this.pulled = !this.pulled;
      if (this.knobBtn) {
        this.knobBtn.setAttribute('aria-pressed', String(this.pulled));
      }
      playDetentSound();
      if (typeof this.onPull === 'function') {
        this.onPull(this.pulled);
      }
    }

    scriptedPull() {
      this.triggerPull();
      if (this.reduceMotion) return;
      const pts = this.nodes;
      pts[pts.length - 1].oy -= 22;
      this.wake();
    }

    endDrop() {
      if (this.dropDone) return;
      this.dropDone = true;
      if (this.inner) {
        this.inner.classList.remove('pullcord-inner--drop');
      }
      if (this.reduceMotion) return;
      const pts = this.nodes;
      if (!pts) return;
      pts[pts.length - 1].oy -= 14;
      pts[pts.length - 1].ox -= 7;
      this.wake();
    }

    onPanStart(e) {
      if (e.button !== 0 && e.pointerType === 'mouse') return;
      this.dragging = true;
      this.didDrag = true;
      this.clicked = false;
      this.dragStartPos = { x: e.clientX, y: e.clientY };

      const onPointerMove = (evt) => {
        if (!this.dragging) return;
        const rx = evt.clientX - this.dragStartPos.x;
        const ry = REST_Y + (evt.clientY - this.dragStartPos.y);
        const dist = Math.hypot(rx, ry) || 0.0001;
        const maxD = REST_Y + this.config.stretchMax;
        const k = dist > maxD ? maxD / dist : 1;
        this.target = { x: ANCHOR_X + rx * k, y: ry * k };

        const clickAt = Math.min(this.config.stretchToggle, this.config.stretchMax - 1);
        if (!this.clicked && dist - REST_Y >= clickAt) {
          this.clicked = true;
          this.triggerPull();
        }
      };

      const onPointerUp = () => {
        this.dragging = false;
        const pts = this.nodes;
        const p = pts[pts.length - 1];
        const vx = p.x - p.ox;
        const vy = p.y - p.oy;
        const v = Math.hypot(vx, vy);
        if (v > this.config.maxVelocity) {
          const k = this.config.maxVelocity / v;
          p.ox = p.x - vx * k;
          p.oy = p.y - vy * k;
        }
        window.removeEventListener('pointermove', onPointerMove);
        window.removeEventListener('pointerup', onPointerUp);
        window.removeEventListener('pointercancel', onPointerUp);
        this.wake();
        requestAnimationFrame(() => {
          this.didDrag = false;
        });
      };

      window.addEventListener('pointermove', onPointerMove);
      window.addEventListener('pointerup', onPointerUp);
      window.addEventListener('pointercancel', onPointerUp);
      this.wake();
    }

    onClick(e) {
      if (this.didDrag) return;
      if (e.detail === 0) return;
      this.scriptedPull();
    }

    onKeyDown(e) {
      if ((e.key === 'Enter' || e.key === ' ') && !e.repeat) {
        e.preventDefault();
        this.scriptedPull();
      }
    }
  }

  /* =========================================================================
     Terminal Animation Controller (Magic UI Inspired)
     Typed commands, sequential output reveal, clipboard copy & replay
     ========================================================================= */
  class TerminalAnimationController {
    constructor(terminalEl) {
      this.terminal = terminalEl;
      this.reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

      this.block1 = document.getElementById('termBlock1');
      this.cmd1 = document.getElementById('cmdWhoami');
      this.out1 = document.getElementById('outWhoami');

      this.block2 = document.getElementById('termBlock2');
      this.cmd2 = document.getElementById('cmdCat');
      this.out2 = document.getElementById('outCat');

      this.block3 = document.getElementById('termBlock3');
      this.cmd3 = document.getElementById('cmdEcho');
      this.out3 = document.getElementById('outEcho');

      this.activePrompt = document.getElementById('termActivePrompt');
      this.replayBtn = document.getElementById('termReplayBtn');

      this.commands = [
        { block: this.block1, cmdEl: this.cmd1, outEl: this.out1, text: 'whoami', delayBefore: 200 },
        { block: this.block2, cmdEl: this.cmd2, outEl: this.out2, text: 'cat about.txt', delayBefore: 300 },
        { block: this.block3, cmdEl: this.cmd3, outEl: this.out3, text: 'echo $PASSION', delayBefore: 300 }
      ];

      this.isTyping = false;
      this.hasPlayed = false;
      this.timeouts = [];

      this.cursorEl = document.createElement('span');
      this.cursorEl.className = 'term-inline-cursor';
      this.cursorEl.setAttribute('aria-hidden', 'true');

      this.init();
    }

    init() {
      this.bindActions();

      if (this.reduceMotion) {
        this.showAllInstantly();
        return;
      }

      // Trigger animation when terminal enters viewport
      if ('IntersectionObserver' in window) {
        const observer = new IntersectionObserver((entries) => {
          entries.forEach(entry => {
            if (entry.isIntersecting && !this.hasPlayed) {
              this.hasPlayed = true;
              this.play();
            }
          });
        }, { threshold: 0.15 });
        observer.observe(this.terminal);
      } else {
        this.play();
      }
    }

    bindActions() {
      // Replay button
      if (this.replayBtn) {
        this.replayBtn.addEventListener('click', () => {
          this.reset();
          this.play();
        });
      }
    }

    reset() {
      this.timeouts.forEach(t => clearTimeout(t));
      this.timeouts = [];
      this.isTyping = false;

      if (this.cursorEl.parentNode) {
        this.cursorEl.parentNode.removeChild(this.cursorEl);
      }

      if (this.cmd1) this.cmd1.textContent = '';
      if (this.cmd2) this.cmd2.textContent = '';
      if (this.cmd3) this.cmd3.textContent = '';

      if (this.out1) this.out1.classList.remove('visible');
      if (this.out2) this.out2.classList.remove('visible');
      if (this.out3) this.out3.classList.remove('visible');

      if (this.block2) this.block2.classList.add('term-hidden');
      if (this.block3) this.block3.classList.add('term-hidden');
      if (this.activePrompt) this.activePrompt.classList.add('term-hidden');
    }

    showAllInstantly() {
      if (this.cmd1) this.cmd1.textContent = 'whoami';
      if (this.cmd2) this.cmd2.textContent = 'cat about.txt';
      if (this.cmd3) this.cmd3.textContent = 'echo $PASSION';

      if (this.block2) this.block2.classList.remove('term-hidden');
      if (this.block3) this.block3.classList.remove('term-hidden');

      if (this.out1) this.out1.classList.add('visible');
      if (this.out2) this.out2.classList.add('visible');
      if (this.out3) this.out3.classList.add('visible');

      if (this.activePrompt) this.activePrompt.classList.remove('term-hidden');
    }

    play() {
      this.reset();
      this.isTyping = true;
      this.runStep(0);
    }

    runStep(index) {
      if (index >= this.commands.length) {
        if (this.cursorEl.parentNode) {
          this.cursorEl.parentNode.removeChild(this.cursorEl);
        }
        if (this.activePrompt) {
          this.activePrompt.classList.remove('term-hidden');
        }
        this.isTyping = false;
        return;
      }

      const step = this.commands[index];
      if (!step || !step.cmdEl) return;

      const timer = setTimeout(() => {
        step.block.classList.remove('term-hidden');
        step.cmdEl.textContent = '';
        step.cmdEl.parentNode.appendChild(this.cursorEl);

        let charIdx = 0;
        const text = step.text;

        const typeChar = () => {
          if (charIdx < text.length) {
            step.cmdEl.textContent += text.charAt(charIdx);
            charIdx++;
            const speed = 35 + Math.random() * 30;
            const t = setTimeout(typeChar, speed);
            this.timeouts.push(t);
          } else {
            const t = setTimeout(() => {
              step.outEl.classList.add('visible');
              const nextT = setTimeout(() => {
                this.runStep(index + 1);
              }, 400);
              this.timeouts.push(nextT);
            }, 160);
            this.timeouts.push(t);
          }
        };

        typeChar();
      }, step.delayBefore);

      this.timeouts.push(timer);
    }

  }

  /* =========================================================================
     SpecularCardController Component (React Bits Inspired)
     Dynamic cursor-following specular border highlight across all cards
     ========================================================================= */
  class SpecularCardController {
    constructor(selector = '.specular-card', options = {}) {
      this.cards = Array.from(document.querySelectorAll(selector));
      if (!this.cards.length) return;

      this.options = Object.assign({
        proximity: 320, // distance in pixels where shine fades in
        maxIntensity: 1.0
      }, options);

      this.reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
      this.hoverCapable = window.matchMedia('(hover: hover) and (pointer: fine)').matches;

      this.visibleCards = new Set();
      this.cardRects = new Map();
      this.rectsDirty = true;
      this.running = false;
      this.pointer = { x: -9999, y: -9999 };

      this.init();
    }

    init() {
      if (this.reduceMotion || !this.hoverCapable) return;

      this.setupIntersectionObserver();
      this.bindEvents();
    }

    setupIntersectionObserver() {
      if ('IntersectionObserver' in window) {
        this.observer = new IntersectionObserver((entries) => {
          entries.forEach(entry => {
            if (entry.isIntersecting) {
              this.visibleCards.add(entry.target);
              this.rectsDirty = true;
            } else {
              this.visibleCards.delete(entry.target);
              this.cardRects.delete(entry.target);
              entry.target.style.setProperty('--spec-opacity', '0');
            }
          });
        }, { threshold: 0.05, rootMargin: '100px' });

        this.cards.forEach(card => this.observer.observe(card));
      } else {
        this.cards.forEach(card => this.visibleCards.add(card));
      }
    }

    bindEvents() {
      window.addEventListener('pointermove', (e) => {
        this.pointer.x = e.clientX;
        this.pointer.y = e.clientY;

        if (!this.running) {
          this.running = true;
          requestAnimationFrame(() => this.update());
        }
      }, { passive: true });

      const invalidateRects = () => {
        this.rectsDirty = true;
      };
      window.addEventListener('scroll', invalidateRects, { passive: true });
      window.addEventListener('resize', invalidateRects, { passive: true });

      window.addEventListener('pointerleave', () => {
        this.visibleCards.forEach(card => {
          card.style.setProperty('--spec-opacity', '0');
        });
      });
    }

    update() {
      this.running = false;
      const px = this.pointer.x;
      const py = this.pointer.y;
      const prox = this.options.proximity;

      if (this.rectsDirty) {
        this.visibleCards.forEach(card => {
          this.cardRects.set(card, card.getBoundingClientRect());
        });
        this.rectsDirty = false;
      }

      this.visibleCards.forEach(card => {
        const rect = this.cardRects.get(card);
        if (!rect) return;

        // Distance from cursor to nearest point on the card's bounding box
        const dx = Math.max(rect.left - px, 0, px - rect.right);
        const dy = Math.max(rect.top - py, 0, py - rect.bottom);
        const dist = Math.hypot(dx, dy);

        if (dist <= prox) {
          // Smooth Hermite proximity curve (identical to SpecularButton)
          const t = Math.max(0, 1 - dist / prox);
          const proximityT = t * t * (3 - 2 * t);

          const relX = px - rect.left;
          const relY = py - rect.top;

          card.style.setProperty('--spec-x', `${relX.toFixed(1)}px`);
          card.style.setProperty('--spec-y', `${relY.toFixed(1)}px`);
          card.style.setProperty('--spec-opacity', proximityT.toFixed(3));
          card.style.setProperty('--spec-intensity', (proximityT * this.options.maxIntensity).toFixed(3));
        } else {
          if (card.style.getPropertyValue('--spec-opacity') !== '0') {
            card.style.setProperty('--spec-opacity', '0');
          }
        }
      });
    }
  }

  // =========================================================================
  // ContactPhysicsChips Controller (Matter.js 2D Rigid Body Physics)
  // =========================================================================
  class ContactPhysicsChips {
    constructor(containerSelector = '#physicsContainer') {
      this.container = document.querySelector(containerSelector);
      if (!this.container) return;

      this.chips = Array.from(this.container.querySelectorAll('[data-stack-chip="true"]'));
      if (this.chips.length === 0) return;

      if (typeof Matter === 'undefined') {
        console.warn('Matter.js not loaded. Falling back to static layout.');
        return;
      }

      this.initPhysics();
    }

    initPhysics() {
      const { Engine, Runner, Bodies, Composite, Mouse, MouseConstraint, Events, Body } = Matter;

      let width = Math.max(300, this.container.clientWidth || 450);
      let height = Math.max(300, this.container.clientHeight || 380);

      // Create engine with zero-gravity floating field and body sleeping so idle chips consume 0% CPU
      this.engine = Engine.create({
        gravity: { x: 0, y: 0, scale: 0 },
        enableSleeping: true
      });
      this.runner = Runner.create();

      // Bounding walls with ample padding
      const wallThickness = 100;
      this.walls = {
        floor: Bodies.rectangle(width / 2, height + wallThickness / 2, width * 3, wallThickness, { isStatic: true, restitution: 0.8 }),
        left: Bodies.rectangle(-wallThickness / 2, height / 2, wallThickness, height * 3, { isStatic: true, restitution: 0.8 }),
        right: Bodies.rectangle(width + wallThickness / 2, height / 2, wallThickness, height * 3, { isStatic: true, restitution: 0.8 }),
        ceiling: Bodies.rectangle(width / 2, -wallThickness / 2, width * 3, wallThickness, { isStatic: true, restitution: 0.8 })
      };

      Composite.add(this.engine.world, [
        this.walls.floor,
        this.walls.left,
        this.walls.right,
        this.walls.ceiling
      ]);

      // Well-balanced initial positions across upper, middle, and lower areas
      const spawnConfig = [
        { xRatio: 0.28, yRatio: 0.28, angle: -0.15 }, // GitHub (top-left)
        { xRatio: 0.72, yRatio: 0.26, angle: 0.14 },  // Gmail (top-right)
        { xRatio: 0.50, yRatio: 0.52, angle: -0.05 }, // LinkedIn (center)
        { xRatio: 0.26, yRatio: 0.76, angle: 0.12 },  // Instagram (bottom-left)
        { xRatio: 0.74, yRatio: 0.75, angle: -0.10 }  // X (bottom-right)
      ];

      this.chipItems = [];

      this.chips.forEach((chipEl, idx) => {
        const chipRect = chipEl.getBoundingClientRect();
        const bw = Math.max(105, chipRect.width || 130);
        const bh = Math.max(38, chipRect.height || 42);

        const config = spawnConfig[idx] || { xRatio: 0.5, yRatio: 0.5, angle: 0 };
        const x = Math.max(bw / 2 + 10, Math.min(width - bw / 2 - 10, width * config.xRatio));
        const y = Math.max(bh / 2 + 10, Math.min(height - bh / 2 - 10, height * config.yRatio));

        const body = Bodies.rectangle(x, y, bw, bh, {
          chamfer: { radius: 14 },
          restitution: 0.75,
          friction: 0.1,
          frictionAir: 0.016,
          density: 0.0018,
          angle: config.angle
        });

        // Gentle initial angular drift
        Body.setAngularVelocity(body, (Math.random() - 0.5) * 0.02);

        chipEl.style.position = 'absolute';
        chipEl.style.top = '0px';
        chipEl.style.left = '0px';
        chipEl.style.pointerEvents = 'auto';

        this.chipItems.push({
          body,
          el: chipEl,
          halfW: bw / 2,
          halfH: bh / 2,
          lastX: -9999,
          lastY: -9999,
          lastAngle: -9999,
          href: chipEl.getAttribute('data-href')
        });

        Composite.add(this.engine.world, body);
      });

      // Mouse constraint for dragging and tossing
      const mouse = Mouse.create(this.container);
      const mouseConstraint = MouseConstraint.create(this.engine, {
        mouse: mouse,
        constraint: {
          stiffness: 0.7,
          render: { visible: false }
        }
      });

      // Remove wheel listener to allow page scrolling
      if (mouse.element) {
        mouse.element.removeEventListener('mousewheel', mouse.mousewheel);
        mouse.element.removeEventListener('DOMMouseScroll', mouse.mousewheel);
        mouse.element.removeEventListener('wheel', mouse.mousewheel);
      }

      Composite.add(this.engine.world, mouseConstraint);

      // Distinguish tap to open link vs drag/toss
      let pointerDownPos = { x: 0, y: 0 };
      let pointerDownTime = 0;

      const handlePointerDown = (e) => {
        const clientX = e.touches ? e.touches[0].clientX : e.clientX;
        const clientY = e.touches ? e.touches[0].clientY : e.clientY;
        pointerDownPos = { x: clientX, y: clientY };
        pointerDownTime = Date.now();
        // Wake sleeping bodies on interaction so dragging/tossing is instant
        if (Matter.Sleeping) {
          for (let i = 0; i < this.chipItems.length; i++) {
            Matter.Sleeping.set(this.chipItems[i].body, false);
          }
        }
      };

      const handlePointerUp = (e) => {
        const clientX = e.changedTouches ? e.changedTouches[0].clientX : e.clientX;
        const clientY = e.changedTouches ? e.changedTouches[0].clientY : e.clientY;
        const dist = Math.hypot(clientX - pointerDownPos.x, clientY - pointerDownPos.y);
        const duration = Date.now() - pointerDownTime;

        if (dist < 8 && duration < 500) {
          const target = e.target.closest('[data-stack-chip="true"]');
          if (target && target.dataset.href) {
            const url = target.dataset.href;
            if (url.startsWith('mailto:')) {
              window.location.href = url;
            } else {
              window.open(url, '_blank', 'noopener,noreferrer');
            }
          }
        }
      };

      this.container.addEventListener('mousedown', handlePointerDown);
      this.container.addEventListener('mouseup', handlePointerUp);
      this.container.addEventListener('touchstart', handlePointerDown, { passive: true });
      this.container.addEventListener('touchend', handlePointerUp);

      // Keyboard accessibility: Enter or Space activates focused chip link
      this.container.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          const target = e.target.closest('[data-stack-chip="true"]');
          if (target && target.dataset.href) {
            e.preventDefault();
            const url = target.dataset.href;
            if (url.startsWith('mailto:')) {
              window.location.href = url;
            } else {
              window.open(url, '_blank', 'noopener,noreferrer');
            }
          }
        }
      });

      Events.on(mouseConstraint, 'startdrag', () => {
        this.container.classList.add('is-grabbing');
      });
      Events.on(mouseConstraint, 'enddrag', () => {
        this.container.classList.remove('is-grabbing');
      });

      // Strict boundary keeper on every frame
      Events.on(this.engine, 'afterUpdate', () => {
        const cw = this.container.clientWidth;
        const ch = this.container.clientHeight;

        for (let i = 0; i < this.chipItems.length; i++) {
          const item = this.chipItems[i];
          const b = item.body;

          const minX = item.halfW + 4;
          const maxX = cw - item.halfW - 4;
          const minY = item.halfH + 4;
          const maxY = ch - item.halfH - 4;

          if (b.position.x < minX) {
            Matter.Body.setPosition(b, { x: minX, y: b.position.y });
            Matter.Body.setVelocity(b, { x: Math.abs(b.velocity.x) * 0.7, y: b.velocity.y });
          } else if (b.position.x > maxX) {
            Matter.Body.setPosition(b, { x: maxX, y: b.position.y });
            Matter.Body.setVelocity(b, { x: -Math.abs(b.velocity.x) * 0.7, y: b.velocity.y });
          }

          if (b.position.y < minY) {
            Matter.Body.setPosition(b, { x: b.position.x, y: minY });
            Matter.Body.setVelocity(b, { x: b.velocity.x, y: Math.abs(b.velocity.y) * 0.7 });
          } else if (b.position.y > maxY) {
            Matter.Body.setPosition(b, { x: b.position.x, y: maxY });
            Matter.Body.setVelocity(b, { x: b.velocity.x, y: -Math.abs(b.velocity.y) * 0.5 });
          }

          const tx = b.position.x - item.halfW;
          const ty = b.position.y - item.halfH;
          if (
            Math.abs(tx - item.lastX) > 0.05 ||
            Math.abs(ty - item.lastY) > 0.05 ||
            Math.abs(b.angle - item.lastAngle) > 0.001
          ) {
            item.lastX = tx;
            item.lastY = ty;
            item.lastAngle = b.angle;
            item.el.style.transform = `translate3d(${tx.toFixed(2)}px, ${ty.toFixed(2)}px, 0px) rotate(${b.angle.toFixed(4)}rad)`;
          }
        }
      });

      // Start physics runner
      Runner.run(this.runner, this.engine);

      // Pause when offscreen
      if ('IntersectionObserver' in window) {
        const observer = new IntersectionObserver((entries) => {
          entries.forEach((entry) => {
            if (entry.isIntersecting) {
              this.runner.enabled = true;
            } else {
              this.runner.enabled = false;
            }
          });
        }, { threshold: 0.05 });

        observer.observe(this.container);
      }

      // Dynamic resize handler
      const updateDimensions = () => {
        const newW = this.container.clientWidth;
        const newH = this.container.clientHeight;
        if (newW && newH) {
          Matter.Body.setPosition(this.walls.floor, { x: newW / 2, y: newH + wallThickness / 2 });
          Matter.Body.setPosition(this.walls.right, { x: newW + wallThickness / 2, y: newH / 2 });
          Matter.Body.setPosition(this.walls.ceiling, { x: newW / 2, y: -wallThickness / 2 });
          Matter.Body.setPosition(this.walls.left, { x: -wallThickness / 2, y: newH / 2 });
        }
      };

      if ('ResizeObserver' in window) {
        new ResizeObserver(updateDimensions).observe(this.container);
      } else {
        window.addEventListener('resize', updateDimensions);
      }
    }
  }

  /* =========================================================================
     HairlineProjectFiguresController
     Renders pointer-reactive isometric figures for the 3 featured projects.
     Uses dynamic import of @lucasmarkes/hairline via ESM CDN.
     ========================================================================= */
  class HairlineProjectFiguresController {
    constructor() {
      this.configs = [
        { id: 'figure-securebox', exportName: 'vault', intensity: 0.6 },
        { id: 'figure-rmm-edr', exportName: 'hub', intensity: 0.65 },
        { id: 'figure-moda', exportName: 'rail', intensity: 0.7 },
        { id: 'figure-pdfchat', exportName: 'loupe', intensity: 0.6 }
      ];
      this.init();
    }

    init() {
      const targets = this.configs
        .map(cfg => ({ ...cfg, el: document.getElementById(cfg.id) }))
        .filter(item => item.el);

      if (!targets.length) return;

      const loadFigures = async () => {
        if (this.loaded) return;
        this.loaded = true;
        try {
          const hairline = await import('https://esm.sh/@lucasmarkes/hairline@0.5.1');

          targets.forEach(({ el, exportName, intensity }) => {
            const fn = hairline[exportName];
            if (typeof fn === 'function') {
              fn(el, { intensity, play: true });
            }
          });
        } catch (err) {
          console.warn('Hairline figures module failed to load:', err);
        }
      };

      const projectsSection = document.getElementById('projects');
      if (projectsSection && 'IntersectionObserver' in window) {
        const obs = new IntersectionObserver((entries) => {
          if (entries.some(e => e.isIntersecting)) {
            obs.disconnect();
            loadFigures();
          }
        }, { rootMargin: '400px 0px' });
        obs.observe(projectsSection);
      } else {
        loadFigures();
      }

      // Mobile Touch Tap support: tap to reveal details, tap outside to revert to figure
      document.querySelectorAll('.project-step-content').forEach(card => {
        card.addEventListener('click', (e) => {
          if (e.target.closest('a')) return;
          card.classList.toggle('is-active');
        });
      });

      document.addEventListener('click', (e) => {
        if (!e.target.closest('.project-step-content')) {
          document.querySelectorAll('.project-step-content.is-active').forEach(c => c.classList.remove('is-active'));
        }
      });
    }
  }

  // App Initialization on DOM Ready (with immediate fallback if already ready)
  const initApp = () => {
    const systemPrefersLight = window.matchMedia && window.matchMedia('(prefers-color-scheme: light)').matches;
    const savedTheme = localStorage.getItem('theme') || (systemPrefersLight ? 'light' : 'dark');
    const isLightMode = savedTheme === 'light';
    document.documentElement.setAttribute('data-theme', savedTheme);
    const metaTheme = document.querySelector('meta[name="theme-color"]');
    if (metaTheme) metaTheme.setAttribute('content', isLightMode ? '#cac9cc' : '#121214');

    // 1. Initialize LetterGlitch Background with 50% opacity & color matching
    const glitchCanvas = document.getElementById('glitchCanvas');
    let glitchInstance = null;
    if (glitchCanvas) {
      glitchInstance = new LetterGlitch(glitchCanvas, {
        isLight: isLightMode
      });
    }

    // 2. Initialize PullCord Ceiling Theme Switcher
    const pullcordEl = document.getElementById('pullcord');
    if (pullcordEl) {
      new PullCordComponent(pullcordEl, {
        pulled: isLightMode,
        onPull: (isPulled) => {
          const nextTheme = isPulled ? 'light' : 'dark';
          document.documentElement.setAttribute('data-theme', nextTheme);
          localStorage.setItem('theme', nextTheme);
          if (metaTheme) metaTheme.setAttribute('content', isPulled ? '#cac9cc' : '#121214');

          // Update LetterGlitch palette in real-time
          if (glitchInstance) {
            glitchInstance.setTheme(isPulled);
          }
        }
      });
    }

    // 3. Initialize ProfileCard 3D Tilt Component
    const profileCardEl = document.getElementById('profileCard');
    if (profileCardEl) {
      new ProfileCardComponent(profileCardEl, {
        enableTilt: true
      });
    }

    // 5. Initialize Magic UI Terminal Animation
    const terminalEl = document.getElementById('terminalWindow');
    if (terminalEl) {
      new TerminalAnimationController(terminalEl);
    }

    // 6. Initialize Specular Effect across all Cards (React Bits SpecularButton adaptation)
    new SpecularCardController('.specular-card');

    // 7. Initialize Hairline Interactive Figures on Project Cards
    new HairlineProjectFiguresController();

    // 8. Initialize Interactive Physics Chips for Contact Section
    new ContactPhysicsChips('#physicsContainer');

    // 10. Update Footer Copyright Year Dynamically
    const footerYearEl = document.getElementById('footerYear');
    if (footerYearEl) {
      footerYearEl.textContent = new Date().getFullYear();
    }
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initApp);
  } else {
    initApp();
  }
})();


