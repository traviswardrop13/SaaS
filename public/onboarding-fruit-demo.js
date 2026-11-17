/* Onboarding-only Fruit Slice preview. Uses the game's painted fruit; no
   microphone, speech result, score, purchases, or saved progress. */
(function () {
  'use strict';
  var TYPES = [
    { key: 'apple', crop: [40, 33, 305, 319], juice: '#ef5b48' },
    { key: 'orange', crop: [38, 33, 315, 330], juice: '#ffb72f' },
    { key: 'watermelon', crop: [13, 43, 360, 305], juice: '#ff6573' },
    { key: 'grapes', crop: [38, 16, 321, 356], juice: '#ab70dc' },
    { key: 'lemon', crop: [49, 32, 325, 321], juice: '#ffd85a' }
  ];
  var images = {};

  window.SonaFruitDemo = {
    mount: function (scene) {
      var canvas = scene && scene.querySelector('canvas.demo-canvas');
      if (!canvas) return { setSlow: function () {}, destroy: function () {} };
      var ctx = canvas.getContext('2d');
      if (!ctx) return { setSlow: function () {}, destroy: function () {} };
      var W = 1, H = 1, dpr = Math.min(2, window.devicePixelRatio || 1);
      var fruits = [], halves = [], drops = [], swipes = [];
      var slow = false, alive = true, raf = 0, last = 0, time = 0;
      var nextFruit = 0, serial = 0, pointer = null;
      var reduced = window.matchMedia('(prefers-reduced-motion: reduce)');
      var resizeObserver, imageListeners = [];
      canvas.dataset.demoSpeed = 'normal';

      function loadArt() {
        TYPES.forEach(function (type) {
          var img = images[type.key];
          if (!img) {
            img = new Image();
            images[type.key] = img;
            img.src = '/assets/crafted/fruit-' + type.key + '.webp';
          }
          if (!img.complete) {
            var onLoad = function () { if (alive && reduced.matches) drawStill(); };
            img.addEventListener('load', onLoad, { once: true });
            imageListeners.push({ img: img, onLoad: onLoad });
          }
        });
      }

      function fit() {
        if (!alive) return;
        var box = scene.getBoundingClientRect();
        W = Math.max(1, box.width); H = Math.max(1, box.height);
        canvas.width = Math.round(W * dpr); canvas.height = Math.round(H * dpr);
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
        if (reduced.matches) drawStill();
        else paint();
      }

      function createFruit() {
        var n = serial++;
        var size = Math.max(40, Math.min(68, W * 0.175));
        var top = Math.min(H * 0.40, Math.max(110, H * 0.36));
        var rise = Math.max(80, H + size - top);
        var total = 1.32;
        return {
          type: TYPES[n % TYPES.length],
          x: W * [0.28, 0.67, 0.44, 0.76, 0.24][n % 5],
          y: H + size * 0.55,
          vx: W * [0.16, -0.17, 0.11, -0.23, 0.19][n % 5],
          vy: -4 * rise / total,
          gravity: 8 * rise / (total * total),
          size: size, age: 0, angle: (n % 3 - 1) * 0.25,
          spin: (n % 2 ? -1 : 1) * 1.6,
          sliceAt: 0.60 + (n % 3) * 0.045
        };
      }

      function fruitImage(f, side) {
        var img = images[f.type.key];
        var size = f.size, c = f.type.crop;
        ctx.save();
        ctx.translate(f.x, f.y); ctx.rotate(f.angle);
        if (side) {
          ctx.beginPath();
          ctx.rect(side < 0 ? -size : 0, -size, size, size * 2);
          ctx.clip();
        }
        if (img && img.complete && img.naturalWidth) {
          var scale = size / Math.max(c[2], c[3]);
          var width = c[2] * scale, height = c[3] * scale;
          ctx.drawImage(img, c[0], c[1], c[2], c[3], -width / 2, -height / 2, width, height);
        } else {
          // A small vector fallback until the real game illustration decodes.
          ctx.fillStyle = f.type.juice;
          ctx.beginPath(); ctx.arc(0, 0, size * 0.44, 0, Math.PI * 2); ctx.fill();
          ctx.fillStyle = '#659b48';
          ctx.beginPath(); ctx.ellipse(size * 0.12, -size * 0.42, size * 0.16, size * 0.07, -0.5, 0, Math.PI * 2); ctx.fill();
        }
        ctx.restore();
      }

      function slice(f, from, to) {
        if (f.cut) return;
        f.cut = true;
        var a = from || { x: f.x - f.size * 1.1, y: f.y + f.size * 0.55 };
        var b = to || { x: f.x + f.size * 1.1, y: f.y - f.size * 0.55 };
        swipes.push({ a: a, b: b, age: 0, life: 0.19 });
        [-1, 1].forEach(function (side) {
          halves.push({ type: f.type, x: f.x + side * 5, y: f.y, size: f.size, angle: f.angle,
            vx: f.vx + side * 88, vy: -78 + side * 18, spin: side * 3.2,
            gravity: f.gravity * 0.65, side: side, age: 0 });
        });
        for (var i = 0; i < 10; i++) {
          var angle = i * Math.PI * 2 / 10;
          var speed = 42 + (i % 4) * 21;
          drops.push({ x: f.x, y: f.y, vx: Math.cos(angle) * speed, vy: Math.sin(angle) * speed - 22,
            color: f.type.juice, radius: 2 + (i % 3), age: 0, life: 0.45 + (i % 3) * 0.06 });
        }
      }

      function advance(dt) {
        time += dt;
        if (time >= nextFruit) {
          fruits.push(createFruit());
          nextFruit = time + [0.38, 0.31, 0.49, 0.34][serial % 4];
        }
        fruits.forEach(function (f) {
          f.age += dt; f.vy += f.gravity * dt;
          f.x += f.vx * dt; f.y += f.vy * dt; f.angle += f.spin * dt;
          if (f.age >= f.sliceAt) slice(f);
        });
        fruits = fruits.filter(function (f) { return !f.cut && f.age < 1.6; });
        halves.forEach(function (f) {
          f.age += dt; f.x += f.vx * dt; f.vy += f.gravity * dt;
          f.y += f.vy * dt; f.angle += f.spin * dt;
        });
        halves = halves.filter(function (f) { return f.age < 0.8 && f.y < H + f.size; });
        drops.forEach(function (p) {
          p.age += dt; p.x += p.vx * dt; p.vy += 280 * dt; p.y += p.vy * dt;
        });
        drops = drops.filter(function (p) { return p.age < p.life; });
        swipes.forEach(function (s) { s.age += dt; });
        swipes = swipes.filter(function (s) { return s.age < s.life; });
      }

      function drawSwipe(s) {
        var opacity = Math.max(0, 1 - s.age / s.life);
        ctx.save(); ctx.globalAlpha = opacity; ctx.lineCap = 'round';
        ctx.strokeStyle = '#ffd47c'; ctx.lineWidth = 11;
        ctx.beginPath(); ctx.moveTo(s.a.x, s.a.y);
        ctx.quadraticCurveTo((s.a.x + s.b.x) / 2, s.b.y + 7, s.b.x, s.b.y); ctx.stroke();
        ctx.strokeStyle = '#fffef2'; ctx.lineWidth = 4; ctx.stroke();
        ctx.restore();
      }

      function paint() {
        ctx.clearRect(0, 0, W, H);
        // The overlay controls own the top. Fruit and juice remain below them.
        ctx.save(); ctx.beginPath(); ctx.rect(0, 92, W, Math.max(0, H - 92)); ctx.clip();
        drops.forEach(function (p) {
          ctx.globalAlpha = Math.max(0, 1 - p.age / p.life);
          ctx.fillStyle = p.color; ctx.beginPath(); ctx.arc(p.x, p.y, p.radius, 0, Math.PI * 2); ctx.fill();
        });
        ctx.globalAlpha = 1;
        halves.forEach(function (f) { fruitImage(f, f.side); });
        fruits.forEach(function (f) { fruitImage(f); });
        swipes.forEach(drawSwipe);
        ctx.restore();
      }

      function drawStill() {
        if (!alive) return;
        var size = Math.max(40, Math.min(68, W * 0.175));
        fruits = [
          { type: TYPES[1], x: W * 0.27, y: H * 0.69, size: size, angle: -0.22 },
          { type: TYPES[2], x: W * 0.72, y: Math.max(125, H * 0.50), size: size * 1.08, angle: 0.22 }
        ];
        halves = [-1, 1].map(function (side) {
          return { type: TYPES[0], x: W * 0.46 + side * size * 0.18,
            y: Math.max(145, H * 0.61) - side * 7, size: size, angle: side * 0.18, side: side };
        });
        drops = [];
        swipes = [{ a: { x: W * 0.27, y: H * 0.69 }, b: { x: W * 0.66, y: Math.max(125, H * 0.51) }, age: 0, life: 1 }];
        paint();
      }

      function tick(now) {
        raf = 0;
        if (!alive || document.hidden || reduced.matches) return;
        var dt = last ? Math.min(0.035, (now - last) / 1000) : 0;
        last = now;
        advance(dt * (slow ? 0.45 : 1));
        paint();
        raf = requestAnimationFrame(tick);
      }

      function restart() {
        cancelAnimationFrame(raf); raf = 0; last = 0;
        if (!alive || document.hidden) return;
        if (reduced.matches) drawStill();
        else raf = requestAnimationFrame(tick);
      }

      function motionChange() {
        fruits = []; halves = []; drops = []; swipes = []; nextFruit = time;
        restart();
      }
      function point(event) {
        var box = canvas.getBoundingClientRect();
        return { x: (event.clientX - box.left) * W / box.width, y: (event.clientY - box.top) * H / box.height };
      }
      function down(event) {
        pointer = point(event);
        if (canvas.setPointerCapture) { try { canvas.setPointerCapture(event.pointerId); } catch (e) {} }
      }
      function move(event) {
        if (!pointer || reduced.matches) return;
        var to = point(event), from = pointer;
        var dx = to.x - from.x, dy = to.y - from.y, length = dx * dx + dy * dy;
        if (length < 4) return;
        fruits.forEach(function (f) {
          var t = length ? Math.max(0, Math.min(1, ((f.x - from.x) * dx + (f.y - from.y) * dy) / length)) : 0;
          if (Math.hypot(f.x - from.x - t * dx, f.y - from.y - t * dy) < f.size * 0.55) slice(f, from, to);
        });
        swipes.push({ a: from, b: to, age: 0, life: 0.13 });
        pointer = to;
      }
      function up() { pointer = null; }
      canvas.addEventListener('pointerdown', down);
      canvas.addEventListener('pointermove', move);
      canvas.addEventListener('pointerup', up);
      canvas.addEventListener('pointercancel', up);
      document.addEventListener('visibilitychange', restart);
      if (reduced.addEventListener) reduced.addEventListener('change', motionChange);
      else reduced.addListener(motionChange);
      if (window.ResizeObserver) { resizeObserver = new ResizeObserver(fit); resizeObserver.observe(scene); }
      else window.addEventListener('resize', fit);
      loadArt(); fit(); restart();

      return {
        setSlow: function (value) {
          slow = !!value;
          canvas.dataset.demoSpeed = slow ? 'after-practice' : 'normal';
          if (reduced.matches) drawStill();
        },
        destroy: function () {
          if (!alive) return;
          alive = false; cancelAnimationFrame(raf);
          if (resizeObserver) resizeObserver.disconnect();
          else window.removeEventListener('resize', fit);
          document.removeEventListener('visibilitychange', restart);
          if (reduced.removeEventListener) reduced.removeEventListener('change', motionChange);
          else reduced.removeListener(motionChange);
          canvas.removeEventListener('pointerdown', down);
          canvas.removeEventListener('pointermove', move);
          canvas.removeEventListener('pointerup', up);
          canvas.removeEventListener('pointercancel', up);
          imageListeners.forEach(function (item) { item.img.removeEventListener('load', item.onLoad); });
          imageListeners = [];
          fruits = []; halves = []; drops = []; swipes = []; pointer = null;
          ctx.clearRect(0, 0, W, H);
        }
      };
    }
  };
}());
