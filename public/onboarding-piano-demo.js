/* Local onboarding preview only: no audio, microphone, scores or saved progress. */
(function () {
  'use strict';

  window.SonaPianoDemo = {
    mount: function (scene) {
      var canvas = scene.querySelector('.demo-canvas');
      if (!canvas) return { setSlow: function () {}, destroy: function () {} };
      var ctx = canvas.getContext('2d');
      if (!ctx) return { setSlow: function () {}, destroy: function () {} };

      var colors = ['#ee8a9a', '#bfa3e2', '#a9df8b', '#86d9ef'];
      var art = ['coral', 'purple', 'green', 'blue'].map(function (name) {
        var img = new Image();
        img.onload = function () { if (!destroyed) paint(); };
        img.src = '/assets/crafted/game/tile-' + name + '.webp';
        return img;
      });
      var wood = new Image();
      wood.onload = function () { if (!destroyed) paint(); };
      wood.src = '/assets/crafted/painted-wood-ivory.webp';

      var width = 0, height = 0, hitY = 0, topY = 88;
      var notes = [], sparks = [], flashes = [0, 0, 0, 0];
      var pattern = [0, 2, 1, 3, 2, 0, 3, 1, 0, 3, 2, 1];
      var index = 0, nextNote = 0, songTime = 0.79;
      var slow = false, destroyed = false, raf = 0, last = 0;
      var reducedQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
      var reduced = reducedQuery.matches;
      var travel = 1.05, spacing = 0.36;

      canvas.setAttribute('role', 'img');
      canvas.setAttribute('aria-label', 'Piano Tiles demo: notes fall onto four piano keys.');

      function rounded(x, y, w, h, r) {
        r = Math.max(0, Math.min(r, w / 2, h / 2));
        ctx.beginPath();
        ctx.moveTo(x + r, y);
        ctx.arcTo(x + w, y, x + w, y + h, r);
        ctx.arcTo(x + w, y + h, x, y + h, r);
        ctx.arcTo(x, y + h, x, y, r);
        ctx.arcTo(x, y, x + w, y, r);
        ctx.closePath();
      }

      function fit() {
        if (destroyed) return;
        var box = scene.getBoundingClientRect();
        width = Math.max(1, box.width);
        height = Math.max(1, box.height);
        var dpr = Math.min(2, window.devicePixelRatio || 1);
        canvas.width = Math.round(width * dpr);
        canvas.height = Math.round(height * dpr);
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
        topY = Math.min(92, height * 0.3);
        hitY = height - Math.min(62, Math.max(47, height * 0.17));
        paint();
      }

      function noteFace(lane, y, alpha) {
        var laneW = width / 4;
        var w = Math.min(laneW - 14, 66), h = w * 1.25;
        var x = lane * laneW + (laneW - w) / 2;
        ctx.save();
        ctx.globalAlpha = alpha == null ? 1 : alpha;
        ctx.shadowColor = 'rgba(14,8,38,.3)';
        ctx.shadowBlur = 7;
        ctx.shadowOffsetY = 4;
        if (art[lane].complete && art[lane].naturalWidth) {
          ctx.drawImage(art[lane], x, y, w, h);
        } else {
          ctx.fillStyle = colors[lane];
          rounded(x, y, w, h, 14);
          ctx.fill();
          ctx.shadowColor = 'transparent';
          ctx.fillStyle = '#fff7d9';
          ctx.font = 'bold ' + Math.round(w * 0.72) + 'px sans-serif';
          ctx.textAlign = 'center';
          ctx.fillText('\u266a', x + w / 2, y + h * 0.73);
        }
        ctx.restore();
      }

      function hit(lane) {
        flashes[lane] = 1;
        if (reduced) return;
        var x = (lane + 0.5) * width / 4;
        for (var i = 0; i < 7; i++) {
          var angle = -Math.PI * (0.15 + i * 0.115);
          sparks.push({ x: x, y: hitY + 2, vx: Math.cos(angle) * (28 + i % 3 * 16),
            vy: Math.sin(angle) * (64 + i % 2 * 25), life: 0.5,
            color: i % 2 ? '#fff4ac' : colors[lane] });
        }
      }

      function paint() {
        if (destroyed || !width || !height) return;
        ctx.clearRect(0, 0, width, height);
        var laneW = width / 4;
        for (var lane = 0; lane < 4; lane++) {
          ctx.fillStyle = lane % 2 ? 'rgba(255,245,233,.018)' : 'rgba(19,9,48,.06)';
          ctx.fillRect(lane * laneW, topY, laneW, hitY - topY);
          if (lane) {
            ctx.fillStyle = 'rgba(244,222,255,.13)';
            ctx.fillRect(lane * laneW - 0.6, topY, 1.2, hitY - topY);
          }
        }

        // An actual four-key piano is the target; each note presses its own key.
        ctx.fillStyle = '#39284d';
        ctx.fillRect(0, hitY - 3, width, height - hitY + 3);
        for (lane = 0; lane < 4; lane++) {
          var glow = flashes[lane], x = lane * laneW + 2;
          var y = hitY + glow * 4, keyW = laneW - 4, keyH = height - y - 5;
          ctx.fillStyle = '#ad8d5e';
          rounded(x, y + 5, keyW, keyH, 7); ctx.fill();
          ctx.save();
          rounded(x, y, keyW, keyH - 4, 7); ctx.clip();
          ctx.fillStyle = '#fff7df'; ctx.fillRect(x, y, keyW, keyH);
          if (wood.complete && wood.naturalWidth) {
            ctx.drawImage(wood, x, y, keyW, keyH);
            ctx.fillStyle = 'rgba(255,251,229,.48)'; ctx.fillRect(x, y, keyW, keyH);
          }
          if (glow) {
            ctx.fillStyle = 'rgba(255,216,103,' + glow * 0.75 + ')';
            ctx.fillRect(x, y, keyW, keyH);
          }
          ctx.restore();
          ctx.strokeStyle = 'rgba(255,255,245,.8)';
          ctx.lineWidth = 1;
          rounded(x + 2, y + 2, keyW - 4, keyH - 8, 5); ctx.stroke();
          if (glow) {
            ctx.strokeStyle = 'rgba(255,244,176,' + glow + ')';
            ctx.lineWidth = 2;
            ctx.beginPath();
            ctx.ellipse(x + keyW / 2, hitY + 1, laneW * (0.28 + (1 - glow) * 0.2),
              5 + (1 - glow) * 10, 0, 0, Math.PI * 2);
            ctx.stroke();
          }
        }
        for (lane = 1; lane < 4; lane++) {
          ctx.fillStyle = '#211b35';
          rounded(lane * laneW - laneW * 0.14, hitY - 1, laneW * 0.28, 27, 3); ctx.fill();
          ctx.fillStyle = '#4b405f';
          rounded(lane * laneW - laneW * 0.14 + 2, hitY, laneW * 0.28 - 4, 22, 2); ctx.fill();
        }

        ctx.save();
        ctx.beginPath(); ctx.rect(0, topY - 2, width, hitY - topY + 3); ctx.clip();
        if (reduced) {
          noteFace(0, topY + (hitY - topY) * 0.08);
          noteFace(2, topY + (hitY - topY) * 0.44);
          noteFace(1, hitY - Math.min(laneW - 14, 66) * 1.25 + 8);
        } else {
          notes.forEach(function (note) {
            var progress = Math.min(1, (songTime - note.born) / travel);
            var tileH = Math.min(laneW - 14, 66) * 1.25;
            noteFace(note.lane, topY - tileH + progress * (hitY - topY));
          });
        }
        ctx.restore();
        sparks.forEach(function (spark) {
          ctx.save(); ctx.globalAlpha = Math.max(0, spark.life * 2);
          ctx.translate(spark.x, spark.y); ctx.rotate(spark.life * 3);
          ctx.fillStyle = spark.color;
          var r = 2.5 + spark.life * 3;
          ctx.beginPath(); ctx.moveTo(0, -r); ctx.lineTo(r * 0.4, -r * 0.3);
          ctx.lineTo(r, 0); ctx.lineTo(r * 0.3, r * 0.3); ctx.lineTo(0, r);
          ctx.lineTo(-r * 0.3, r * 0.3); ctx.lineTo(-r, 0); ctx.lineTo(-r * 0.3, -r * 0.3);
          ctx.closePath(); ctx.fill(); ctx.restore();
        });
      }

      function tick(now) {
        raf = 0;
        if (destroyed || document.hidden || reduced) return;
        var dt = last ? Math.min(0.05, (now - last) / 1000) : 0;
        last = now;
        songTime += dt * (slow ? travel / 2.65 : 1);
        while (songTime >= nextNote) {
          notes.push({ lane: pattern[index++ % pattern.length], born: nextNote });
          nextNote += spacing;
        }
        notes = notes.filter(function (note) {
          if (songTime - note.born < travel) return true;
          hit(note.lane); return false;
        });
        for (var i = 0; i < 4; i++) flashes[i] = Math.max(0, flashes[i] - dt * 3.3);
        sparks = sparks.filter(function (spark) {
          spark.life -= dt; spark.x += spark.vx * dt; spark.y += spark.vy * dt;
          spark.vy += dt * 125; return spark.life > 0;
        });
        paint();
        raf = window.requestAnimationFrame(tick);
      }

      function start() {
        if (!destroyed && !document.hidden && !reduced && !raf) {
          last = 0; raf = window.requestAnimationFrame(tick);
        }
      }
      function stop() { window.cancelAnimationFrame(raf); raf = 0; last = 0; }
      function visibility() { if (document.hidden) stop(); else start(); }
      function motion() {
        reduced = reducedQuery.matches;
        if (reduced) { stop(); sparks = []; paint(); } else start();
      }
      function pointer(event) {
        var box = canvas.getBoundingClientRect();
        if (event.clientY - box.top < hitY - 8) return;
        var lane = Math.min(3, Math.max(0, Math.floor((event.clientX - box.left) / laneWidth(box))));
        hit(lane); paint();
      }
      function laneWidth(box) { return box.width / 4 || 1; }

      document.addEventListener('visibilitychange', visibility);
      canvas.addEventListener('pointerdown', pointer);
      if (reducedQuery.addEventListener) reducedQuery.addEventListener('change', motion);
      else reducedQuery.addListener(motion);
      var observer = window.ResizeObserver ? new ResizeObserver(fit) : null;
      if (observer) observer.observe(scene); else window.addEventListener('resize', fit);
      fit(); start();

      return {
        setSlow: function (value) {
          slow = !!value;
          canvas.setAttribute('aria-label', 'Piano Tiles demo: ' + (slow ? 'slower' : 'fast') + ' notes fall onto four piano keys.');
          paint();
        },
        destroy: function () {
          destroyed = true; stop();
          document.removeEventListener('visibilitychange', visibility);
          canvas.removeEventListener('pointerdown', pointer);
          if (reducedQuery.removeEventListener) reducedQuery.removeEventListener('change', motion);
          else reducedQuery.removeListener(motion);
          if (observer) observer.disconnect(); else window.removeEventListener('resize', fit);
          art.forEach(function (img) { img.onload = null; }); wood.onload = null;
          notes = []; sparks = [];
        }
      };
    }
  };
}());
