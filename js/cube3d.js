/* Affichage 3D du cube avec Three.js : animation des mouvements, flèches, caméra, surbrillance. */
(function () {
  const L = window.CubeLogic;

  const STICKER_HEX = {
    W: 0xf7f7f2, Y: 0xffd21f, R: 0xe3262f, O: 0xff8a1c, B: 0x1f63e6, G: 0x16a94a,
  };
  const DIM_HEX = 0x4a4f4c;
  const ARROW_HEX = 0xff2f86;
  const WHOLE_HEX = 0x7c4dff;

  const VIEWS = {
    normal: { az: 32, el: 27 },
    below: { az: 28, el: -38 },
    top: { az: 0, el: 62 },
    high: { az: 18, el: 46 },
    front: { az: 14, el: 10 },
    under: { az: 0, el: -64 },
  };

  const ease = (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
  const rad = (d) => (d * Math.PI) / 180;

  function roundedRectShape(size, r) {
    const s = new THREE.Shape();
    const h = size / 2;
    s.moveTo(-h + r, -h);
    s.lineTo(h - r, -h); s.quadraticCurveTo(h, -h, h, -h + r);
    s.lineTo(h, h - r); s.quadraticCurveTo(h, h, h - r, h);
    s.lineTo(-h + r, h); s.quadraticCurveTo(-h, h, -h, h - r);
    s.lineTo(-h, -h + r); s.quadraticCurveTo(-h, -h, -h + r, -h);
    return s;
  }

  class Cube3D {
    constructor(container) {
      this.container = container;
      this.renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
      this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
      container.appendChild(this.renderer.domElement);
      this.renderer.domElement.className = 'cube-canvas';

      this.scene = new THREE.Scene();
      this.camera = new THREE.PerspectiveCamera(32, 1, 0.1, 100);
      this.scene.add(new THREE.AmbientLight(0xffffff, 0.78));
      const d1 = new THREE.DirectionalLight(0xffffff, 0.42); d1.position.set(4, 9, 7); this.scene.add(d1);
      const d2 = new THREE.DirectionalLight(0xffffff, 0.16); d2.position.set(-6, -4, 3); this.scene.add(d2);

      this.cubeGroup = new THREE.Group();
      this.scene.add(this.cubeGroup);
      this.arrowGroup = new THREE.Group();
      this.cubeGroup.add(this.arrowGroup);

      this.cube = L.createSolved();
      this.meshes = new Map();
      this.buildMeshes();
      this.sync();

      this.view = { ...VIEWS.normal };
      this.cam = { ...VIEWS.normal };
      this.drag = { az: 0, el: 0, active: false };
      this.anim = null;
      this.highlight = null;

      this.resize = this.resize.bind(this);
      this.ro = new ResizeObserver(this.resize);
      this.ro.observe(container);
      this.resize();
      this.bindDrag();

      this.running = true;
      const loop = (now) => {
        if (!this.running) return;
        this.tick(now);
        this.renderer.render(this.scene, this.camera);
        requestAnimationFrame(loop);
      };
      requestAnimationFrame(loop);
    }

    destroy() {
      this.running = false;
      this.ro.disconnect();
      this.renderer.dispose();
      this.renderer.domElement.remove();
    }

    buildMeshes() {
      const bodyGeo = new THREE.BoxGeometry(0.97, 0.97, 0.97);
      const bodyMat = new THREE.MeshLambertMaterial({ color: 0x15171a });
      const stickerGeo = new THREE.ShapeGeometry(roundedRectShape(0.84, 0.12), 4);
      for (const p of this.cube.pieces) {
        const g = new THREE.Group();
        g.add(new THREE.Mesh(bodyGeo, bodyMat));
        g.userData.stickers = [];
        for (const s of p.stickers) {
          const mat = new THREE.MeshLambertMaterial({ color: STICKER_HEX[s.c] });
          const m = new THREE.Mesh(stickerGeo, mat);
          const n = new THREE.Vector3(...s.n);
          m.position.copy(n.clone().multiplyScalar(0.488));
          m.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), n);
          m.userData.color = s.c;
          g.add(m);
          g.userData.stickers.push(m);
        }
        this.cubeGroup.add(g);
        this.meshes.set(p.id, g);
      }
    }

    sync() {
      const m4 = new THREE.Matrix4();
      for (const p of this.cube.pieces) {
        const g = this.meshes.get(p.id);
        g.position.set(p.pos[0], p.pos[1], p.pos[2]);
        const r = p.rot;
        m4.set(r[0], r[1], r[2], 0, r[3], r[4], r[5], 0, r[6], r[7], r[8], 0, 0, 0, 0, 1);
        g.quaternion.setFromRotationMatrix(m4);
      }
    }

    /* ---------- état ---------- */
    reset(setup) {
      this.abort();
      this.cube = L.apply(L.createSolved(), setup || '');
      this.sync();
      this.clearArrow();
    }

    applyInstant(seq) {
      this.abort();
      L.apply(this.cube, seq);
      this.sync();
    }

    setHighlight(pred) {
      // pred(piece) évalué une seule fois : la surbrillance suit ensuite la pièce.
      for (const p of this.cube.pieces) {
        const on = !pred || pred(p, this.cube);
        for (const m of this.meshes.get(p.id).userData.stickers) {
          m.material.color.setHex(on ? STICKER_HEX[m.userData.color] : DIM_HEX);
        }
      }
    }

    setView(name, instant) {
      const v = VIEWS[name] || VIEWS.normal;
      this.view = { ...v };
      if (instant) this.cam = { ...v };
    }

    /* ---------- animation d'un mouvement ---------- */
    animateMove(token, opts = {}) {
      this.abort();
      const mv = L.parse(token)[0];
      const def = L.MOVES[mv.face];
      const pieces = L.piecesInMove(this.cube, mv);
      const pivot = new THREE.Object3D();
      this.cubeGroup.add(pivot);
      for (const p of pieces) pivot.attach(this.meshes.get(p.id));
      if (opts.arrow !== false) this.showArrow(mv);
      const angle = (def.sign * mv.turns * Math.PI) / 2;
      const dur = (opts.duration || 500) * (mv.turns === 2 ? 1.45 : 1);
      return new Promise((resolve) => {
        const start = performance.now() + (opts.preview || 0);
        this.anim = { mv, pivot, pieces, axis: ['x', 'y', 'z'][def.axis], angle, start, dur, resolve };
      });
    }

    finishAnim(applied) {
      const a = this.anim;
      if (!a) return;
      this.anim = null;
      for (const p of a.pieces) this.cubeGroup.attach(this.meshes.get(p.id));
      this.cubeGroup.remove(a.pivot);
      if (applied) L.applyMove(this.cube, a.mv);
      this.sync();
      this.clearArrow();
      a.resolve(applied);
    }

    abort() {
      if (this.anim) this.finishAnim(false);
    }

    /* ---------- flèches (toujours dessinées sur la face avant) ---------- */
    clearArrow() {
      while (this.arrowGroup.children.length) {
        const c = this.arrowGroup.children.pop();
        c.traverse((o) => { if (o.geometry) o.geometry.dispose(); });
      }
    }

    addArrowPath(points, color, closedHead = true) {
      const mat = new THREE.MeshBasicMaterial({ color, depthTest: false, transparent: true, opacity: 0.96 });
      const curve = new THREE.CatmullRomCurve3(points);
      const tube = new THREE.Mesh(new THREE.TubeGeometry(curve, 48, 0.075, 10, false), mat);
      tube.renderOrder = 10;
      this.arrowGroup.add(tube);
      if (closedHead) {
        const end = points[points.length - 1];
        const dir = curve.getTangent(1).normalize();
        const head = new THREE.Mesh(new THREE.ConeGeometry(0.2, 0.42, 20), mat);
        head.position.copy(end).add(dir.clone().multiplyScalar(0.12));
        head.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir);
        head.renderOrder = 10;
        this.arrowGroup.add(head);
      }
    }

    showArrow(mv) {
      this.clearArrow();
      const z = 1.56;
      const V = (x, y) => new THREE.Vector3(x, y, z);
      const line = (a, b, color = ARROW_HEX) => this.addArrowPath([a, a.clone().lerp(b, 0.5), b], color);
      const arc = (r, from, to, color = ARROW_HEX) => {
        const pts = [];
        for (let i = 0; i <= 24; i++) {
          const t = rad(from + ((to - from) * i) / 24);
          pts.push(V(r * Math.cos(t), r * Math.sin(t)));
        }
        this.addArrowPath(pts, color);
      };
      const ccw = mv.turns === -1;
      switch (mv.face) {
        case 'R': ccw ? line(V(1, 1.15), V(1, -1.05)) : line(V(1, -1.15), V(1, 1.05)); break;
        case 'L': ccw ? line(V(-1, -1.15), V(-1, 1.05)) : line(V(-1, 1.15), V(-1, -1.05)); break;
        case 'U': ccw ? line(V(-1.15, 1), V(1.05, 1)) : line(V(1.15, 1), V(-1.05, 1)); break;
        case 'D': ccw ? line(V(1.15, -1), V(-1.05, -1)) : line(V(-1.15, -1), V(1.05, -1)); break;
        case 'F':
          if (mv.turns === 2) arc(1.05, 210, -60);
          else ccw ? arc(1.05, 30, 150) : arc(1.05, 150, 30);
          break;
        case 'y':
          for (const yy of [0.9, -0.9]) {
            ccw ? line(V(-1.2, yy), V(1.1, yy), WHOLE_HEX) : line(V(1.2, yy), V(-1.1, yy), WHOLE_HEX);
          }
          break;
        case 'z':
          arc(1.25, 200, -70, WHOLE_HEX);
          break;
        default: break;
      }
    }

    /* ---------- caméra & glisser du doigt ---------- */
    bindDrag() {
      const el = this.renderer.domElement;
      let last = null;
      el.style.touchAction = 'none';
      el.addEventListener('pointerdown', (e) => {
        this.drag.active = true;
        last = [e.clientX, e.clientY];
        el.setPointerCapture(e.pointerId);
      });
      el.addEventListener('pointermove', (e) => {
        if (!this.drag.active || !last) return;
        const dx = e.clientX - last[0];
        const dy = e.clientY - last[1];
        last = [e.clientX, e.clientY];
        this.drag.az = Math.max(-170, Math.min(170, this.drag.az - dx * 0.5));
        this.drag.el = Math.max(-80 - this.view.el, Math.min(80 - this.view.el, this.drag.el + dy * 0.4));
      });
      const up = () => { this.drag.active = false; last = null; };
      el.addEventListener('pointerup', up);
      el.addEventListener('pointercancel', up);
    }

    resize() {
      const w = this.container.clientWidth || 1;
      const h = this.container.clientHeight || 1;
      this.renderer.setSize(w, h, false);
      this.camera.aspect = w / h;
      const r = 2.75;
      const t = Math.tan(rad(this.camera.fov / 2));
      this.dist = Math.max(r / t, r / (t * this.camera.aspect));
      this.camera.updateProjectionMatrix();
    }

    tick(now) {
      // caméra : on glisse doucement vers la vue demandée ; le doigt relâché, on revient.
      if (!this.drag.active) {
        this.drag.az *= 0.88;
        this.drag.el *= 0.88;
      }
      this.cam.az += (this.view.az - this.cam.az) * 0.08;
      this.cam.el += (this.view.el - this.cam.el) * 0.08;
      const az = rad(this.cam.az + this.drag.az);
      const elv = rad(Math.max(-85, Math.min(85, this.cam.el + this.drag.el)));
      const d = this.dist || 10;
      this.camera.position.set(d * Math.cos(elv) * Math.sin(az), d * Math.sin(elv), d * Math.cos(elv) * Math.cos(az));
      this.camera.lookAt(0, -0.05, 0);

      const a = this.anim;
      if (a) {
        const t = Math.min(1, Math.max(0, (now - a.start) / a.dur));
        a.pivot.rotation[a.axis] = a.angle * ease(t);
        if (t >= 1) this.finishAnim(true);
      }
    }
  }

  Cube3D.VIEWS = VIEWS;
  Cube3D.STICKER_HEX = STICKER_HEX;
  window.Cube3D = Cube3D;
})();
