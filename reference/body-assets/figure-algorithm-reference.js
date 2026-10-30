// Tally figure: a realistic 3D person that fills with colour from the feet up
// as the day's food is logged (carbs, then protein, then fat).
//
// The body is the MakeHuman base mesh (CC0) with its official targets blended
// for sex, muscle and weight from the person's numbers. Skin, clothes, hair,
// brows, lashes and eyes are MakeHuman's CC0 system assets, fitted to the
// morphed body the way MakeHuman fits them: each garment vertex hangs off
// three body vertices plus a scaled offset, so clothes follow every build.
// Needs vendor/three.min.js, vendor/human.js and vendor/human-look.js.
(function () {
  var T = window.THREE;
  if (T && T.ColorManagement && 'legacyMode' in T.ColorManagement) T.ColorManagement.legacyMode = false;
  var COLORS = { carbs: 0xf0b04a, protein: 0xe0553a, fat: 0x3d7a5b };
  var ORDER = ['carbs', 'protein', 'fat'];
  var reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var DEFAULTS = {
    male: { sex: 'male', heightCm: 178, weightKg: 74, age: 29 },
    female: { sex: 'female', heightCm: 165, weightKg: 62, age: 29 },
    neutral: { sex: 'neutral', heightCm: 172, weightKg: 68, age: 29 },
  };
  // What each figure wears.
  var OUTFIT = {
    male: ['outfit-male', 'hair-male', 'shoes', 'brows', 'lashes', 'eyes'],
    female: ['outfit-female', 'hair-female', 'shoes', 'brows', 'lashes', 'eyes'],
    neutral: ['outfit-male', 'hair-male', 'shoes', 'brows', 'lashes', 'eyes'],
  };

  function clamp(v, a, b) { return Math.max(a, Math.min(b, v)); }

  // Build from body numbers. Returns muscle and fat on a 0–1 scale.
  function buildOf(b) {
    var h = b.heightCm / 100;
    var bmi = b.weightKg / (h * h);
    var male = b.sex === 'male' ? 1 : b.sex === 'female' ? 0 : 0.5;
    var bf = b.bodyFat != null ? b.bodyFat : 1.2 * bmi + 0.23 * (b.age || 30) - 10.8 * male - 5.4; // Deurenberg
    var lean = b.weightKg * (1 - bf / 100);
    var ffmi = lean / (h * h);
    var ffmiBase = 14 + 3 * male, bfLow = 16 - 8 * male;
    return {
      muscle: clamp((ffmi - ffmiBase) / 6.5, 0, 1),
      fat: clamp((bf - bfLow) / 26, 0, 1),
      bmi: bmi,
      male: male,
      scale: h / 1.76,
      bf: bf,
      ffmi: ffmi,
    };
  }

  // ---- data ----------------------------------------------------------------
  function decode(s, Arr) {
    var bin = atob(s), u8 = new Uint8Array(bin.length);
    for (var i = 0; i < bin.length; i++) u8[i] = bin.charCodeAt(i);
    return new Arr(u8.buffer);
  }
  var HD = null, LOOK = {};
  function human() {
    if (HD || !window.TallyHumanData) return HD;
    var d = window.TallyHumanData;
    HD = {
      nv: d.nv, scale: d.scale, eyes: d.eyes,
      base: decode(d.base, Float32Array),
      body: { map: decode(d.body.map, Uint16Array), uv: decode(d.body.uv, Float32Array), tris: decode(d.body.tris, Uint16Array) },
      t: {},
    };
    Object.keys(d.targets).forEach(function (k) { HD.t[k] = { i: decode(d.targets[k].i, Uint16Array), d: decode(d.targets[k].d, Int16Array) }; });
    return HD;
  }
  function item(name) {
    if (LOOK[name] || !window.TallyHumanLook) return LOOK[name];
    var it = window.TallyHumanLook.items[name];
    if (!it) return null;
    LOOK[name] = {
      kind: it.kind, n: it.n, scale: it.scale, tex: it.tex, normal: it.normal,
      refs: decode(it.refs, Uint16Array), w: decode(it.w, Float32Array), off: decode(it.off, Float32Array),
      del: decode(it.del, Uint16Array), map: decode(it.map, Uint16Array), uv: decode(it.uv, Float32Array), tris: decode(it.tris, Uint16Array),
    };
    return LOOK[name];
  }

  var texCache = {};
  function texture(uri, color, onLoad) {
    if (!uri) return null;
    if (!texCache[uri]) {
      var t = new T.TextureLoader().load(uri, function () { (t.userData.wait || []).forEach(function (f) { f(); }); t.userData.ready = true; });
      t.userData.wait = [];
      if (color) t.encoding = T.sRGBEncoding;
      t.anisotropy = 4;
      texCache[uri] = t;
    }
    var tx = texCache[uri];
    if (onLoad) { if (tx.userData.ready) onLoad(); else tx.userData.wait.push(onLoad); }
    return tx;
  }

  function levels(v) {
    return v < 0.5 ? { min: 1 - 2 * v, average: 2 * v, max: 0 } : { min: 0, average: 2 - 2 * v, max: 2 * v - 1 };
  }

  // Morphed body: every base vertex (helpers too, since clothes hang on them),
  // normalised so the feet are on y = 0 and the body is 1.76 units tall.
  function morph(body) {
    var H = human(), B = buildOf(body);
    var mus = clamp(0.5 + (B.muscle - 0.33) * 0.95, 0, 1);
    var wt = clamp(0.5 + (B.bmi - 22) / (B.bmi < 22 ? 12 : 22) + (B.fat - 0.4) * 0.25, 0, 1);
    var pos = new Float32Array(H.base), inv = 1 / H.scale;
    function apply(t, k) {
      for (var j = 0; j < t.i.length; j++) {
        var o = t.i[j] * 3, q = j * 3;
        pos[o] += t.d[q] * inv * k; pos[o + 1] += t.d[q + 1] * inv * k; pos[o + 2] += t.d[q + 2] * inv * k;
      }
    }
    var gw = { female: 1 - B.male, male: B.male }, mw = levels(mus), ww = levels(wt);
    Object.keys(gw).forEach(function (g) {
      if (gw[g] < 0.001) return;
      if (H.t['shape-' + g]) apply(H.t['shape-' + g], gw[g]);
      Object.keys(mw).forEach(function (m) {
        Object.keys(ww).forEach(function (w) {
          var k = gw[g] * mw[m] * ww[w], t = H.t[g + '-' + m + 'muscle-' + w + 'weight'];
          if (k > 0.001 && t) apply(t, k);
        });
      });
    });
    // Proportions from a photo (or set by hand): each −1…1, 0 is the default.
    var shape = body.shape || {}, shapeKey = [];
    [['shoulders', 'shoulder-dist'], ['waist', 'waist-circ'], ['hips', 'hips-circ'], ['legs', 'upperleg-height']].forEach(function (s) {
      var val = clamp(shape[s[0]] || 0, -1, 1);
      shapeKey.push(Math.round(val * 10));
      var t = H.t[s[1] + (val > 0 ? '-incr' : '-decr')];
      if (t && Math.abs(val) > 0.01) apply(t, Math.abs(val));
    });
    var map = H.body.map, minY = 1e9, maxY = -1e9, sz = 0, n = 0, i, v;
    for (i = 0; i < map.length; i++) { v = map[i] * 3 + 1; if (pos[v] < minY) minY = pos[v]; if (pos[v] > maxY) maxY = pos[v]; }
    for (i = 0; i < map.length; i++) {
      v = map[i] * 3; var r = (pos[v + 1] - minY) / (maxY - minY);
      if (r > 0.45 && r < 0.7) { sz += pos[v + 2]; n++; }
    }
    var s = 1.76 / (maxY - minY), cz = n ? sz / n : 0;
    for (i = 0; i < pos.length; i += 3) { pos[i] *= s; pos[i + 1] = (pos[i + 1] - minY) * s; pos[i + 2] = (pos[i + 2] - cz) * s; }
    return { pos: pos, build: B, key: [B.male, Math.round(mus * 20), Math.round(wt * 20)].concat(shapeKey).join(':') };
  }

  // Smooth normals on the welded topology, then spread to the uv-split copies
  // so texture seams don't show as shading seams.
  function geometry(srcPos, nSrc, map, uv, tris, keep) {
    var acc = new Float32Array(nSrc * 3), idx = [], i;
    for (i = 0; i < tris.length; i += 3) {
      var a = tris[i], b = tris[i + 1], c = tris[i + 2];
      if (keep && !keep(a, b, c)) continue;
      idx.push(a, b, c);
      var A = map[a] * 3, Bv = map[b] * 3, C = map[c] * 3;
      var ux = srcPos[Bv] - srcPos[A], uy = srcPos[Bv + 1] - srcPos[A + 1], uz = srcPos[Bv + 2] - srcPos[A + 2];
      var vx = srcPos[C] - srcPos[A], vy = srcPos[C + 1] - srcPos[A + 1], vz = srcPos[C + 2] - srcPos[A + 2];
      var nx = uy * vz - uz * vy, ny = uz * vx - ux * vz, nz = ux * vy - uy * vx;
      [A, Bv, C].forEach(function (o) { acc[o] += nx; acc[o + 1] += ny; acc[o + 2] += nz; });
    }
    var p = new Float32Array(map.length * 3), nrm = new Float32Array(map.length * 3);
    for (i = 0; i < map.length; i++) {
      var o = map[i] * 3, l = Math.hypot(acc[o], acc[o + 1], acc[o + 2]) || 1;
      p[i * 3] = srcPos[o]; p[i * 3 + 1] = srcPos[o + 1]; p[i * 3 + 2] = srcPos[o + 2];
      nrm[i * 3] = acc[o] / l; nrm[i * 3 + 1] = acc[o + 1] / l; nrm[i * 3 + 2] = acc[o + 2] / l;
    }
    var g = new T.BufferGeometry();
    g.setAttribute('position', new T.BufferAttribute(p, 3));
    g.setAttribute('normal', new T.BufferAttribute(nrm, 3));
    g.setAttribute('uv', new T.BufferAttribute(uv, 2));
    g.setIndex(idx);
    return g;
  }

  // MakeHuman fitting: weighted sum of three body vertices plus an offset
  // scaled by how far apart two reference vertices are on this body.
  function fit(it, pos) {
    var out = new Float32Array(it.n * 3);
    var sc = { x: 1, y: 1, z: 1 };
    ['x', 'y', 'z'].forEach(function (ax, k) {
      var s = it.scale[ax];
      if (s) sc[ax] = Math.abs(pos[s[0] * 3 + k] - pos[s[1] * 3 + k]) / s[2];
    });
    for (var i = 0; i < it.n; i++) {
      var r = i * 3;
      for (var k = 0; k < 3; k++) {
        out[r + k] = it.w[r] * pos[it.refs[r] * 3 + k] + it.w[r + 1] * pos[it.refs[r + 1] * 3 + k] + it.w[r + 2] * pos[it.refs[r + 2] * 3 + k];
      }
      out[r] += it.off[r] * sc.x; out[r + 1] += it.off[r + 1] * sc.y; out[r + 2] += it.off[r + 2] * sc.z;
    }
    return out;
  }

  var cache = {};
  function person(body) {
    var H = human(), M = morph(body), sex = body.sex in OUTFIT ? body.sex : 'male';
    var key = sex + '|' + M.key;
    if (cache[key]) return { parts: cache[key], build: M.build };
    var names = OUTFIT[sex].filter(item);
    var hidden = new Uint8Array(H.nv);
    names.forEach(function (n) { var d = item(n).del; for (var i = 0; i < d.length; i++) hidden[d[i]] = 1; });
    var bm = H.body.map;
    var parts = [{ name: 'body', kind: 'skin', geo: geometry(M.pos, H.nv, bm, H.body.uv, H.body.tris, function (a, b, c) { return !(hidden[bm[a]] && hidden[bm[b]] && hidden[bm[c]]); }) }];
    names.forEach(function (n) {
      var it = item(n), fp = fit(it, M.pos);
      parts.push({ name: n, kind: it.kind, tex: it.tex, normal: it.normal, geo: geometry(fp, it.n, it.map, it.uv, it.tris) });
    });
    cache[key] = parts;
    return { parts: parts, build: M.build };
  }

  function planeAbove(y) { return new T.Plane(new T.Vector3(0, 1, 0), -y); }
  function planeBelow(y) { return new T.Plane(new T.Vector3(0, -1, 0), y); }

  // A soft studio to light the figure with: dim walls and a few bright panels,
  // baked into an environment map. Built once per renderer.
  function studio(renderer, dark) {
    var s = new T.Scene();
    var room = new T.Mesh(new T.BoxGeometry(10, 8, 10), new T.MeshBasicMaterial({ color: dark ? 0x0c0f0d : 0x9aa39c, side: T.BackSide }));
    room.position.y = 3;
    s.add(room);
    function panel(w, h, x, y, z, i, col) {
      var m = new T.Mesh(new T.PlaneGeometry(w, h), new T.MeshBasicMaterial({ color: new T.Color(col || 0xffffff).multiplyScalar(i), side: T.DoubleSide }));
      m.position.set(x, y, z); m.lookAt(0, 1, 0); s.add(m);
    }
    panel(3, 2.4, 2.8, 3.2, 3.2, dark ? 6 : 5);          // key softbox
    panel(1.4, 4, -3.6, 2.2, -2.4, dark ? 5 : 3, 0xffd6c4); // warm rim strip
    panel(2.5, 2, -3, 1.6, 3, dark ? 1.4 : 2.2);         // fill
    panel(5, 5, 0, 7.5, 0, dark ? 1.2 : 2.5);             // overhead
    var pm = new T.PMREMGenerator(renderer);
    var env = pm.fromScene(s, 0.04).texture;
    pm.dispose();
    return env;
  }

  function mount(canvas, opts) {
    opts = opts || {};
    if (!T || !canvas || !human()) return null;
    var renderer;
    try {
      renderer = new T.WebGLRenderer({ canvas: canvas, antialias: true, alpha: true });
    } catch (e) {
      canvas.setAttribute('data-nogl', '1');
      return null;
    }
    var dark = !!opts.dark;
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    renderer.localClippingEnabled = true;
    renderer.outputEncoding = T.sRGBEncoding;
    renderer.toneMapping = T.ACESFilmicToneMapping;
    renderer.toneMappingExposure = dark ? 1.05 : 0.95;
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = T.PCFSoftShadowMap;

    var scene = new T.Scene();
    scene.environment = studio(renderer, dark);
    var camera = new T.PerspectiveCamera(26, 1, 0.1, 50);
    var key = new T.DirectionalLight(0xfff4ea, dark ? 1.4 : 1.2);
    key.position.set(2.2, 4.2, 3.2);
    key.castShadow = true;
    key.shadow.mapSize.set(1024, 1024);
    key.shadow.camera.left = -1; key.shadow.camera.right = 1; key.shadow.camera.top = 2.2; key.shadow.camera.bottom = -0.3;
    key.shadow.radius = 6;
    key.shadow.bias = -0.0006;
    key.shadow.normalBias = 0.01;
    scene.add(key);
    var rim = new T.DirectionalLight(dark ? 0xffb39b : 0xffe6da, dark ? 1.6 : 0.7);
    rim.position.set(-3, 2.6, -3.2);
    scene.add(rim);

    var ground = new T.Mesh(new T.CircleGeometry(0.8, 64), new T.ShadowMaterial({ opacity: dark ? 0.55 : 0.22 }));
    ground.rotation.x = -Math.PI / 2;
    ground.receiveShadow = true;
    scene.add(ground);
    if (opts.disc !== false) {
      var disc = new T.Mesh(new T.CylinderGeometry(0.6, 0.62, 0.025, 72), new T.MeshStandardMaterial({ color: dark ? 0x18221c : 0xe6eae0, roughness: 0.85 }));
      disc.position.y = -0.0125;
      disc.receiveShadow = true;
      scene.add(disc);
    }

    var root = new T.Group();
    scene.add(root);
    var state = { fill: { carbs: 0, protein: 0, fat: 0 }, target: opts.fill || {}, body: null, hi: null, top: 1.76, skin: opts.skin || 'caucasian' };

    // Every material gets a band tint and the fill clipping. `layer` is
    // 'base' (above the fill) or a macro (inside its band).
    var mats = [];
    function makeMat(kind, layer, map, normal) {
      var m;
      if (kind === 'skin') m = new T.MeshPhysicalMaterial({ map: map, roughness: 0.52, metalness: 0, sheen: 0.35, sheenRoughness: 0.6, sheenColor: new T.Color(0xffb8a0), clearcoat: 0.08 });
      else if (kind === 'hair') m = new T.MeshStandardMaterial({ map: map, roughness: 0.55, metalness: 0, alphaTest: 0.45, side: T.DoubleSide });
      else if (kind === 'eyes') m = new T.MeshPhysicalMaterial({ map: map, roughness: 0.1, clearcoat: 1 });
      else m = new T.MeshStandardMaterial({ map: map, normalMap: normal || null, roughness: 0.85, metalness: 0, side: T.DoubleSide });
      var band = layer === 'base' ? null : new T.Color(COLORS[layer]);
      m.userData = { layer: layer, mix: { value: band ? (kind === 'skin' ? 0.62 : 0.5) : 0 }, band: { value: band || new T.Color(0) } };
      if (band) {
        m.onBeforeCompile = function (sh) {
          sh.uniforms.uMix = m.userData.mix; sh.uniforms.uBand = m.userData.band;
          sh.fragmentShader = 'uniform float uMix;\nuniform vec3 uBand;\n' + sh.fragmentShader.replace('#include <map_fragment>', '#include <map_fragment>\ndiffuseColor.rgb = mix(diffuseColor.rgb, uBand * (0.55 + 0.45 * dot(diffuseColor.rgb, vec3(0.333))), uMix);');
        };
        m.customProgramCacheKey = function () { return 'band'; };
      }
      mats.push(m);
      return m;
    }

    var skinTexKey = null;
    function setBody(b) {
      state.body = Object.assign({}, DEFAULTS[b.sex] || DEFAULTS.male, b);
      while (root.children.length) root.remove(root.children[0]);
      mats.forEach(function (m) { m.dispose(); });
      mats = [];
      var P = person(state.body);
      var sexKey = state.body.sex === 'female' ? 'female' : 'male';
      var skins = (window.TallyHumanLook && window.TallyHumanLook.skins) || {};
      skinTexKey = skins[state.skin + '-' + sexKey] || skins['caucasian-' + sexKey];
      P.parts.forEach(function (p) {
        var map = texture(p.kind === 'skin' ? skinTexKey : p.tex, true, function () { renderer.render(scene, camera); });
        var nmap = texture(p.normal, false);
        ['base'].concat(ORDER).forEach(function (layer) {
          var mesh = new T.Mesh(p.geo, makeMat(p.kind, layer, map, nmap));
          mesh.castShadow = layer === 'base';
          mesh.receiveShadow = true;
          mesh.renderOrder = p.kind === 'hair' ? 2 : 0;
          root.add(mesh);
        });
      });
      root.scale.setScalar(P.build.scale);
      state.top = 1.76 * P.build.scale;
      state.build = P.build;
      frame();
      applyFill();
      renderer.render(scene, camera);
    }

    function applyFill() {
      var y = 0, edges = {};
      ORDER.forEach(function (k) {
        var f = Math.max(0, state.fill[k] || 0), y0 = y, y1 = y + f * state.top;
        edges[k] = [y0, Math.max(y0, y1), f];
        y = y1;
      });
      mats.forEach(function (m) {
        var L = m.userData.layer;
        if (L === 'base') { m.clippingPlanes = [planeAbove(y)]; return; }
        var e = edges[L], dim = state.hi && state.hi !== L;
        m.clippingPlanes = [planeAbove(e[0]), planeBelow(e[1])];
        m.visible = e[2] > 0.0005;
        m.userData.mix.value = dim ? 0.12 : (m.map && m.alphaTest ? 0.4 : 0.6);
      });
    }

    function frame() {
      var w = canvas.clientWidth || 300, h = canvas.clientHeight || 400;
      renderer.setSize(w, h, false);
      camera.aspect = w / h;
      var H = 1.76 * (opts.frame || 1.2);
      var d = H / (2 * Math.tan((camera.fov * Math.PI) / 360));
      if (camera.aspect < 0.55) d *= 0.55 / camera.aspect;
      camera.position.set(0, 1.0, d);
      camera.lookAt(0, opts.lookY || 0.86, 0);
      camera.updateProjectionMatrix();
    }

    var start = performance.now(), from = { carbs: 0, protein: 0, fat: 0 }, dur = opts.animateFill && !reduce ? 1200 : 0;
    var visible = true, raf = 0, pointerX = 0, rotY = opts.angle != null ? opts.angle : -0.35, rotTarget = rotY;
    function ease(t) { return 1 - Math.pow(1 - t, 3); }

    function loop(now) {
      raf = requestAnimationFrame(loop);
      if (!visible) return;
      var t = dur ? Math.min(1, (now - start) / dur) : 1, k = ease(t);
      ORDER.forEach(function (m) {
        var a = from[m] || 0, b = state.target[m] || 0;
        state.fill[m] = a + (b - a) * k;
      });
      applyFill();
      if (!reduce) {
        var sway = opts.sway === false ? 0 : Math.sin(now / 2600) * 0.22;
        rotTarget = (opts.angle != null ? opts.angle : -0.35) + sway + pointerX * 0.55;
      }
      rotY += (rotTarget - rotY) * 0.06;
      root.rotation.y = rotY;
      renderer.render(scene, camera);
    }

    var io = 'IntersectionObserver' in window ? new IntersectionObserver(function (e) { visible = e[0].isIntersecting; }) : null;
    if (io) io.observe(canvas);
    var ro = 'ResizeObserver' in window ? new ResizeObserver(frame) : null;
    if (ro) ro.observe(canvas);
    function onMove(e) {
      var r = canvas.getBoundingClientRect();
      pointerX = clamp(((e.clientX - r.left) / r.width) * 2 - 1, -1, 1);
    }
    if (opts.follow) window.addEventListener('pointermove', onMove);

    if (!dur) state.fill = Object.assign({ carbs: 0, protein: 0, fat: 0 }, state.target);
    root.rotation.y = rotY;
    setBody(opts.body || { sex: opts.sex || 'male' });
    raf = requestAnimationFrame(loop);

    return {
      update: function (o) {
        if (o.skin) state.skin = o.skin;
        if (o.sex || o.body || o.skin) setBody(Object.assign({}, o.body || (o.sex ? { sex: o.sex } : state.body)));
        if (o.fill) {
          from = { carbs: state.fill.carbs, protein: state.fill.protein, fat: state.fill.fat };
          state.target = o.fill;
          start = performance.now();
          dur = o.animate !== false && !reduce ? 700 : 0;
        }
      },
      highlight: function (k) { state.hi = k || null; },
      build: function () { return state.build; },
      dispose: function () {
        cancelAnimationFrame(raf);
        if (io) io.disconnect();
        if (ro) ro.disconnect();
        window.removeEventListener('pointermove', onMove);
        renderer.dispose();
      },
    };
  }

  window.TallyFigure = { mount: mount, buildOf: buildOf };
})();
