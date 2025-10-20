// game.js — blue START stripe + DW letters + faster car
import * as THREE from 'three';
import { GLTFLoader }  from 'https://unpkg.com/three@0.160.0/examples/jsm/loaders/GLTFLoader.js';
import { FontLoader }  from 'https://unpkg.com/three@0.160.0/examples/jsm/loaders/FontLoader.js';
import { TextGeometry } from 'https://unpkg.com/three@0.160.0/examples/jsm/geometries/TextGeometry.js';

window.addEventListener('DOMContentLoaded', () => {
  // DOM
  const toggleBtn = document.getElementById('gameToggle');
  const gameLayer = document.getElementById('gameLayer');
  const exitBtn   = document.getElementById('exitBtn');
  const canvas    = document.getElementById('gameCanvas');

  // State
  let renderer, scene, camera, clock, rafId, resizeHandler;
  let carRig, carModel;
  let isGameRunning = false;

  // DW state
  let dwGroup = null, dwHasFallen = false, dwFallAngle = 0;

  // Movement (faster)
  const input = { forward: 0, steer: 0, boost: 0, brake: 0 };
  const state = { speed: 0, heading: 0 };
  const ACCEL = 12.0, BOOST_ACCEL = 22.0, BRAKE_FORCE = 14.0, DRAG = 2.0, MAX_SPEED = 20.0;
  const STEER_AT_MAX = 2.0, STEER_MIN = 0.7;

  // ---------- Helpers
  function buildRoad() {
    const ROAD_LEN = 1200, ROAD_W = 10, LINE_H = 0.015, ROAD_Y = -1;

    // asphalt (flat color; add texture later if you want)
    const roadMat = new THREE.MeshStandardMaterial({ color: 0x2a2f3b, roughness: 0.92 });
    const road = new THREE.Mesh(new THREE.PlaneGeometry(ROAD_LEN, ROAD_W), roadMat);
    road.rotation.x = -Math.PI / 2;
    road.position.set(0, ROAD_Y + 0.001, 0);
    scene.add(road);

    // stripes helper
    const addStripe = (w, h, d, x, y, z, color) => {
      const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), new THREE.MeshStandardMaterial({ color, roughness: 0.4 }));
      m.position.set(x, y, z);
      scene.add(m);
    };

    // edge lines
    const EDGE_W = 0.12, EDGE_Z = ROAD_LEN, EDGE_OFFSET = ROAD_W/2 - EDGE_W/2;
    addStripe(EDGE_W, LINE_H, EDGE_Z, -EDGE_OFFSET, ROAD_Y + 0.01, 0, 0xffffff);
    addStripe(EDGE_W, LINE_H, EDGE_Z,  EDGE_OFFSET, ROAD_Y + 0.01, 0, 0xffffff);

    // center dashed
    const DASH_LEN = 2.0, GAP_LEN = 4.0, DASH_W = 0.18;
    for (let z = -ROAD_LEN/2 + DASH_LEN/2; z <= ROAD_LEN/2; z += DASH_LEN + GAP_LEN) {
      addStripe(DASH_W, LINE_H, DASH_LEN, 0, ROAD_Y + 0.012, z, 0xffffff);
    }
  }

  // Blue START stripe (white outline), drawn above the road
  function addStartLine(sceneRef) {
    const cvs = document.createElement('canvas');
    cvs.width = 1024; cvs.height = 256;
    const ctx = cvs.getContext('2d');
    // blue band
    ctx.fillStyle = '#0E5CF2';
    ctx.fillRect(0, cvs.height * 0.2, cvs.width, cvs.height * 0.6);
    // white-outlined text
    ctx.lineWidth = 18;
    ctx.strokeStyle = '#FFFFFF';
    ctx.font = 'bold 140px system-ui, -apple-system, Segoe UI, Roboto, Arial';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.strokeText('START', cvs.width / 2, cvs.height / 2);

    const tex = new THREE.CanvasTexture(cvs);
    tex.anisotropy = 8;

    const mat = new THREE.MeshBasicMaterial({ map: tex, transparent: true, depthWrite: false, side: THREE.DoubleSide });
    const mesh = new THREE.Mesh(new THREE.PlaneGeometry(14, 3.2), mat);
    mesh.rotation.x = -Math.PI / 2;
    mesh.position.set(0, -0.982, -16);   // slightly above road, in front of the car
    mesh.renderOrder = 2;                // draw on top of road
    mesh.frustumCulled = false;

    sceneRef.add(mesh);
  }

  // “DW” letters you can knock over (simple tip animation)
  function addDWLetters(sceneRef) {
    const loader = new FontLoader();
    loader.load(
      'https://fonts.googleapis.com/css2?family=Doto:wght,ROND@700,100&family=Jersey+10&display=swap',
      (font) => {
        const opt = {
          font, size: 1.3, height: 10.38, curveSegments: 8,
          bevelEnabled: true, bevelThickness: 0.05, bevelSize: 0.035, bevelSegments: 2
        };
        const mat = new THREE.MeshStandardMaterial({ color: 0xffffff, metalness: 0.2, roughness: 0.5 });

        const dGeo = new TextGeometry('D', opt); dGeo.center();
        const wGeo = new TextGeometry('W', opt); wGeo.center();

        const dMesh = new THREE.Mesh(dGeo, mat);
        const wMesh = new THREE.Mesh(wGeo, mat);
        dMesh.position.set(-1.3, -0.75, 0);
        wMesh.position.set( 1.3, -0.75, 0);

        dwGroup = new THREE.Group();
        dwGroup.add(dMesh, wMesh);
        dwGroup.position.set(0, 0, -30);
        sceneRef.add(dwGroup);

        dwHasFallen = false;
        dwFallAngle = 0;
      },
      undefined,
      // Fallback: boxes if font fails to load
      () => {
        const mat = new THREE.MeshStandardMaterial({ color: 0xffffff, metalness: 0.2, roughness: 0.5 });
        const d = new THREE.Mesh(new THREE.BoxGeometry(1.0, 1.2, 0.35), mat);
        const w = new THREE.Mesh(new THREE.BoxGeometry(1.6, 1.2, 0.35), mat);
        d.position.set(-1.3, -0.75, 0);
        w.position.set( 1.3, -0.75, 0);
        dwGroup = new THREE.Group();
        dwGroup.add(d, w);
        dwGroup.position.set(0, 0, -30);
        sceneRef.add(dwGroup);
      }
    );
  }

  function updateDW(dt, carRef) {
    if (!dwGroup) return;

    if (!dwHasFallen && carRef) {
      const dx = Math.abs(carRef.position.x - dwGroup.position.x);
      const dz = Math.abs(carRef.position.z - dwGroup.position.z);
      if (dx < 1.7 && dz < 1.7) dwHasFallen = true;
    }
    if (dwHasFallen && dwFallAngle < Math.PI / 2) {
      dwFallAngle = Math.min(Math.PI / 2, dwFallAngle + dt * 2.4);
      dwGroup.rotation.x = -dwFallAngle;
      dwGroup.position.y = -Math.sin(dwFallAngle) * 0.45;
    }
  }

  function normalizeModel(root, desiredHeight = 1.0) {
    const box = new THREE.Box3().setFromObject(root);
    const size = new THREE.Vector3(), center = new THREE.Vector3();
    box.getSize(size); box.getCenter(center);
    const s = desiredHeight / (size.y || 1);
    root.scale.setScalar(s);
    root.position.sub(center.multiplyScalar(s));
  }

  function bindDesktopInput() {
    const onDown = (e) => {
      switch (e.key) {
        case 'w': case 'ArrowUp':    input.forward =  1; break;
        case 's': case 'ArrowDown':  input.forward = -1; break;
        case 'a': case 'ArrowLeft':  input.steer   = -1; break;
        case 'd': case 'ArrowRight': input.steer   =  1; break;
        case 'Shift': input.boost = 1; break;
        case ' ':     input.brake = 1; break;
      }
    };
    const onUp = (e) => {
      switch (e.key) {
        case 'w': case 'ArrowUp':    if (input.forward > 0) input.forward = 0; break;
        case 's': case 'ArrowDown':  if (input.forward < 0) input.forward = 0; break;
        case 'a': case 'ArrowLeft':  if (input.steer   < 0) input.steer   = 0; break;
        case 'd': case 'ArrowRight': if (input.steer   > 0) input.steer   = 0; break;
        case 'Shift': input.boost = 0; break;
        case ' ':     input.brake = 0; break;
      }
    };
    window.addEventListener('keydown', onDown);
    window.addEventListener('keyup', onUp);
  }

  // === START line made from simple meshes (always visible) ===
  function addStartLineBoxes() {
    const ROAD_Y = -1;
    const y = ROAD_Y + 0.02;
    const z = 10;                // in front of car
    const width = 10.5;
    const depth = 2.6;
  
    const group = new THREE.Group();
    group.position.set(0, 0, 0);
    group.rotation.y = Math.PI;  // 👈 flip so text is readable
    scene.add(group);
  
    // blue bar
    const blueMat = new THREE.MeshBasicMaterial({ color: 0x0E5CF2 });
    const blue = new THREE.Mesh(new THREE.PlaneGeometry(width, depth), blueMat);
    blue.rotation.x = -Math.PI / 2;
    blue.position.set(0, y, z);
    blue.renderOrder = 2;
    group.add(blue);
  
    // helper to add white “pixels”
    const whiteMat = new THREE.MeshBasicMaterial({ color: 0xffffff });
    const addPix = (px, pz, w, d) => {
      const m = new THREE.Mesh(new THREE.BoxGeometry(w, 0.03, d), whiteMat);
      m.position.set(px, y + 0.01, z + pz);
      group.add(m);
      return m;
    };
  
    // blocky START (same as before)
    const cw = 0.25, ch = 0.5, gap = 0.15;
  
    // S
    (()=>{
      const x = -3.2, top=0.8, mid=0.0, bot=-0.8;
      addPix(x, top,  cw*3, cw*0.8);
      addPix(x- cw, mid,  cw*2, cw*0.8);
      addPix(x, bot,  cw*3, cw*0.8);
      addPix(x- cw*1.5, top-0.5, cw*0.8, ch);
      addPix(x+ cw*1.5, mid-0.5, cw*0.8, ch);
    })();
  
    // T
    (()=>{
      const x = -1.7, top=0.8, bot=-0.8;
      addPix(x, top, cw*3, cw*0.8);
      addPix(x, (top+bot)/2, cw*0.8, ch*2.2);
    })();
  
    // A
    (()=>{
      const x = -0.3, top=0.8, bot=-0.8;
      addPix(x, top, cw*2.6, cw*0.8);
      addPix(x- cw*1.3, (top+bot)/2, cw*0.8, ch*2.0);
      addPix(x+ cw*1.3, (top+bot)/2, cw*0.8, ch*2.0);
      addPix(x, 0.0, cw*2.0, cw*0.8);
    })();
  
    // R
    (()=>{
      const x = 1.2, top=0.8, mid=0.0, bot=-0.8;
      addPix(x- cw*1.5, (top+bot)/2, cw*0.8, ch*2.3);
      addPix(x, top,  cw*2.4, cw*0.8);
      addPix(x+ cw*1.2, (top+mid)/2, cw*0.8, ch*1.0);
      addPix(x, mid,  cw*2.0, cw*0.8);
      addPix(x+ cw*1.2, (mid+bot)/2, cw*0.8, ch*1.0);
    })();
  
    // T
    (()=>{
      const x = 2.7, top=0.8, bot=-0.8;
      addPix(x, top, cw*3, cw*0.8);
      addPix(x, (top+bot)/2, cw*0.8, ch*2.2);
    })();
  }  
  
  // === “DW” letters built from boxes (no fonts) ===
  function addDWLettersBoxes() {
    const group = new THREE.Group();
    group.rotation.y = Math.PI;   // 👈 face camera
    scene.add(group);
  
    const mat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.5, metalness: 0.2 });
    const yBase = -0.75;
    const thick = 0.35;
    const z = 30; // farther down the road
  
    const bar = (w, h, x, y, zpos) => {
      const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, thick), mat);
      m.position.set(x, y, zpos);
      group.add(m);
    };
  
    // D
    const dx = -1.4;
    bar(0.35, 1.6, dx-0.8, yBase, z);
    bar(1.2, 0.35, dx, yBase+0.8, z);
    bar(1.2, 0.35, dx, yBase-0.8, z);
    bar(0.35, 1.3, dx+0.55, yBase, z+0.05);
  
    // W
    const wx = 1.4;
    bar(0.35, 1.6, wx-0.9, yBase, z);
    bar(0.35, 1.6, wx+0.9, yBase, z);
  
    const mid1 = new THREE.Mesh(new THREE.BoxGeometry(0.35, 1.1, thick), mat);
    mid1.position.set(wx-0.3, yBase-0.25, z); mid1.rotation.z = 0.3; group.add(mid1);
    const mid2 = mid1.clone(); mid2.position.set(wx+0.3, yBase-0.25, z); mid2.rotation.z = -0.3; group.add(mid2);
  
    // expose for the updater
    window.__DW_GROUP__ = group;
  }
  
  
  // simple proximity “knock-over” animation (no physics lib)
  function updateDWBoxes(dt, carRef) {
    const group = window.__DW_GROUP__;
    if (!group || !carRef) return;
  
    if (!group.userData.state) group.userData.state = { fallen: false, angle: 0 };
  
    const s = group.userData.state;
    const dx = Math.abs(carRef.position.x - 0); // group centered at x≈0
    const dz = Math.abs(carRef.position.z - 30);
    if (!s.fallen && dx < 1.8 && dz < 1.8) s.fallen = true;
  
    if (s.fallen && s.angle < Math.PI / 2) {
      s.angle = Math.min(Math.PI / 2, s.angle + dt * 2.4);
      group.rotation.x = -s.angle;
      group.position.y = -Math.sin(s.angle) * 0.45;
    }
  }  

  // ---------- Game flow
  function startGame() {
    if (isGameRunning) return;
    isGameRunning = true;

    gameLayer.style.display = 'block';
    toggleBtn.setAttribute('aria-pressed', 'true');
    toggleBtn.textContent = 'Game Mode: ON';

    // renderer
    renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setSize(window.innerWidth, window.innerHeight);

    // scene + camera
    scene = new THREE.Scene();
    scene.background = new THREE.Color(0x05060a);
    scene.fog = new THREE.Fog(0x05060a, 18, 90);

    camera = new THREE.PerspectiveCamera(60, window.innerWidth / window.innerHeight, 0.1, 400);
    camera.position.set(0, 1.6, 4);

    clock = new THREE.Clock();

    // lights
    scene.add(new THREE.HemisphereLight(0xffffff, 0x202030, 0.9));
    const dir = new THREE.DirectionalLight(0xffffff, 1.0);
    dir.position.set(4, 8, 6);
    scene.add(dir);

    // world
    buildRoad();            // existing
    addStartLineBoxes();    // NEW — blue START across road
    addDWLettersBoxes();    // NEW — DW blocks down the road

    // car rig & model
    carRig = new THREE.Group();
    scene.add(carRig);

    const gltfLoader = new GLTFLoader();
    gltfLoader.load(
      '/assets/models/car.glb',
      (gltf) => {
        carModel = gltf.scene;
        normalizeModel(carModel, 1.0);
        carModel.position.y = -0.75;
        carRig.add(carModel);
      },
      undefined,
      (err) => console.error('Failed to load car.glb', err)
    );

    bindDesktopInput();

    resizeHandler = () => {
      camera.aspect = window.innerWidth / window.innerHeight;
      camera.updateProjectionMatrix();
      renderer.setSize(window.innerWidth, window.innerHeight);
    };
    window.addEventListener('resize', resizeHandler);

    animate();
  }

  function stopGame() {
    if (!isGameRunning) return;
    isGameRunning = false;

    gameLayer.style.display = 'none';
    toggleBtn.setAttribute('aria-pressed', 'false');
    toggleBtn.textContent = 'Developer Lens';

    if (rafId) cancelAnimationFrame(rafId);
    if (resizeHandler) window.removeEventListener('resize', resizeHandler);

    if (scene) {
      scene.traverse(obj => {
        if (obj.isMesh) {
          obj.geometry?.dispose?.();
          const m = obj.material;
          if (Array.isArray(m)) m.forEach(mm => mm.dispose?.());
          else m?.dispose?.();
        }
      });
    }
    renderer?.dispose?.();
    renderer?.forceContextLoss?.();

    renderer = scene = camera = clock = carRig = carModel = rafId = resizeHandler = null;
    input.forward = input.steer = input.boost = input.brake = 0;
    state.speed = state.heading = 0;
  }

  function animate() {
    rafId = requestAnimationFrame(animate);
    const dt = Math.min(0.033, clock.getDelta());

    // driving
    const acc = input.boost ? BOOST_ACCEL : ACCEL;
    state.speed += input.forward * acc * dt;
    if (input.brake) state.speed -= BRAKE_FORCE * dt;
    const sign = Math.sign(state.speed);
    state.speed -= sign * DRAG * dt;
    if (Math.sign(state.speed) !== sign) state.speed = 0;
    state.speed = THREE.MathUtils.clamp(state.speed, -MAX_SPEED * 0.4, MAX_SPEED);

    const speed01 = THREE.MathUtils.clamp(Math.abs(state.speed) / MAX_SPEED, 0, 1);
    const steerRate = THREE.MathUtils.lerp(STEER_MIN, STEER_AT_MAX, speed01);
    state.heading += input.steer * steerRate * dt * (state.speed >= 0 ? 1 : -1);

    if (carRig) {
      const fwd = new THREE.Vector3(Math.sin(state.heading), 0, Math.cos(state.heading));
      carRig.position.addScaledVector(fwd, state.speed * dt);
      carRig.rotation.y = state.heading;

      // chase cam
      const desired = new THREE.Vector3().copy(carRig.position)
        .add(new THREE.Vector3(0, 1.6, 4).applyAxisAngle(new THREE.Vector3(0,1,0), Math.PI + state.heading));
      camera.position.lerp(desired, 1 - Math.pow(0.001, dt));
      camera.lookAt(carRig.position.x, carRig.position.y + 0.5, carRig.position.z);
    }

    updateDW(dt, carRig);
    renderer.render(scene, camera);
  }

  // wire events
  toggleBtn.addEventListener('click', () => (isGameRunning ? stopGame() : startGame()));
  exitBtn.addEventListener('click', stopGame);
  window.addEventListener('keydown', (e) => { if (e.key === 'Escape' && isGameRunning) stopGame(); });
});
