/*!
 * Idle Sketch — a director's notebook that draws itself when the pointer rests.
 * One file, no dependencies, Canvas 2D. Load it at the end of the page, then call
 *
 *   IdleSketch.start({ idleDelay: 1300 });
 *
 * The cursor stops for ~1.3 s → a scene is drawn next to it, stroke by stroke,
 * like a hand thinking: a frame, a viewfinder, a note written and crossed out.
 * Any movement, scroll or click → the ink fades in 0.4 s. Nothing is drawn over
 * links, buttons, video or media. Touch devices and prefers-reduced-motion: off.
 * The layer is a fixed canvas with pointer-events:none — it never takes a click,
 * a scroll or a text selection.
 *
 * Adding a scene: see IdleSketch.addScene() at the bottom, or IDLE-SKETCH.md.
 */
(function (global) {
  'use strict';

  /* ------------------------------------------------------------------ config */
  var DEFAULTS = {
    idleDelay: 1300,        // ms of stillness before the first scene
    nextDelay: 1100,        // ms between scenes while the pointer keeps resting
    maxPerRest: 3,          // scenes per stop of the mouse; then the hand waits for the next stop
    hold: 1500,             // ms a finished scene stays before it dries away
    dryOut: 700,            // ms a finished scene takes to fade on its own
    fadeOut: 400,           // ms to fade when the pointer moves
    offset: [30, 26],       // px from the cursor to the scene's near corner
    margin: 14,             // px the scene keeps from the viewport edges
    topSafe: 60,            // px kept free under a fixed header
    scale: 1,               // overall size of drawings and handwriting
    tempo: .78,             // pace of the hand: < 1 draws faster, > 1 slower (strokes and pauses)
    boil: 110,              // ms per "boil" frame of the line (0 = still line)
    jitter: 0.45,           // px of hand jitter on every point (0.3–0.6)
    colors: { ink: '#17150f', red: '#bf3a20', blue: '#1e46cc',
              inkDark: '#e9e5d9', redDark: '#e0664a', blueDark: '#8fa6ff' },
    blueChance: 0.12,       // how often a scene writes its notes in blue
    weights: {},            // per-scene probability weights, e.g. { frame: 2, blot: 0.5 }
    ignore: 'a,button,input,select,textarea,label,summary,video,iframe,audio,[role="button"],[contenteditable],.frame,.cell,.lp-play,#mvLight',
    zIndex: 190
  };

  /* ------------------------------------------------ single-stroke handwriting
     Glyphs on a 0–10 grid (baseline y=10, x-height 5, ascender 1, descender 13).
     "x,y x,y …" is one stroke, "|" starts the next. Lowercase = hand,
     uppercase = printed marker. Add a character by adding one line here. */
  var G = {
    a:'4.2,6.2 3,5 1.4,5.3 .4,7.3 .9,9.4 2.2,10 3.6,9.2 4.2,7.4|4.2,5.1 4.1,8.6 4.8,10',
    b:'.8,.8 .6,10|.7,7 1.8,5.3 3.4,5.2 4.4,6.8 4.2,9 2.8,10 1.5,9.7 .7,8.6',
    c:'4,6 3,5 1.5,5.2 .5,7.2 .9,9.3 2.3,10 3.5,9.7 4.2,9',
    d:'4,6.4 3,5 1.5,5.2 .5,7.2 .9,9.3 2.3,10 3.6,9.2 4.1,7.5|4.3,.8 4.1,8.8 4.7,10',
    e:'.8,7.6 4.1,7.3 3.9,6 2.7,5 1.3,5.4 .5,7.3 .9,9.3 2.3,10 3.6,9.7 4.3,9',
    f:'3.8,1.5 2.9,.8 1.9,1.2 1.6,3 1.5,10|.3,5.2 3.4,5.1',
    g:'4,6.4 3,5 1.5,5.2 .5,7.1 .9,9 2.3,9.6 3.6,8.9 4.1,7.2|4.2,5.1 4,11.8 3,13 1.5,13 .6,12.2',
    h:'.8,.8 .7,10|.8,7 1.9,5.3 3.3,5.2 4.1,6.4 4.1,10',
    i:'1.2,5.3 1.1,9.4 1.7,10|1.2,2.9 1.3,3.2',
    j:'2,5.3 2,12 1.2,13 .2,12.6|2.1,2.9 2.2,3.2',
    k:'.8,.8 .7,10|3.9,5.1 .8,8|1.9,7.1 4.1,10',
    l:'1,.8 1,9.2 1.6,10',
    m:'.6,5.2 .6,10|.6,6.8 1.5,5.3 2.6,5.4 3,6.6 3,10|3,6.6 3.9,5.3 5,5.4 5.5,6.6 5.5,10',
    n:'.7,5.2 .7,10|.7,6.9 1.8,5.3 3.2,5.2 4,6.4 4,10',
    o:'2.3,5 1,5.5 .4,7.5 1,9.4 2.4,10 3.8,9.4 4.3,7.4 3.7,5.6 2.3,5 1.6,5.3',
    p:'.7,5.2 .6,13|.7,7 1.8,5.3 3.4,5.2 4.4,6.9 4.2,9 2.8,10 1.5,9.7 .7,8.6',
    q:'4,6.4 3,5 1.5,5.2 .5,7.2 .9,9.3 2.3,10 3.6,9.2 4.1,7.5|4.2,5.1 4.1,13 4.8,12.3',
    r:'.7,5.2 .7,10|.7,7.2 1.6,5.5 2.8,5.1 3.6,5.5',
    s:'3.6,5.8 2.5,5 1.2,5.3 .9,6.5 2,7.4 3.3,8 3.7,9.2 2.6,10 1.1,9.8 .4,9',
    t:'1.6,1.8 1.5,9.2 2.3,10 3.2,9.6|.2,5.2 3.2,5.1',
    u:'.7,5.2 .7,8.8 1.5,10 2.8,9.9 3.8,8.6|3.9,5.2 3.9,9.3 4.5,10',
    v:'.2,5.2 2,10 3.9,5.2',
    w:'.1,5.2 1.4,10 2.7,6.4 4,10 5.3,5.2',
    x:'.4,5.2 3.8,10|3.8,5.2 .4,10',
    y:'.3,5.2 2,9.6|3.9,5.2 1.6,12 .8,13 .1,12.7',
    z:'.5,5.3 3.8,5.2 .4,10 4,9.9',
    '0':'2.2,1 .9,1.8 .4,5.5 .9,9.2 2.2,10 3.5,9.2 4,5.5 3.5,1.8 2.2,1',
    '1':'.9,2.6 2.3,1 2.3,10',
    '2':'.5,2.6 1.5,1.1 2.9,1 3.9,2.2 3.8,3.9 .4,10 4.1,9.9',
    '3':'.5,1.9 1.8,1 3.3,1.3 3.8,2.8 3.1,4.5 1.8,5.1 3.3,5.5 4,7.3 3.6,9.2 2.2,10 .4,9.2',
    '4':'3.2,10 3.1,1 .2,7.2 4.2,7.1',
    '5':'3.8,1.1 1,1.1 .7,4.8 2,4.3 3.4,4.7 4,6.8 3.6,9.1 2.2,10 .4,9.3',
    '6':'3.5,1.4 2.4,1 1.1,1.9 .4,5 .5,8.4 1.6,9.9 3,9.9 3.9,8.6 3.8,6.7 2.8,5.6 1.5,5.8 .5,7',
    '7':'.4,1.1 4,1.1 1.6,10',
    '8':'2.2,5.3 3.6,4.4 3.7,2.2 2.5,1 1.2,1.4 .8,3 1.6,4.6 3.3,5.7 4,7.7 3.4,9.5 2.1,10 .8,9.4 .4,7.6 1,6.1 2.2,5.3',
    '9':'3.9,4.2 2.9,5.3 1.4,5.2 .5,3.8 .8,1.8 2.1,1 3.4,1.4 4,3.2 3.9,6.6 3.2,9.2 2,10 .8,9.6',
    ':':'.6,5.3 .7,5.6|.6,9.6 .7,9.9', '.':'.6,9.6 .7,9.9', ',':'.9,9.4 .9,10.3 .4,11.4',
    "'":'.8,1 .6,3', '’':'.8,1 .6,3', '?':'.5,2.6 1.5,1.1 2.9,1 3.8,2.3 3.4,4 2.1,5.4 2,7.2|2,9.6 2.1,9.9',
    '!':'.9,1 .8,7.3|.8,9.6 .9,9.9', '/':'3.5,.8 .3,10.8', '-':'.4,6.8 3,6.6', '+':'2,4 2,8.6|.2,6.3 3.8,6.3',
    '·':'.6,6.5 .7,6.8', '#':'1.4,2 .8,10|3.2,2 2.6,10|.2,4.6 3.8,4.6|0,7.6 3.6,7.6',
    A:'.3,10 2.3,1 4.3,10|1.1,6.6 3.5,6.6',
    B:'.6,10 .6,1 2.6,1 3.6,1.9 3.6,4.2 2.6,5.3 .6,5.3|2.6,5.3 3.9,6.3 3.9,9 2.8,10 .6,10',
    C:'4,2.2 3,1 1.6,1.1 .5,3.2 .4,7.6 1.4,9.8 3,10 4,8.9',
    D:'.6,10 .6,1 2.3,1 3.7,2.5 4,5.5 3.7,8.6 2.3,10 .6,10',
    E:'4,1 .6,1 .6,10 4,10|.6,5.4 3.2,5.4', F:'4,1 .6,1 .6,10|.6,5.4 3.2,5.4',
    G:'4,2.2 3,1 1.6,1.1 .5,3.2 .4,7.6 1.4,9.8 3,10 4,8.9 4,6.2 2.6,6.2',
    H:'.6,1 .6,10|4,1 4,10|.6,5.4 4,5.4', I:'.8,1 .8,10', J:'3.4,1 3.4,8.4 2.6,9.9 1.3,10 .4,8.9',
    K:'.6,1 .6,10|4,1 .7,6.2|1.9,4.9 4.1,10', L:'.6,1 .6,10 3.9,10', M:'.5,10 .6,1 2.6,6.8 4.6,1 4.7,10',
    N:'.6,10 .6,1 4,10 4,1', O:'2.3,1 .9,1.9 .4,5.5 .9,9.1 2.3,10 3.7,9.1 4.2,5.5 3.7,1.9 2.3,1',
    P:'.6,10 .6,1 2.8,1 3.9,2.1 3.9,4.3 2.8,5.5 .6,5.5',
    Q:'2.3,1 .9,1.9 .4,5.5 .9,9.1 2.3,10 3.7,9.1 4.2,5.5 3.7,1.9 2.3,1|2.7,7.6 4.4,10.4',
    R:'.6,10 .6,1 2.8,1 3.9,2.1 3.9,4.3 2.8,5.5 .6,5.5|2.2,5.5 4.1,10',
    S:'3.8,2 2.6,1 1.2,1.2 .6,2.8 1.3,4.4 3.2,5.6 3.9,7.4 3.4,9.4 2,10 .4,9',
    T:'.2,1 4.4,1|2.3,1 2.3,10', U:'.6,1 .6,7.8 1.4,9.7 2.4,10 3.4,9.7 4.1,7.8 4.1,1',
    V:'.2,1 2.2,10 4.2,1', W:'.1,1 1.3,10 2.6,4.4 3.9,10 5.1,1', X:'.4,1 4,10|4,1 .4,10',
    Y:'.3,1 2.2,5.4 4.1,1|2.2,5.4 2.2,10', Z:'.5,1 4,1 .4,10 4.1,10'
  };
  var GLYPH = {};
  Object.keys(G).forEach(function (k) {
    var strokes = G[k].split('|').map(function (s) {
      return s.trim().split(/\s+/).map(function (p) { var v = p.split(','); return [+v[0], +v[1]]; });
    });
    var w = 0; strokes.forEach(function (st) { st.forEach(function (p) { w = Math.max(w, p[0]); }); });
    GLYPH[k] = { strokes: strokes, w: w };
  });

  /* ------------------------------------------------------------------ helpers */
  var rnd = Math.random;
  function R(a, b) { return a + rnd() * (b - a); }
  function pick(a) { return a[Math.floor(rnd() * a.length)]; }
  function dist(a, b) { return Math.hypot(b[0] - a[0], b[1] - a[1]); }
  function lengthOf(p) { var L = 0; for (var i = 1; i < p.length; i++) L += dist(p[i - 1], p[i]); return L; }
  function catmull(p, n) {                 // smooth a hand stroke through its points
    if (p.length < 3) return p.slice();
    var out = [p[0]];
    for (var i = 0; i < p.length - 1; i++) {
      var p0 = p[i - 1] || p[i], p1 = p[i], p2 = p[i + 1], p3 = p[i + 2] || p2;
      for (var t = 1; t <= n; t++) {
        var s = t / n, s2 = s * s, s3 = s2 * s;
        out.push([
          .5 * ((2 * p1[0]) + (-p0[0] + p2[0]) * s + (2 * p0[0] - 5 * p1[0] + 4 * p2[0] - p3[0]) * s2 + (-p0[0] + 3 * p1[0] - 3 * p2[0] + p3[0]) * s3),
          .5 * ((2 * p1[1]) + (-p0[1] + p2[1]) * s + (2 * p0[1] - 5 * p1[1] + 4 * p2[1] - p3[1]) * s2 + (-p0[1] + 3 * p1[1] - 3 * p2[1] + p3[1]) * s3)
        ]);
      }
    }
    return out;
  }
  function wobbleLine(a, b, n, amp) {      // a straight line as a hand would draw it
    var out = [], nx = -(b[1] - a[1]), ny = b[0] - a[0], L = Math.hypot(nx, ny) || 1; nx /= L; ny /= L;
    var ph = R(0, 6), bow = R(-1, 1) * amp;
    for (var i = 0; i <= n; i++) {
      var t = i / n, w = Math.sin(t * Math.PI) * bow + Math.sin(t * 7 + ph) * amp * .25;
      out.push([a[0] + (b[0] - a[0]) * t + nx * w, a[1] + (b[1] - a[1]) * t + ny * w]);
    }
    return out;
  }
  function ellipse(cx, cy, rx, ry, turns, start, n) {
    var out = [], ph = R(0, 6);
    for (var i = 0; i <= n; i++) {
      var t = start + i / n * Math.PI * 2 * turns, k = 1 + Math.sin(t * 2 + ph) * .05 + i / n * .06;
      out.push([cx + Math.cos(t) * rx * k, cy + Math.sin(t) * ry * k]);
    }
    return out;
  }

  /* --------------------------------------------------------- scene builder
     A scene function receives S and describes itself in local coordinates
     (0,0 = top-left). Every call is appended to a timeline: S.wait() adds a
     pause, { at: ms } overrides the start. Order: object, notes, corrections. */
  function Builder(ctxInfo) {
    var items = [], T = 0, box = [Infinity, Infinity, -Infinity, -Infinity], cfg = ctxInfo.cfg, sc = cfg.scale;
    var palette = ctxInfo.palette, noteColor = rnd() < cfg.blueChance ? 'blue' : 'ink';
    function grow(pts, pad) { pts.forEach(function (p) { box[0] = Math.min(box[0], p[0] - pad); box[1] = Math.min(box[1], p[1] - pad); box[2] = Math.max(box[2], p[0] + pad); box[3] = Math.max(box[3], p[1] + pad); }); }
    var tempo = cfg.tempo || 1;
    function add(it, dur, o) {
      dur *= tempo; it.t0 = (o && o.at != null) ? o.at : T; it.dur = dur; items.push(it);
      if (!(o && o.at != null)) T = it.t0 + dur;
      return it;
    }
    function col(c) { return palette[c || 'ink'] || c; }
    var S = {
      word: ctxInfo.word, note: noteColor,
      R: R, pick: pick,
      wait: function (ms) { T += ms * tempo; return S; },
      now: function () { return T; },
      // a hand line through points; speed in px/s; w = base weight
      line: function (pts, o) {
        o = o || {};
        var p = o.smooth === false ? pts : catmull(pts, o.sub || 3);
        var L = lengthOf(p), sp = (o.speed || 340) * R(.8, 1.2);
        grow(p, 4);
        return add({ type: 'line', pts: p, L: L, w: (o.w || 1.6) * sc, color: col(o.color), ease: o.ease !== false, marker: !!o.marker, dash: o.dash, alpha: o.alpha || 1 },
          Math.max(70, L / sp * 1000), o);
      },
      stroke: function (a, b, o) { o = o || {}; return S.line(wobbleLine(a, b, o.n || 10, o.amp == null ? 1.2 : o.amp), Object.assign({ smooth: false }, o)); },
      rect: function (x, y, w, h, o) {          // four separate strokes with small overshoots
        o = o || {}; var os = o.over == null ? 5 : o.over;
        S.stroke([x - os * R(.3, 1), y + R(-1, 1)], [x + w + os * R(.3, 1), y + R(-1.5, 1.5)], o); S.wait(R(20, 70));
        S.stroke([x + w + R(-1, 1), y - os * R(.2, .8)], [x + w + R(-1.5, 1.5), y + h + os * R(.3, 1)], o); S.wait(R(20, 70));
        S.stroke([x + w + os * R(.2, .8), y + h + R(-1, 1)], [x - os * R(.3, 1), y + h + R(-1.5, 1.5)], o); S.wait(R(20, 70));
        S.stroke([x + R(-1, 1), y + h + os * R(.2, .8)], [x + R(-1.5, 1.5), y - os * R(.3, 1)], o);
        return S;
      },
      arrow: function (pts, o) {                // a curve ending in a two-stroke head
        o = o || {}; var it = S.line(pts, o), p = it.pts, n = p.length, a = p[n - 1], b = p[Math.max(0, n - 4)];
        var ang = Math.atan2(a[1] - b[1], a[0] - b[0]), hl = (o.head || 9) * sc;
        S.wait(R(40, 110));
        S.stroke([a[0] - Math.cos(ang - .45) * hl, a[1] - Math.sin(ang - .45) * hl], a, Object.assign({}, o, { n: 3, amp: .4 }));
        S.stroke(a, [a[0] - Math.cos(ang + .45) * hl, a[1] - Math.sin(ang + .45) * hl], Object.assign({}, o, { n: 3, amp: .4 }));
        return S;
      },
      dot: function (x, y, r, o) { o = o || {}; grow([[x, y]], r + 2); return add({ type: 'dot', x: x, y: y, r: (r || 1.8) * sc, color: col(o.color) }, 45, o); },
      rec: function (x, y, r, o) { o = o || {}; grow([[x, y]], r + 2); return add({ type: 'rec', x: x, y: y, r: (r || 3.6) * sc, color: col(o.color || 'red') }, 120, o); },
      blot: function (x, y, r, o) {
        o = o || {}; var n = 22, pts = [], ph = R(0, 6), ph2 = R(0, 6), sq = R(.75, 1);
        for (var i = 0; i < n; i++) { var t = i / n * Math.PI * 2, k = .82 + .16 * Math.sin(t * 2 + ph) + .09 * Math.sin(t * 5 + ph2) + R(-.07, .07); pts.push([x + Math.cos(t) * r * k * sc, y + Math.sin(t) * r * k * sq * sc]); }
        var tail = R(0, 6.28); pts.splice(Math.round(tail / 6.283 * n) % n, 0, [x + Math.cos(tail) * r * 1.55 * sc, y + Math.sin(tail) * r * 1.4 * sc]);
        var spl = []; for (var j = 0; j < 5; j++) { var a2 = R(0, 6.28), d = r * R(1.3, 2.2) * sc; spl.push([x + Math.cos(a2) * d, y + Math.sin(a2) * d, R(.7, 1.9) * sc]); }
        grow(pts, 3); spl.forEach(function (s) { grow([[s[0], s[1]]], 3); });
        return add({ type: 'blot', pts: catmull(pts.concat([pts[0]]), 3), spl: spl, color: col(o.color), x: x, y: y }, 280, o);
      },
      // handwriting (style 'hand') or printed marker (style 'marker'), baseline at y
      text: function (str, x, y, o) {
        o = o || {}; var marker = o.style === 'marker', size = (o.size || (marker ? 2.1 : 2.5)) * sc;
        if (marker) str = str.toUpperCase();
        var cx = x, slant = marker ? .05 : .17, gap = marker ? 1.35 : .95, c = col(o.color || S.note), first = true;
        var speed = (o.speed || (marker ? 300 : 330)) * R(.85, 1.15);
        for (var i = 0; i < str.length; i++) {
          var ch = str[i];
          if (ch === ' ') { cx += (marker ? 3.2 : 2.6) * size; S.wait(R(60, 150)); continue; }
          var g = GLYPH[ch] || GLYPH[ch.toLowerCase()]; if (!g) { cx += 2.5 * size; continue; }
          var ls = size * (marker ? 1 : R(.94, 1.06)), by = R(-.6, .6) * sc, rot = marker ? 0 : R(-.05, .05);
          for (var k = 0; k < g.strokes.length; k++) {
            var pts = g.strokes[k].map(function (p) {
              var gx = p[0], gy = p[1] - 10, rx = gx * Math.cos(rot) - gy * Math.sin(rot), ry = gx * Math.sin(rot) + gy * Math.cos(rot);
              return [cx + (rx - slant * ry) * ls, y + by + ry * ls];
            });
            if (pts.length === 2 && dist(pts[0], pts[1]) < ls * .6) { S.dot(pts[0][0], pts[0][1], marker ? 1.5 : 1.25, { color: o.color || S.note }); continue; }
            var p2 = marker ? pts : catmull(pts, 3), L = lengthOf(p2);
            grow(p2, 3);
            add({ type: 'line', pts: p2, L: L, w: (o.w || (marker ? 2.4 : 1.35)) * sc, color: c, ease: true, marker: marker, alpha: 1 },
              Math.max(32, L / speed * 1000) * (first ? 1.25 : 1));
            first = false; S.wait(R(5, 20));
          }
          cx += (g.w + gap) * ls; S.wait(R(4, 26));
          if (rnd() < .05) S.wait(R(110, 260));   // the hand stops to think
        }
        S.lastText = { x: x, y: y, w: cx - x, h: 10 * size }; return S;
      },
      textWidth: function (str, o) {
        o = o || {}; var marker = o.style === 'marker', size = (o.size || (marker ? 2.1 : 2.5)) * sc, w = 0;
        if (marker) str = str.toUpperCase();
        for (var i = 0; i < str.length; i++) { var ch = str[i]; if (ch === ' ') { w += (marker ? 3.2 : 2.6) * size; continue; } var g = GLYPH[ch] || GLYPH[ch.toLowerCase()]; w += ((g ? g.w : 2.5) + (marker ? 1.35 : .95)) * size; }
        return w;
      },
      done: function () { return { items: items, box: box, length: T }; }
    };
    return S;
  }

  /* ------------------------------------------------------------ scene library
     Timings are approximate (the hand varies): draw time + hold 1.5 s + dry 0.7 s. */
  var COPY = {
    notes: ['closer', 'wider', 'darker', 'hold', 'softer light', 'hold 3 sec', 'slower', 'tighter', 'more haze', 'rack focus', 'golden hour', 'again', 'almost'],
    takes: ['take 1', 'take 2', 'one more', 'one more take', 'wider', 'from the top'],
    fixes: ['print it', 'take 2', 'closer', 'no, differently', "that's a wrap", 'keep rolling', 'reset'],
    marks: ['!!', 'yes', 'keep', 'this', 'cut?', 'better?'],
    ratios: [[16 / 9, '16:9'], [2.39, '2.39:1'], [1.85, '1.85:1']]
  };
  var SCENES = {
    // 1 · frame, rule-of-thirds ticks, aspect note (~2.2 s)
    frame: function (S) {
      var r = S.pick(COPY.ratios), w = S.R(140, 170), h = w / r[0];
      S.rect(0, 0, w, h, { w: 1.7, speed: 420 });
      S.wait(120);
      [1 / 3, 2 / 3].forEach(function (t) { S.stroke([w * t, h * .08], [w * t, h * .2], { w: .9, amp: .3, n: 3, speed: 300 }); S.stroke([w * t, h * .8], [w * t, h * .92], { w: .9, amp: .3, n: 3, speed: 300 }); });
      S.wait(220);
      S.text(S.pick([r[1], r[1], '24 fps', 'wide']), w - S.textWidth(r[1]) + 6, h + 24);
    },
    // 2 · viewfinder brackets, centre cross, REC (~2.0 s)
    viewfinder: function (S) {
      var w = S.R(150, 175), h = w * 9 / 16, c = 18;
      [[0, 0, 1, 1], [w, 0, -1, 1], [w, h, -1, -1], [0, h, 1, -1]].forEach(function (k) {
        S.line([[k[0] + k[2] * c, k[1]], [k[0], k[1]], [k[0], k[1] + k[3] * c]], { w: 1.8, smooth: false, speed: 260 }); S.wait(S.R(40, 110));
      });
      S.stroke([w / 2 - 7, h / 2], [w / 2 + 7, h / 2], { w: 1.1, n: 3, amp: .3 }); S.stroke([w / 2, h / 2 - 7], [w / 2, h / 2 + 7], { w: 1.1, n: 3, amp: .3 });
      S.wait(180);
      S.rec(12, 14, 3.8);
      S.text('rec', 20, 19, { style: 'marker', size: 1.35, color: 'red' });
      S.text('24 fps', w - 44, h - 8, { style: 'marker', size: 1.2 });
    },
    // 3 · storyboard panel: horizon, a figure, "scene 12" (~3.0 s)
    storyboard: function (S) {
      var w = 128, h = 72;
      S.rect(0, 0, w, h, { w: 1.6, speed: 460, over: 3 });
      S.wait(160);
      S.stroke([6, h * .66], [w - 6, h * .6], { w: 1, amp: 1.6, n: 14, speed: 380 });
      var fx = S.R(30, 50), fy = h * .64;
      S.line(ellipse(fx, fy - 30, 5, 5.6, 1.05, -1.2, 14), { w: 1.3, speed: 200 });
      S.stroke([fx, fy - 24], [fx + 1, fy - 8], { w: 1.3, n: 4, amp: .5 });
      S.stroke([fx - 7, fy - 18], [fx + 8, fy - 16], { w: 1.2, n: 4, amp: .5 });
      S.stroke([fx + 1, fy - 8], [fx - 5, fy + 2], { w: 1.2, n: 3, amp: .4 }); S.stroke([fx + 1, fy - 8], [fx + 7, fy + 2], { w: 1.2, n: 3, amp: .4 });
      S.wait(120);
      S.arrow([[w * .82, h * .32], [w * .7, h * .3], [w * .6, h * .34]], { w: 1.1, head: 6 });
      S.wait(200);
      S.text('scene 12', 2, h + 22);
      S.text('sh 3', 78, h + 22, { color: 'red', size: 2.1 });
    },
    // 4 · write, cross out in red, write the new line (~3.2 s)
    strike: function (S) {
      var a = S.pick(COPY.takes), b = S.pick(COPY.fixes.filter(function (x) { return x !== a; }));
      S.text(a, 0, 24, { color: 'ink' });
      var t = S.lastText; S.wait(320);
      S.stroke([t.x - 4, t.y - t.h * .3], [t.x + t.w + 4, t.y - t.h * .34], { color: 'red', w: 1.9, amp: 1.1, n: 12, speed: 420 });
      if (S.R(0, 1) < .5) S.stroke([t.x - 2, t.y - t.h * .22], [t.x + t.w + 2, t.y - t.h * .27], { color: 'red', w: 1.5, amp: 1, n: 10, speed: 480 });
      S.wait(260);
      S.text(b, 10, 58, { color: 'red' });
    },
    // 5 · arrow and a note (~2.1 s)
    arrowNote: function (S) {
      var up = S.R(0, 1) < .5;
      S.arrow(up ? [[0, 56], [20, 34], [48, 20], [78, 16]] : [[0, 4], [22, 22], [50, 34], [80, 36]], { w: 1.6, speed: 280 });
      S.wait(200);
      var note = S.pick(COPY.notes);
      S.text(note, 90, up ? 22 : 42);
      if (S.R(0, 1) < .4) { var t = S.lastText; S.wait(120); S.stroke([t.x, t.y + 6], [t.x + t.w, t.y + 5], { w: 1.2, n: 8, amp: .9 }); }
    },
    // 6 · loop around the word under the cursor (~1.8 s); skipped when there is none
    circle: function (S) {
      var wd = S.word; if (!wd) return false;
      var cx = wd.w / 2, cy = wd.h / 2;
      S.line(ellipse(cx, cy, wd.w / 2 + 10, wd.h / 2 + 8, 1.22, -2.4, 38), { color: 'red', w: 1.8, speed: 520 });
      S.wait(220);
      S.text(S.pick(COPY.marks), wd.w + 18, cy + 8, { color: 'red', size: 2.3 });
      return { anchorToWord: true };
    },
    // 7 · nervous hatching over a block, then "no" (~2.4 s)
    scribble: function (S) {
      var w = S.R(80, 105), h = S.R(30, 42), pts = [], n = Math.round(w / 5);
      for (var i = 0; i <= n; i++) { var x = i / n * w; pts.push([x + S.R(-2, 2), (i % 2 ? h : 0) + S.R(-3, 3)]); }
      S.line(pts, { w: 1.3, smooth: false, speed: 900, alpha: .9 });
      S.wait(120);
      S.line(pts.map(function (p, i) { return [p[0] + 2.5, i % 2 ? 2 : h - 2]; }).reverse(), { w: 1, smooth: false, speed: 1100, alpha: .8 });
      S.wait(260);
      S.text('no', w + 16, h / 2 + 10, { color: 'red', size: 2.8 });
      var t = S.lastText; S.wait(100);
      S.stroke([t.x - 2, t.y + 6], [t.x + t.w + 3, t.y + 4], { color: 'red', w: 1.4, n: 6, amp: .6 });
    },
    // 8 · camera move: dashed path with an arrow, "dolly in" (~2.6 s)
    cameraPath: function (S) {
      S.rect(0, 30, 18, 12, { w: 1.4, over: 2, speed: 380 });
      S.line([[18, 33], [25, 29], [25, 43], [18, 39]], { w: 1.3, smooth: false, speed: 260 });
      S.wait(150);
      var p = [[32, 36], [70, 12], [115, 10], [150, 30]];
      S.line(p, { w: 1.3, dash: [6, 6], speed: 260 });
      var a = [150, 30], ang = Math.atan2(30 - 18, 150 - 138);
      S.stroke([a[0] - Math.cos(ang - .5) * 8, a[1] - Math.sin(ang - .5) * 8], a, { w: 1.3, n: 2, amp: .3 });
      S.stroke(a, [a[0] - Math.cos(ang + .5) * 8, a[1] - Math.sin(ang + .5) * 8], { w: 1.3, n: 2, amp: .3 });
      S.wait(220);
      S.text(S.pick(['dolly in', 'push in', 'pan left', 'crane up']), 58, 62);
    },
    // 9 · ink blot, "better?" (~1.7 s)
    blot: function (S) {
      S.blot(14, 18, 10);
      S.wait(420);
      S.text(S.pick(['better?', 'better?', 'almost', 'again']), 38, 26);
    },
    // 10 · slate: TAKE 07 in a box, timecode, sc / sh / tk (~3.4 s)
    timecode: function (S) {
      var tk = ('0' + Math.floor(S.R(2, 14))).slice(-2), f = ('0' + Math.floor(S.R(0, 23))).slice(-2), s = ('0' + Math.floor(S.R(3, 58))).slice(-2);
      S.text('take ' + tk, 6, 22, { style: 'marker', size: 2.1, speed: 380 });
      var t = S.lastText; S.wait(160);
      S.rect(t.x - 6, t.y - t.h - 5, t.w + 6, t.h + 11, { w: 1.4, over: 3, speed: 520 });
      S.wait(200);
      S.text('00:00:' + s + ':' + f, 4, 50, { style: 'marker', size: 1.35, speed: 380 });
      S.wait(160);
      S.text('sc 12 / tk ' + (+tk), 2, 76, { size: 2.05 });
    },
    // 11 · the same word three times, then the answer in red (~3.0 s)
    repeat: function (S) {
      var wd = S.pick(['think', 'think', 'wait', 'again']), x = 0;
      for (var i = 0; i < 3; i++) { S.text(wd, x + S.R(-2, 3), 20 + i * 24, { color: 'ink', speed: 420 + i * 60 }); x += S.R(-1, 4); S.wait(S.R(60, 140)); }
      S.wait(200);
      var t = S.lastText;
      S.line([[t.x + t.w + 12, 8], [t.x + t.w + 18, 34], [t.x + t.w + 12, 64]], { w: 1.3, smooth: true, speed: 300 });
      S.wait(160);
      S.text(wd === 'think' ? 'shoot' : S.pick(['print it', 'cut?']), t.x + t.w + 26, 44, { color: 'red', size: 2.7 });
    },
    // 12 · lighting plot: lamp, rays, actor, arrow, labels (~3.0 s)
    lighting: function (S) {
      S.line(ellipse(14, 18, 9, 9, 1.08, -1, 20), { w: 1.6, speed: 220 });
      for (var i = 0; i < 5; i++) { var a = -1.1 + i * .55, r1 = 13, r2 = 19; S.stroke([14 + Math.cos(a) * r1, 18 + Math.sin(a) * r1], [14 + Math.cos(a) * r2, 18 + Math.sin(a) * r2], { w: 1.1, n: 2, amp: .2, speed: 260 }); }
      S.wait(160);
      var ax = 126, ay = 58;
      S.line(ellipse(ax, ay - 20, 4.5, 5, 1.05, -1.2, 12), { w: 1.3 });
      S.stroke([ax, ay - 15], [ax + 1, ay], { w: 1.3, n: 3, amp: .4 }); S.stroke([ax - 6, ay - 10], [ax + 7, ay - 9], { w: 1.2, n: 3, amp: .3 });
      S.stroke([ax + 1, ay], [ax - 4, ay + 9], { w: 1.2, n: 2, amp: .3 }); S.stroke([ax + 1, ay], [ax + 6, ay + 9], { w: 1.2, n: 2, amp: .3 });
      S.wait(140);
      S.arrow([[30, 28], [60, 40], [96, 48], [112, 50]], { w: 1.4, speed: 300, head: 7 });
      S.wait(180);
      S.text('key', 2, 52, { size: 2.2 });
      S.text(S.pick(['softer', 'softer light', 'warmer', 'lower']), 52, 74, { color: 'red', size: 2.2 });
    }
  };

  /* ----------------------------------------------------------------- renderer */
  var cfg = null, cv = null, ctx = null, W = 0, H = 0, DPR = 1, raf = null, running = false;
  var mx = -1, my = -1, lastMove = 0, idleAt = 0, overIgnored = false, scene = null, lastName = null, nextAt = 0, timer = null, perRest = 0;
  var fading = null;   // { t0, dur } while the ink dries after movement

  function size() { DPR = Math.min(2, global.devicePixelRatio || 1); W = innerWidth; H = innerHeight; }
  // the canvas is only as big as the scene and sits where the scene is: a small layer to composite
  function fit(sc) {
    var pad = 10, x0 = Math.floor(sc.box[0] - pad), y0 = Math.floor(sc.box[1] - pad), w = Math.ceil(sc.box[2] - sc.box[0] + pad * 2), h = Math.ceil(sc.box[3] - sc.box[1] + pad * 2);
    cv.width = w * DPR; cv.height = h * DPR; cv.style.left = x0 + 'px'; cv.style.top = y0 + 'px'; cv.style.width = w + 'px'; cv.style.height = h + 'px';
    ctx.setTransform(DPR, 0, 0, DPR, -x0 * DPR, -y0 * DPR); cv.style.display = 'block';
  }
  function wipe() { ctx.save(); ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.clearRect(0, 0, cv.width, cv.height); ctx.restore(); }
  function hide() { if (cv.style.display !== 'none') { wipe(); cv.style.display = 'none'; } }

  function groundIsDark(x, y) {           // look at what the ink would land on
    var el = document.elementFromPoint(Math.max(0, Math.min(W - 1, x)), Math.max(0, Math.min(H - 1, y)));
    while (el && el !== document.documentElement) {
      var bg = getComputedStyle(el).backgroundColor, m = bg && bg.match(/rgba?\(([\d.]+),\s*([\d.]+),\s*([\d.]+)(?:,\s*([\d.]+))?/);
      if (m && (m[4] === undefined || +m[4] > .5)) { var L = (.2126 * m[1] + .7152 * m[2] + .0722 * m[3]) / 255; return L < .42; }
      el = el.parentElement;
    }
    return false;
  }

  var WCH = /[\p{L}\p{N}'’\-]/u;
  function wordAt(x, y) {
    var r = null;
    if (document.caretRangeFromPoint) r = document.caretRangeFromPoint(x, y);
    else if (document.caretPositionFromPoint) { var cp = document.caretPositionFromPoint(x, y); if (cp) { r = document.createRange(); r.setStart(cp.offsetNode, cp.offset); } }
    if (!r || r.startContainer.nodeType !== 3) return null;
    var n = r.startContainer, s = n.nodeValue, i = Math.min(r.startOffset, s.length), a = i, b = i;
    while (a > 0 && WCH.test(s[a - 1])) a--; while (b < s.length && WCH.test(s[b])) b++;
    if (b - a < 3) return null;
    var wr = document.createRange(); wr.setStart(n, a); wr.setEnd(n, b); var rc = wr.getClientRects()[0];
    if (!rc || rc.height > 60 || x < rc.left - 4 || x > rc.right + 4 || y < rc.top - 6 || y > rc.bottom + 6) return null;
    return { x: rc.left, y: rc.top, w: rc.width, h: rc.height };
  }

  // what the ink should not land on: the line boxes of the text and the media rectangles near the hand.
  // Text nodes are indexed once by their parent; per scene only the parents near the cursor are measured.
  var textIndex = null, mediaEls = null;
  function indexPage() {
    textIndex = []; var map = new Map();
    var w = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT, { acceptNode: function (n) {
      var p = n.parentElement; if (!p || !/\S/.test(n.nodeValue) || /^(SCRIPT|STYLE|NOSCRIPT|CANVAS|SVG)$/.test(p.tagName)) return NodeFilter.FILTER_REJECT; return NodeFilter.FILTER_ACCEPT; } });
    var n; while ((n = w.nextNode())) { var p = n.parentElement, e = map.get(p); if (!e) { e = { el: p, nodes: [] }; map.set(p, e); textIndex.push(e); } e.nodes.push(n); }
    mediaEls = [].slice.call(document.querySelectorAll('img,video,iframe,.frame,.cell,figure'));
  }
  function obstacles(x0, y0, x1, y1) {
    if (!textIndex) indexPage();
    var out = [], rg = document.createRange();
    for (var i = 0; i < textIndex.length; i++) {
      var r = textIndex[i].el.getBoundingClientRect(); if (r.right < x0 || r.left > x1 || r.bottom < y0 || r.top > y1 || !r.width) continue;
      var nodes = textIndex[i].nodes;
      for (var k = 0; k < nodes.length; k++) { rg.selectNodeContents(nodes[k]); var rs = rg.getClientRects(); for (var j = 0; j < rs.length; j++) if (rs[j].width > 1) out.push([rs[j].left - 3, rs[j].top - 2, rs[j].right + 3, rs[j].bottom + 2, 1]); }
    }
    for (var m = 0; m < mediaEls.length; m++) { var q = mediaEls[m].getBoundingClientRect(); if (q.right < x0 || q.left > x1 || q.bottom < y0 || q.top > y1 || !q.width) continue; out.push([q.left, q.top, q.right, q.bottom, 2]); }
    return out;
  }
  // share of a box covered by type (weight 1) or media (weight 2); 0 = clear paper
  function busyness(obs, x0, y0, w, h) {
    var x1 = x0 + w, y1 = y0 + h, sum = 0;
    for (var i = 0; i < obs.length; i++) { var o = obs[i], ix = Math.min(x1, o[2]) - Math.max(x0, o[0]), iy = Math.min(y1, o[3]) - Math.max(y0, o[1]); if (ix > 0 && iy > 0) sum += ix * iy * o[4]; }
    return sum / (w * h);
  }
  // try spots around the cursor, keep the one that covers the least type; never cover the pointer
  function placeClear(lb, bw, bh) {
    var m = cfg.margin, o = cfg.offset, cands = [
      [o[0], o[1]], [o[0], -o[1] - bh], [-o[0] - bw, o[1]], [-o[0] - bw, -o[1] - bh],
      [o[0] + 70, -bh / 2], [-o[0] - bw - 70, -bh / 2], [-bw / 2, o[1] + 40], [-bw / 2, -o[1] - bh - 40],
      [o[0] + 150, o[1]], [-o[0] - bw - 150, o[1]]
    ], best = null, obs = obstacles(mx - bw - 240, my - bh - 90, mx + bw + 240, my + bh + 90);
    cands.forEach(function (c, i) {
      var x = Math.max(m, Math.min(W - m - bw, mx + c[0])), y = Math.max(cfg.topSafe, Math.min(H - m - bh, my + c[1]));
      if (mx > x - 10 && mx < x + bw + 10 && my > y - 10 && my < y + bh + 10) return;   // would sit on the pointer
      var dx = Math.max(x - mx, 0, mx - (x + bw)), dy = Math.max(y - my, 0, my - (y + bh));
      var score = busyness(obs, x, y, bw, bh) * 3 + Math.hypot(dx, dy) / 400 + i * .01;     // clear paper first, then close to the hand
      if (!best || score < best.s) best = { s: score, x: x, y: y };
    });
    if (!best) best = { x: Math.max(m, Math.min(W - m - bw, mx + o[0])), y: Math.max(cfg.topSafe, Math.min(H - m - bh, my + o[1])) };
    return [best.x - lb[0], best.y - lb[1]];
  }

  function chooseScene(skip) {
    var names = Object.keys(SCENES).filter(function (n) { return skip.indexOf(n) < 0; }), bag = [];
    names.forEach(function (n) { var w = cfg.weights[n] == null ? 1 : cfg.weights[n]; for (var i = 0; i < Math.round(w * 4); i++) bag.push(n); });
    return pick(bag.length ? bag : names);
  }

  function build(name) {
    var dark = groundIsDark(mx + cfg.offset[0], my + cfg.offset[1]), C = cfg.colors;
    var palette = dark ? { ink: C.inkDark, red: C.redDark, blue: C.blueDark } : { ink: C.ink, red: C.red, blue: C.blue };
    var word = name === 'circle' ? wordAt(mx, my) : null;
    var S = Builder({ cfg: cfg, palette: palette, word: word });
    var ret = SCENES[name](S);
    if (ret === false) return null;
    var d = S.done(); if (!d.items.length || !isFinite(d.box[0])) return null;
    var bw = d.box[2] - d.box[0], bh = d.box[3] - d.box[1], ox, oy, m = cfg.margin;
    if (ret && ret.anchorToWord) { ox = word.x; oy = word.y; }             // the loop sits on the word itself
    else {
      var best = placeClear(d.box, bw, bh); ox = best[0]; oy = best[1];
    }
    d.items.forEach(function (it) {                                                // precompute hand jitter + boil
      var pts = it.pts; if (!pts) return;
      it.j = [0, 1, 2].map(function () { return pts.map(function () { return [R(-1, 1) * cfg.jitter, R(-1, 1) * cfg.jitter]; }); });
    });
    return { name: name, items: d.items, length: d.length, ox: ox, oy: oy, t0: performance.now(), dark: dark, lbox: d.box, box: [ox + d.box[0], oy + d.box[1], ox + d.box[2], oy + d.box[3]] };
  }

  function easeIO(t) { return t < .5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2; }

  function drawLine(ctx, it, p, phase) {
    var pts = it.pts, J = it.j[phase], target = it.L * p, run = 0;
    ctx.strokeStyle = it.color; ctx.lineCap = it.marker ? 'square' : 'round'; ctx.lineJoin = 'round';
    if (it.dash) {                        // dashed camera path: one path, constant weight
      ctx.setLineDash(it.dash); ctx.lineWidth = it.w; ctx.beginPath(); ctx.moveTo(pts[0][0] + J[0][0], pts[0][1] + J[0][1]);
      for (var d = 1; d < pts.length; d++) { var sl = dist(pts[d - 1], pts[d]); if (run + sl > target) { var f = (target - run) / sl; ctx.lineTo(pts[d - 1][0] + (pts[d][0] - pts[d - 1][0]) * f, pts[d - 1][1] + (pts[d][1] - pts[d - 1][1]) * f); break; } run += sl; ctx.lineTo(pts[d][0] + J[d][0], pts[d][1] + J[d][1]); }
      ctx.stroke(); ctx.setLineDash([]); return;
    }
    // pen pressure: heavier at the start, lighter mid-stroke, a touch of ink at the end.
    // Neighbouring segments of near-equal weight share one path, so a long stroke costs a few calls.
    var curW = -1, open = false;
    for (var i = 1; i < pts.length; i++) {
      var a = pts[i - 1], b = pts[i], seg = dist(a, b); if (run >= target) break;
      var f2 = Math.min(1, (target - run) / (seg || 1)), u = (run + seg * .5) / (it.L || 1);
      var press = it.marker ? .9 + .1 * Math.sin(u * Math.PI) : .55 + .45 * Math.sin(Math.min(1, u * 1.15) * Math.PI) + (u < .06 ? .25 : 0);
      var w = Math.max(.5, Math.round(it.w * press * 6) / 6);
      var ax = a[0] + J[i - 1][0], ay = a[1] + J[i - 1][1];
      if (w !== curW) { if (open) ctx.stroke(); ctx.lineWidth = curW = w; ctx.beginPath(); ctx.moveTo(ax, ay); open = true; }
      ctx.lineTo(a[0] + (b[0] - a[0]) * f2 + J[i][0] * f2, a[1] + (b[1] - a[1]) * f2 + J[i][1] * f2);
      run += seg;
    }
    if (open) ctx.stroke();
  }

  function drawItem(c, it, p, lt, phase) {
    if (it.type === 'line') { var ga = c.globalAlpha; c.globalAlpha = ga * (it.alpha || 1); drawLine(c, it, p, phase); c.globalAlpha = ga; }
    else if (it.type === 'dot') { c.fillStyle = it.color; c.beginPath(); c.arc(it.x, it.y, it.r * Math.min(1, p * 1.3), 0, 6.283); c.fill(); }
    else if (it.type === 'rec') { if (lt < 400 || Math.floor(lt / 520) % 2 === 0) { c.fillStyle = it.color; c.beginPath(); c.arc(it.x, it.y, it.r * Math.min(1, p * 1.2), 0, 6.283); c.fill(); } }
    else if (it.type === 'blot') {
      var k = Math.min(1, p * 1.1); c.fillStyle = it.color; c.save(); c.translate(it.x, it.y); c.scale(k, k); c.translate(-it.x, -it.y);
      c.beginPath(); c.moveTo(it.pts[0][0], it.pts[0][1]); for (var q = 1; q < it.pts.length; q++) c.lineTo(it.pts[q][0], it.pts[q][1]); c.fill(); c.restore();
      if (p > .5) it.spl.forEach(function (s) { c.beginPath(); c.arc(s[0], s[1], s[2], 0, 6.283); c.fill(); });
    }
  }
  // finished strokes are painted once into three small canvases (one per boil phase);
  // each frame then costs one drawImage plus the strokes still being written
  function cacheFor(sc) {
    if (sc.cache) return sc.cache;
    var pad = 8, bw = Math.ceil(sc.lbox[2] - sc.lbox[0] + pad * 2), bh = Math.ceil(sc.lbox[3] - sc.lbox[1] + pad * 2);
    var cs = [0, 1, 2].map(function () { var c = document.createElement('canvas'); c.width = bw * DPR; c.height = bh * DPR; var x = c.getContext('2d'); x.setTransform(DPR, 0, 0, DPR, 0, 0); x.translate(pad - sc.lbox[0], pad - sc.lbox[1]); return { c: c, x: x }; });
    return (sc.cache = { cs: cs, pad: pad, bw: bw, bh: bh });
  }
  function render(now) {
    if (!scene) { hide(); return false; }
    if (scene.fitted !== true) { fit(scene); scene.fitted = true; }
    wipe();
    var t = now - scene.t0, alpha = 1, total = scene.length;
    if (fading) { alpha = 1 - (now - fading.t0) / fading.dur; if (alpha <= 0) { scene = null; fading = null; hide(); return false; } }
    else if (t > total + cfg.hold) { alpha = 1 - (t - total - cfg.hold) / cfg.dryOut; if (alpha <= 0) { lastName = scene.name; scene = null; nextAt = now + cfg.nextDelay; hide(); return false; } }
    var phase = cfg.boil ? Math.floor(now / cfg.boil) % 3 : 0, C = cacheFor(scene), blend = scene.dark ? 'screen' : 'multiply';
    if (cv.style.mixBlendMode !== blend) cv.style.mixBlendMode = blend;
    for (var i = 0; i < scene.items.length; i++) {      // move newly finished items into the cache
      var it = scene.items[i]; if (it.cached || it.type === 'rec' || t - it.t0 < it.dur) continue;
      for (var k = 0; k < 3; k++) drawItem(C.cs[k].x, it, 1, it.dur, k);
      it.cached = true;
    }
    ctx.save(); ctx.globalAlpha = Math.max(0, alpha);
    ctx.drawImage(C.cs[phase].c, scene.ox + scene.lbox[0] - C.pad, scene.oy + scene.lbox[1] - C.pad, C.bw, C.bh);
    ctx.translate(scene.ox, scene.oy);
    for (var j = 0; j < scene.items.length; j++) {
      var it2 = scene.items[j], lt = t - it2.t0; if (lt <= 0 || it2.cached) continue;
      var p = Math.min(1, lt / it2.dur); if (it2.ease) p = easeIO(p);
      drawItem(ctx, it2, p, lt, phase);
    }
    ctx.restore();
    return true;
  }

  function schedule() {                        // sleep until the pointer has been still long enough
    clearTimeout(timer); if (!running || mx < 0 || overIgnored) return;
    var d = Math.max(16, Math.max(idleAt, nextAt) - performance.now());
    timer = setTimeout(function () { if (!raf) raf = requestAnimationFrame(tick); }, d);
  }
  function tick(now) {
    raf = null; if (!running) return;
    if (!scene && !fading) {
      if (mx < 0 || overIgnored || document.hidden || now < idleAt || now < nextAt || perRest >= cfg.maxPerRest) { hide(); if (perRest < cfg.maxPerRest) schedule(); return; }
      var skip = lastName ? [lastName] : [];
      for (var tries = 0; tries < 5 && !scene; tries++) { var n = chooseScene(skip); if (!n) break; scene = build(n); if (!scene) skip.push(n); }
      if (!scene) { nextAt = now + cfg.nextDelay; schedule(); return; }
      perRest++;
    }
    if (render(now)) raf = requestAnimationFrame(tick); else schedule();
  }

  function stir() {                           // any movement, scroll or click
    lastMove = performance.now(); nextAt = 0; perRest = 0; idleAt = lastMove + cfg.idleDelay + R(-100, 200);
    if (scene && !fading) { fading = { t0: lastMove, dur: cfg.fadeOut }; lastName = scene.name; }
    if (scene || fading) { if (!raf && running) raf = requestAnimationFrame(tick); } else schedule();
  }
  function onMove(e) {
    var dx = e.clientX - mx, dy = e.clientY - my; mx = e.clientX; my = e.clientY;
    var t = e.target; overIgnored = !!(t && t.closest && t.closest(cfg.ignore));
    if (Math.abs(dx) + Math.abs(dy) > .5) stir();
  }

  /* --------------------------------------------------------------------- API */
  var IdleSketch = {
    scenes: SCENES, copy: COPY,
    start: function (opts) {
      if (running) return IdleSketch;
      cfg = Object.assign({}, DEFAULTS, opts || {}); cfg.colors = Object.assign({}, DEFAULTS.colors, (opts && opts.colors) || {});
      if (!global.matchMedia || !matchMedia('(pointer:fine)').matches || matchMedia('(prefers-reduced-motion: reduce)').matches) return IdleSketch;
      cv = document.createElement('canvas'); cv.setAttribute('aria-hidden', 'true');
      cv.style.cssText = 'position:fixed;left:0;top:0;width:0;height:0;display:none;pointer-events:none;mix-blend-mode:multiply;z-index:' + cfg.zIndex;
      document.body.appendChild(cv); ctx = cv.getContext('2d'); size();
      addEventListener('resize', function () { size(); textIndex = null; }); document.addEventListener('mousemove', onMove, { passive: true });
      addEventListener('scroll', stir, { passive: true }); addEventListener('wheel', stir, { passive: true });
      document.addEventListener('mousedown', stir); document.addEventListener('keydown', function (e) { if (!IdleSketch._keys) stir(); });
      document.addEventListener('mouseleave', function () { mx = -1; stir(); });
      running = true; lastMove = performance.now(); idleAt = lastMove + cfg.idleDelay;
      return IdleSketch;
    },
    stop: function () { running = false; clearTimeout(timer); scene = null; fading = null; if (cv) hide(); return IdleSketch; },
    resume: function () { if (cv) { running = true; stir(); } return IdleSketch; },
    // draw a named scene at the pointer right now (for previews and tests)
    play: function (name) { if (!running || !SCENES[name]) return null; clearTimeout(timer); fading = null; scene = build(name); if (!raf) raf = requestAnimationFrame(tick); return scene; },
    // register a scene: fn(S) draws with S.line / stroke / rect / arrow / text / dot / blot / rec / wait
    addScene: function (name, fn, weight) { SCENES[name] = fn; if (weight != null && cfg) cfg.weights[name] = weight; return IdleSketch; },
    state: function () { return { scene: scene && scene.name, fading: !!fading, box: scene && scene.box, last: lastName }; }
  };
  global.IdleSketch = IdleSketch;
})(window);
