/**
 * Pixel Arc (Originkit WebGL Component)
 * Source: Originkit Component Registry (pixel-arc)
 * Wired directly into vanilla architecture preserving exact shaders, uniforms, and math.
 */

(function () {
  'use strict';

  // Render at 1x device pixels: the effect is made of soft square cells, so
  // extra resolution on Retina/4K screens is invisible but costs 2-4x GPU fill.
  const MAX_DPR = 1;
  // The arc drifts slowly; 30 FPS is visually identical and halves GPU work.
  const FRAME_INTERVAL = 1000 / 30;

  const VERT_SRC = `
attribute vec2 a_pos;
void main(){ gl_Position = vec4(a_pos, 0.0, 1.0); }
`;

  const FRAG_SRC = `
#ifdef GL_FRAGMENT_PRECISION_HIGH
precision highp float;
#else
precision mediump float;
#endif

uniform vec2  uRes;
uniform float uTime, uDpr, uCell, uFill;
uniform float uCenter, uDrop, uThick, uFall;
uniform vec3  uBg, uBase, uAccent, uHigh;

void main(){
  float cs = max(uCell, 2.0);
  vec2 ci = floor(gl_FragCoord.xy / cs);
  vec2 cc = (ci + 0.5) * cs;

  float x = cc.x / uDpr;
  float y = (uRes.y - cc.y) / uDpr;        // canvas y runs down
  float w = uRes.x / uDpr;
  float h = uRes.y / uDpr;

  float nx = (x / w) * 2.0 - 1.0;
  float curveY = h * uCenter + pow(abs(nx), 1.8) * (h * uDrop);
  float i = max(0.0, 1.0 - abs(y - curveY) / max(h * uThick, 1.0));

  vec3 col = uBg;
  if (i > 0.01) {
    // ADDED, not multiplied: the wave can lift a cell above the band envelope
    float wave1 = sin(nx * 4.0 - uTime * 1.5) * 0.1;
    float wave2 = cos(y * 0.01 + uTime) * 0.1;
    i = clamp(i + wave1 + wave2, 0.0, 1.0);
    i *= max(0.0, 1.0 - pow(abs(nx), uFall));

    if (i > 0.02) {
      // fixed-size square with a gutter; intensity rides the OPACITY
      float side = cs * uFill;
      vec2 d = abs(gl_FragCoord.xy - cc);
      float cov = 1.0 - smoothstep(side * 0.5 - 1.0, side * 0.5 + 1.0, max(d.x, d.y));

      float core = i * i * i;
      float mid = pow(i, 1.5);
      vec3 ink;
      if (uBg.r > uHigh.r) {
        // Light theme: subtract tonal weights from light background toward dark tones
        // (mirrors the dark-theme additive curve instead of starting from black)
        vec3 drop = (uBg - uBase) * i * 0.35 + (uBg - uAccent) * mid * 0.95 + (uBg - uHigh) * core * 0.35;
        ink = clamp(uBg - drop, uHigh, uBg);
      } else {
        // Dark theme: additive glow from dark background toward highlight tones
        ink = clamp(uBase * i * 0.35 + uAccent * mid * 0.95 + uHigh * core * 0.35, 0.0, 1.0);
      }
      col = mix(uBg, ink, cov * i);
    }
  }
  gl_FragColor = vec4(col, 1.0);
}
`;

  function compile(gl, type, src) {
    const sh = gl.createShader(type);
    if (!sh) return null;
    gl.shaderSource(sh, src);
    gl.compileShader(sh);
    if (!gl.getShaderParameter(sh, gl.COMPILE_STATUS)) {
      console.error('DataPixelArc shader error:', gl.getShaderInfoLog(sh));
      gl.deleteShader(sh);
      return null;
    }
    return sh;
  }

  function parseColor(input, fb) {
    if (!input) return fb;
    const str = String(input).trim();
    if (str.charAt(0) === '#') {
      let hex = str.slice(1);
      if (hex.length === 3 || hex.length === 4) {
        hex = hex[0] + hex[0] + hex[1] + hex[1] + hex[2] + hex[2];
      }
      if (hex.length >= 6) {
        const r = parseInt(hex.slice(0, 2), 16);
        const g = parseInt(hex.slice(2, 4), 16);
        const b = parseInt(hex.slice(4, 6), 16);
        if (!isNaN(r) && !isNaN(g) && !isNaN(b)) return [r / 255, g / 255, b / 255];
      }
      return fb;
    }
    const m = str.match(/[\d.]+/g);
    if (m && m.length >= 3) {
      return [
        Math.min(255, parseFloat(m[0])) / 255,
        Math.min(255, parseFloat(m[1])) / 255,
        Math.min(255, parseFloat(m[2])) / 255,
      ];
    }
    return fb;
  }

  function num(v, fb) {
    return typeof v === 'number' && isFinite(v) ? v : fb;
  }

  function clampN(v, lo, hi) {
    return v < lo ? lo : v > hi ? hi : v;
  }

  const ARC_DEFAULTS = { center: 50, drop: 30, thickness: 45, falloff: 500 };

  window.initPixelArc = function (canvas, options = {}) {
    if (!canvas) return null;

    const gl = canvas.getContext('webgl', { alpha: true, antialias: false, depth: false });
    if (!gl) {
      console.warn('PixelArc: WebGL unavailable');
      return null;
    }

    const vs = compile(gl, gl.VERTEX_SHADER, VERT_SRC);
    const fs = compile(gl, gl.FRAGMENT_SHADER, FRAG_SRC);
    if (!vs || !fs) return null;

    const prog = gl.createProgram();
    if (!prog) return null;
    gl.attachShader(prog, vs);
    gl.attachShader(prog, fs);
    gl.linkProgram(prog);
    if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) {
      console.error('PixelArc link error:', gl.getProgramInfoLog(prog));
      return null;
    }
    gl.useProgram(prog);

    const buf = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buf);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
    const aPos = gl.getAttribLocation(prog, 'a_pos');
    gl.enableVertexAttribArray(aPos);
    gl.vertexAttribPointer(aPos, 2, gl.FLOAT, false, 0, 0);

    const locs = {};
    const u = (name) => {
      if (!(name in locs)) locs[name] = gl.getUniformLocation(prog, name);
      return locs[name];
    };

    // Configuration merged with Originkit presets + soft cyber overrides
    const arc_ = { ...ARC_DEFAULTS, ...(options.arc || {}) };
    const config = {
      bg: options.background || '#121214',
      base: options.baseColor || '#232328',
      accent: options.accentColor || '#abaaad',
      high: options.highlight || '#f2f2f4',
      density: Math.round(clampN(num(options.density, 140), 24, 260)),
      dotSize: clampN(num(options.dotSize, 85), 20, 100) / 100,
      speed: clampN(num(options.speed, 35), 0, 100) / 50,
      center: clampN(num(arc_.center, 50), 0, 100) / 100,
      drop: clampN(num(arc_.drop, 30), 0, 300) / 100,
      thickness: clampN(num(arc_.thickness, 45), 2, 120) / 100,
      falloff: clampN(num(arc_.falloff, 500), 50, 600) / 100,
    };

    // Pointer interaction intentionally removed (no pointermove listener) to save resources.

    // Colours are parsed once (and again only when the theme changes), not every frame
    let colors = null;
    const refreshColors = () => {
      colors = {
        bg: parseColor(config.bg, [0.071, 0.071, 0.078]),
        base: parseColor(config.base, [0.137, 0.137, 0.157]),
        accent: parseColor(config.accent, [0.671, 0.667, 0.678]),
        high: parseColor(config.high, [0.949, 0.949, 0.957]),
      };
    };
    refreshColors();

    let raf = 0;
    let last = performance.now();
    let clock = 0;
    let isVisible = true;
    let isTabActive = !document.hidden;
    // Paused while the user scrolls: the last frame stays on screen, so the
    // frosted-glass cards above it don't have to re-blur a moving background.
    let isPaused = false;

    // Respect prefers-reduced-motion
    const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    const render = (now) => {
      if (!isVisible || !isTabActive || isPaused) {
        raf = 0;
        return;
      }

      raf = requestAnimationFrame(render);

      // Throttle to 30 FPS
      if (now - last < FRAME_INTERVAL) return;
      const dt = Math.min(0.1, (now - last) / 1000);
      last = now;

      if (!prefersReducedMotion) {
        clock = (clock + dt * 1.2 * config.speed) % 6283;
      }

      const dpr = Math.min(window.devicePixelRatio || 1, MAX_DPR);
      const cw = canvas.clientWidth || window.innerWidth;
      const ch = canvas.clientHeight || window.innerHeight;
      const bw = Math.max(1, Math.round(cw * dpr));
      const bh = Math.max(1, Math.round(ch * dpr));

      if (canvas.width !== bw || canvas.height !== bh) {
        canvas.width = bw;
        canvas.height = bh;
      }
      gl.viewport(0, 0, bw, bh);

      const pitchCss = Math.min(bw, bh) / dpr / config.density;

      gl.uniform2f(u('uRes'), bw, bh);
      gl.uniform1f(u('uTime'), clock);
      gl.uniform1f(u('uDpr'), dpr);
      gl.uniform1f(u('uCell'), Math.max(2, pitchCss * dpr));
      gl.uniform1f(u('uFill'), config.dotSize);
      gl.uniform1f(u('uCenter'), config.center);
      gl.uniform1f(u('uDrop'), config.drop);
      gl.uniform1f(u('uThick'), config.thickness);
      gl.uniform1f(u('uFall'), config.falloff);
      gl.uniform3f(u('uBg'), colors.bg[0], colors.bg[1], colors.bg[2]);
      gl.uniform3f(u('uBase'), colors.base[0], colors.base[1], colors.base[2]);
      gl.uniform3f(u('uAccent'), colors.accent[0], colors.accent[1], colors.accent[2]);
      gl.uniform3f(u('uHigh'), colors.high[0], colors.high[1], colors.high[2]);

      gl.drawArrays(gl.TRIANGLES, 0, 3);
    };

    raf = requestAnimationFrame(render);

    const resumeLoop = () => {
      if (isVisible && isTabActive && !isPaused && !raf) {
        last = performance.now();
        raf = requestAnimationFrame(render);
      }
    };

    // Performance Optimization: Pause rendering when post-hero sections are off-screen or tab is hidden
    const postHeroWrapper = document.getElementById('postHeroWrapper');
    let observer = null;
    if (postHeroWrapper && 'IntersectionObserver' in window) {
      observer = new IntersectionObserver(
        (entries) => {
          entries.forEach((entry) => {
            isVisible = entry.isIntersecting;
            if (isVisible) resumeLoop();
          });
        },
        { threshold: 0.01 }
      );
      observer.observe(postHeroWrapper);
    }

    const onVisibilityChange = () => {
      isTabActive = !document.hidden;
      if (isTabActive) {
        resumeLoop();
      } else if (raf) {
        cancelAnimationFrame(raf);
        raf = 0;
      }
    };
    document.addEventListener('visibilitychange', onVisibilityChange);

    return {
      destroy: () => {
        if (raf) cancelAnimationFrame(raf);
        document.removeEventListener('visibilitychange', onVisibilityChange);
        if (observer) observer.disconnect();
      },
      setPaused: (paused) => {
        isPaused = !!paused;
        if (isPaused) {
          if (raf) cancelAnimationFrame(raf);
          raf = 0;
        } else {
          resumeLoop();
        }
      },
      updateConfig: (newOpts) => {
        Object.assign(config, newOpts);
        if ('bg' in newOpts || 'base' in newOpts || 'accent' in newOpts || 'high' in newOpts) {
          refreshColors();
        }
      },
    };
  };

  // Auto-initialize if canvas exists
  // Colours come exclusively from the page's own theme variables (style.css :root / [data-theme="light"]).
  function readThemeColors() {
    const cs = getComputedStyle(document.documentElement);
    const v = (name, fb) => (cs.getPropertyValue(name).trim() || fb);
    const isLight = document.documentElement.getAttribute('data-theme') === 'light';
    return isLight
      ? {
          // Light: bg #cac9cc → cells darken smoothly through card / muted / text tones
          bg: v('--bg-color', '#cac9cc'),
          base: v('--bg-card', '#b8b7ba'),
          accent: v('--muted', '#4e4d52'),
          high: v('--text-primary', '#121214'),
        }
      : {
          // Dark: bg #121214 → cells lift through hover / text / highlight tones
          bg: v('--bg-color', '#121214'),
          base: v('--bg-hover', '#232328'),
          accent: v('--text-primary', '#abaaad'),
          high: v('--text-highlight', '#f2f2f4'),
        };
  }

  document.addEventListener('DOMContentLoaded', () => {
    const canvas = document.getElementById('pixelArcCanvas');
    if (canvas) {
      const theme = readThemeColors();
      const arcInstance = window.initPixelArc(canvas, {
        background: theme.bg,
        baseColor: theme.base,
        accentColor: theme.accent,
        highlight: theme.high,
        density: 135,
        dotSize: 80,
        speed: 30, // Calm, smooth drift
        arc: {
          center: 48,
          drop: 35,
          thickness: 42,
          falloff: 500,
        },
      });

      // Re-sync shader colours whenever the theme toggle flips data-theme
      if (arcInstance) {
        new MutationObserver(() => {
          const t = readThemeColors();
          arcInstance.updateConfig({ bg: t.bg, base: t.base, accent: t.accent, high: t.high });
        }).observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });
      }

      // ------------------------------------------------------------------
      // Hero → Post-Hero scroll transition
      //   progress r: 0 when the post-hero area starts entering from the bottom,
      //               1 when its top reaches the top of the viewport.
      //   • Crossfade : --hero-exit fades the hero LetterGlitch, --arc-reveal fades the Arc in
      //   • Arc Sunrise: the arc band rises from below the fold to its resting position
      // ------------------------------------------------------------------
      const wrapper = document.getElementById('postHeroWrapper');
      const rootStyle = document.documentElement.style;
      const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

      const ARC_REST_CENTER = 0.48;  // matches arc.center (48) above
      const ARC_START_CENTER = 1.15; // just below the bottom edge of the viewport
      const ARC_REST_THICK = 0.42;
      const ARC_START_THICK = 0.26;

      const clamp01 = (n) => (n < 0 ? 0 : n > 1 ? 1 : n);
      const easeOutCubic = (t) => 1 - Math.pow(1 - t, 3);
      const smooth = (t) => t * t * (3 - 2 * t);

      let ticking = false;
      let lastR = -1;

      const updateTransition = () => {
        ticking = false;
        if (!wrapper) return;
        const vh = window.innerHeight || 1;
        const top = wrapper.getBoundingClientRect().top;
        const r = clamp01(1 - top / vh);
        if (Math.abs(r - lastR) < 0.001) return;
        lastR = r;

        rootStyle.setProperty('--hero-exit', smooth(r).toFixed(3));
        rootStyle.setProperty('--arc-reveal', smooth(clamp01(r * 1.15)).toFixed(3));

        if (arcInstance && !reduceMotion) {
          const e = easeOutCubic(r);
          arcInstance.updateConfig({
            center: ARC_START_CENTER + (ARC_REST_CENTER - ARC_START_CENTER) * e,
            thickness: ARC_START_THICK + (ARC_REST_THICK - ARC_START_THICK) * e,
          });
        }
      };

      // Pause the arc animation while scrolling once the hero→arc transition has
      // finished (lastR >= 1). During the transition it keeps running so the
      // "sunrise" still animates. Resumes 180ms after scrolling stops.
      let scrollIdleTimer = 0;
      const SCROLL_IDLE_MS = 180;

      const onScroll = () => {
        if (!ticking) {
          ticking = true;
          requestAnimationFrame(updateTransition);
        }
        if (arcInstance && lastR >= 1) {
          arcInstance.setPaused(true);
          clearTimeout(scrollIdleTimer);
          scrollIdleTimer = setTimeout(() => arcInstance.setPaused(false), SCROLL_IDLE_MS);
        } else if (arcInstance) {
          arcInstance.setPaused(false);
        }
      };

      window.addEventListener('scroll', onScroll, { passive: true });
      window.addEventListener('resize', onScroll, { passive: true });
      updateTransition();
    }
  });
})();
