import * as THREE from 'three';

function getPointOnOval2D(t, Rx, Rz) {
  return new THREE.Vector2(Math.cos(t) * Rx, Math.sin(t) * Rz);
}

function getPointOnOval(progress01) {
  const t = progress01 * Math.PI * 2;
  const v2 = getPointOnOval2D(t, TRACK_OUTER_RADIUS_X - TRACK_WIDTH * 0.5, TRACK_OUTER_RADIUS_Z - TRACK_WIDTH * 0.5);
  return new THREE.Vector3(v2.x, 0, v2.y);
}

// ======== Audio System ========
function initAudio() {
  if (isAudioInitialized) return;
  
  try {
    audioContext = new (window.AudioContext || window.webkitAudioContext)();
    
    // Master gain control
    masterGain = audioContext.createGain();
    masterGain.gain.value = 0.3;
    masterGain.connect(audioContext.destination);
    
    // Engine sound setup
    createEngineSound();
    
    isAudioInitialized = true;
  } catch (error) {
    console.warn('Audio initialization failed:', error);
  }
}

function createEngineSound() {
  // Create oscillator for engine base tone
  engineOscillator = audioContext.createOscillator();
  engineOscillator.type = 'sawtooth';
  engineOscillator.frequency.value = 80; // Base idle frequency
  
  // Create filter for engine character
  engineFilter = audioContext.createBiquadFilter();
  engineFilter.type = 'lowpass';
  engineFilter.frequency.value = 800;
  engineFilter.Q.value = 1;
  
  // Create gain for engine volume
  engineGain = audioContext.createGain();
  engineGain.gain.value = 0;
  
  // Connect audio nodes
  engineOscillator.connect(engineFilter);
  engineFilter.connect(engineGain);
  engineGain.connect(masterGain);
  
  // Start the oscillator
  engineOscillator.start();
}

function updateEngineSound(dt) {
  if (!isAudioInitialized || !engineOscillator) return;
  
  const forward = keys['w'] || keys['arrowup'];
  const boostKey = keys['shift'] || keys['shiftleft'] || keys['shiftright'];
  
  // Calculate engine RPM based on speed and throttle
  const speedRatio = Math.abs(speed) / params.maxSpeed;
  const baseRPM = 80; // Idle RPM
  const maxRPM = 400; // Max RPM
  
  let targetRPM = baseRPM;
  let targetVolume = 0.1; // Idle volume
  
  if (forward) {
    // Throttle input increases RPM
    targetRPM = baseRPM + (maxRPM - baseRPM) * (0.3 + speedRatio * 0.7);
    targetVolume = 0.2 + speedRatio * 0.3;
    
    // Boost effect
    if (boostKey && boost > 0) {
      targetRPM *= 1.2;
      targetVolume *= 1.4;
    }
  } else {
    // Coasting - RPM based on speed only
    targetRPM = baseRPM + (maxRPM - baseRPM) * speedRatio * 0.5;
    targetVolume = 0.1 + speedRatio * 0.2;
  }
  
  // Smooth transitions
  const currentFreq = engineOscillator.frequency.value;
  const currentVol = engineGain.gain.value;
  
  engineOscillator.frequency.setValueAtTime(
    currentFreq + (targetRPM - currentFreq) * dt * 8, 
    audioContext.currentTime
  );
  
  engineGain.gain.setValueAtTime(
    currentVol + (targetVolume - currentVol) * dt * 6,
    audioContext.currentTime
  );
  
  // Filter frequency follows RPM for realistic engine character
  const filterFreq = 400 + targetRPM * 2;
  engineFilter.frequency.setValueAtTime(filterFreq, audioContext.currentTime);
}

function stopEngineSound() {
  if (engineOscillator) {
    engineGain.gain.setValueAtTime(0, audioContext.currentTime);
  }
}



// game.js — NASCAR oval track (flat), lap timer + start/finish, works without external assets
// Uses Three.js r160 modules from unpkg like your previous file.
// Controls: WASD / Arrow keys. Shift = boost. Esc or Exit button to leave.
// Optional: If you later want to swap the placeholder car for a GLB, uncomment these lines and load it in buildCar()
// import { GLTFLoader } from 'https://unpkg.com/three@0.160.0/examples/jsm/loaders/GLTFLoader.js';

function initGame() {
  // DOM hooks (kept to match your existing HTML)
  const toggleBtn = document.getElementById('gameToggle') || document.getElementById('startGame') || document.body;
  let _gameLayer = document.getElementById('gameLayer');
  let _exitBtn   = document.getElementById('exitBtn');
  let _canvas    = document.getElementById('gameCanvas');
  if (!_gameLayer) {
    _gameLayer = document.createElement('div');
    _gameLayer.id = 'gameLayer';
    Object.assign(_gameLayer.style, {
      position: 'fixed', inset: '0', display: 'none',
      background: 'radial-gradient(1200px 800px at 50% 50%, #0b0f18 0%, #020409 60%, #000 100%)',
      zIndex: '9999'
    });
    document.body.appendChild(_gameLayer);
  }
  if (!_exitBtn) {
    _exitBtn = document.createElement('button');
    _exitBtn.id = 'exitBtn';
    _exitBtn.textContent = 'Exit Game';
    Object.assign(_exitBtn.style, {
      position: 'fixed', top: '16px', right: '16px', zIndex: '10060',
      padding: '10px 14px', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.4)',
      background: 'rgba(0,0,0,0.5)', color: '#fff', cursor: 'pointer', backdropFilter: 'blur(4px)'
    });
    _gameLayer.appendChild(_exitBtn);
  }
  if (!_canvas) {
    _canvas = document.createElement('canvas');
    _canvas.id = 'gameCanvas';
    _gameLayer.appendChild(_canvas);
  }

  const gameLayer = _gameLayer || document.getElementById('gameLayer') || document.body;
  const exitBtn   = _exitBtn || document.getElementById('exitBtn');
  const canvas    = _canvas || document.getElementById('gameCanvas');

  // Core state
  let renderer, scene, camera, clock, rafId;
  let carRig, carBody;
  let keys = {};
  let running = false;

  // Audio system
  let audioContext, engineSound, masterGain;
  let engineOscillator, engineFilter, engineGain;
  let isAudioInitialized = false;

  // Track + gameplay state
  let trackMesh, wallMesh, startFinishMesh;
  let checkpoints = [];   // {p:THREE.Vector3, n:THREE.Vector2} line normals around the oval used for lap logic
  let coinGroup, coinsCollected = 0;
  let nextCheckpoint = 0;
  let lap = 0;
  let lapStartTime = 0;
  let bestLap = null;
  const ui = ensureUI();

  // Car physics parameters (arcade)
  const params = {
    maxSpeed: 115,         // units/s on asphalt
    accel: 60,             // units/s^2
    brake: 120,            // units/s^2
    turnRate: 1.9,         // rad/s @ full lock
    friction: 2.5,         // natural slowdown
    grip: 1.0,             // 1.0 on asphalt, ~0.5 on grass
    boostAccel: 100,       // when Shift is pressed
    boostDrain: 30,        // per second
    boostRegen: 10,        // per second when not boosting
    maxBoost: 100,
  };
  let speed = 0;
  let heading = 0;         // radians
  let boost = params.maxBoost;

  // Track geometry parameters
  const TRACK_OUTER_RADIUS_X = 200; // long axis (x)
  const TRACK_OUTER_RADIUS_Z = 120; // short axis (z)
  const TRACK_WIDTH = 18;           // asphalt width
  const APRON_WIDTH = 6;            // inner light asphalt
  const WALL_HEIGHT = 2.2;

  // ======== bootstrap ========
// Don't auto-start, wait for manual trigger
window.startGame = function() {
  if (!renderer) setup();
};

  function setup() {
    // Renderer
    renderer = new THREE.WebGLRenderer({ antialias: true, canvas: canvas || undefined });
    renderer.setPixelRatio(Math.min(2, window.devicePixelRatio || 1));
    
    renderer.setSize(window.innerWidth, window.innerHeight);
    // Ensure the canvas is actually in the DOM and visible
    const mount = gameLayer || document.body;
    if (canvas) {
      // Style existing canvas to fill screen
      canvas.style.display = 'block';
      canvas.style.position = 'fixed';
      canvas.style.left = '0';
      canvas.style.top = '0';
      canvas.style.width = '100vw';
      canvas.style.height = '100vh';
      canvas.style.zIndex = '9998';
    } else {
      // Append renderer's canvas if none provided
      const cv = renderer.domElement;
      cv.style.position = 'fixed';
      cv.style.left = '0';
      cv.style.top = '0';
      cv.style.width = '100vw';
      cv.style.height = '100vh';
      cv.style.zIndex = '9998';
      mount.appendChild(cv);
    }

    renderer.shadowMap.enabled = true;

    // Scene + camera
    scene = new THREE.Scene();
    scene.background = new THREE.Color(0x87b6e0);

    camera = new THREE.PerspectiveCamera(70, window.innerWidth / window.innerHeight, 0.1, 2000);
    camera.position.set(0, 35, 45);
    camera.lookAt(0, 0, 0);

    // Lights
    const hemi = new THREE.HemisphereLight(0xffffff, 0x557755, 0.6);
    scene.add(hemi);
    const dir = new THREE.DirectionalLight(0xffffff, 1.0);
    dir.position.set(60, 120, 30);
    dir.castShadow = true;
    dir.shadow.mapSize.set(2048, 2048);
    dir.shadow.camera.left = -400;
    dir.shadow.camera.right = 400;
    dir.shadow.camera.top = 400;
    dir.shadow.camera.bottom = -400;
    scene.add(dir);

    // Ground (grass)
    const grass = new THREE.Mesh(
      new THREE.CircleGeometry(800, 128),
      new THREE.MeshStandardMaterial({ color: 0x2b7a2b })
    );
    grass.rotation.x = -Math.PI / 2;
    grass.receiveShadow = true;
    scene.add(grass);

    // Build NASCAR oval (flat)
    const { track, wall, apron, startFinish, cps } = buildOvalTrack();
    trackMesh = track;
    wallMesh = wall;
    startFinishMesh = startFinish;
    checkpoints = cps;
    scene.add(trackMesh);
    scene.add(apron);
    scene.add(wallMesh);
    scene.add(startFinishMesh);

    // Coins
    coinGroup = buildCoins(TRACK_OUTER_RADIUS_X, TRACK_OUTER_RADIUS_Z, TRACK_WIDTH);
    scene.add(coinGroup);

    // Lane dashes
    scene.add(buildLaneDashes());

    // Car
    const rig = new THREE.Object3D();
    rig.position.copy(getPointOnOval(0.0)); // on start/finish
    rig.position.y = 0.3;
    carRig = rig;
    scene.add(carRig);

    carBody = buildCarPlaceholder();
    carRig.add(carBody);

    // Camera boom
    const boom = new THREE.Object3D();
    boom.position.set(0, 4, 0);
    carRig.add(boom);

    const camRig = new THREE.Object3D();
    camRig.position.set(0, 6, -14);
    boom.add(camRig);
    camRig.add(camera);

    // Clock
    clock = new THREE.Clock();

    // Events
    window.addEventListener('resize', onResize);
    window.addEventListener('keydown', (e) => { keys[e.key.toLowerCase()] = true; if (e.key === 'Escape') stop(); });
    window.addEventListener('keyup',   (e) => { keys[e.key.toLowerCase()] = false; });

    // Toggle/start
    if (toggleBtn) toggleBtn.addEventListener('click', () => (running ? stop() : start()));
    if (exitBtn) exitBtn.addEventListener('click', stop);

    // Start immediately if no toggle present
    start();
  }

  function onResize() {
    const w = window.innerWidth, h = window.innerHeight;
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
    renderer.setSize(w, h);
  }

  function start() {
    if (gameLayer) gameLayer.style.display = 'block';
    if (running) return;
    running = true;
    ui.root.style.display = 'block';
    lap = 0;
    bestLap = null;
    nextCheckpoint = 0;
    speed = 0;
    heading = -Math.PI / 2; // facing +Z (down the front stretch)
    boost = params.maxBoost;
    carRig.position.copy(getPointOnOval(0.262));
    carRig.rotation.y = heading;
    lapStartTime = performance.now();
    animate();
  }

  function stop() {
    if (gameLayer) gameLayer.style.display = 'none';
    running = false;
    ui.root.style.display = 'none';
    if (rafId) cancelAnimationFrame(rafId);
  }

  function animate() {
    const dt = Math.min(0.033, clock.getDelta()); // clamp to ~30 FPS dt
    update(dt);
    renderer.render(scene, camera);
    if (running) rafId = requestAnimationFrame(animate);
  }

  // ======== build track ========

  function buildOvalTrack() {
    // Create an oval using parametric points (outer & inner), then build a single extruded shape.
    const steps = 256;

    // Outer oval radii
    const Rx = TRACK_OUTER_RADIUS_X;
    const Rz = TRACK_OUTER_RADIUS_Z;
    const outer = [];
    for (let i = 0; i < steps; i++) {
      const t = (i / steps) * Math.PI * 2;
      outer.push(new THREE.Vector2(Math.cos(t) * Rx, Math.sin(t) * Rz));
    }

    // Inner edge of asphalt (outer minus width)
    const rInnerX = Rx - TRACK_WIDTH;
    const rInnerZ = Rz - TRACK_WIDTH;
    const inner = [];
    for (let i = steps - 1; i >= 0; i--) {
      const t = (i / steps) * Math.PI * 2;
      inner.push(new THREE.Vector2(Math.cos(t) * rInnerX, Math.sin(t) * rInnerZ));
    }

    // Apron inner (asphalt inner minus apron width)
    const rApronX = rInnerX - APRON_WIDTH;
    const rApronZ = rInnerZ - APRON_WIDTH;

    // Asphalt shape with hole for the infield (apron area will be another mesh)
    const asphaltShape = new THREE.Shape(outer);
    const hole = new THREE.Path(inner);
    asphaltShape.holes.push(hole);

    const asphaltGeo = new THREE.ExtrudeGeometry(asphaltShape, { depth: 0.2, bevelEnabled: false, curveSegments: 64 });
    asphaltGeo.rotateX(-Math.PI / 2);
    const asphaltMat = new THREE.MeshStandardMaterial({ color: 0x2e2e2e, roughness: 1.0, metalness: 0.0 });
    const asphaltMesh = new THREE.Mesh(asphaltGeo, asphaltMat);
    asphaltMesh.receiveShadow = true;
    asphaltMesh.castShadow = false;

    // Apron (lighter asphalt ring)
    const apronOuter = inner.slice().reverse();
    const apronInner = [];
    for (let i = steps - 1; i >= 0; i--) {
      const t = (i / steps) * Math.PI * 2;
      apronInner.push(new THREE.Vector2(Math.cos(t) * rApronX, Math.sin(t) * rApronZ));
    }
    const apronShape = new THREE.Shape(apronOuter);
    apronShape.holes.push(new THREE.Path(apronInner));
    const apronGeo = new THREE.ExtrudeGeometry(apronShape, { depth: 0.05, bevelEnabled: false, curveSegments: 64 });
    apronGeo.rotateX(-Math.PI / 2);
    const apronMat = new THREE.MeshStandardMaterial({ color: 0x4a4a4a, roughness: 1.0 });
    const apronMesh = new THREE.Mesh(apronGeo, apronMat);
    apronMesh.position.y = 0.01;
    apronMesh.receiveShadow = true;

    // Low walls around outer edge
    const wallPts = [];
    for (let i = 0; i <= steps; i++) {
      const t = (i / steps) * Math.PI * 2;
      const x = Math.cos(t) * (Rx + 0.5);
      const z = Math.sin(t) * (Rz + 0.5);
      wallPts.push(new THREE.Vector3(x, 0, z), new THREE.Vector3(x, WALL_HEIGHT, z));
    }
    const wallGeo = new THREE.BufferGeometry().setFromPoints(wallPts);
    const wallMat = new THREE.LineBasicMaterial({ color: 0xffffff });
    const wallLines = new THREE.LineSegments(wallGeo, wallMat);

    // Start/finish checkerboard (generated texture)
    const checker = makeCheckerTexture(16, 16);
    const sfWidth = TRACK_WIDTH;
    const sfPlane = new THREE.Mesh(
      new THREE.PlaneGeometry(3.2, TRACK_WIDTH),
      new THREE.MeshBasicMaterial({ map: checker, transparent: true })
    );
    sfPlane.rotation.x = -Math.PI / 2;
    // Position at the boundary between asphalt and apron
    const boundaryZ = (TRACK_OUTER_RADIUS_Z - TRACK_WIDTH) + 9.18;
    sfPlane.position.set(-10, 0.25, boundaryZ);

    // Checkpoint lines (four quadrants)
    const cps = [];
    const quadAngles = [0, Math.PI * 0.5, Math.PI, Math.PI * 1.5]; // +X, +Z, -X, -Z (clockwise order when driving CCW)
    for (let i = 0; i < quadAngles.length; i++) {
      const t = quadAngles[i];
      const p = getPointOnOval2D(t, (rInnerX + Rx) * 0.5, (rInnerZ + Rz) * 0.5);
      // Normal pointing 'forward' along driving direction (CCW); use tangent rotated -90°
      const tangent = new THREE.Vector2(-Math.sin(t), Math.cos(t));
      cps.push({ p: new THREE.Vector3(p.x, 0, p.y), n: tangent });
    }

    return { track: asphaltMesh, wall: wallLines, apron: apronMesh, startFinish: sfPlane, cps };
  }

  function getPointOnOval2D(t, Rx, Rz) {
    return new THREE.Vector2(Math.cos(t) * Rx, Math.sin(t) * Rz);
  }
  
  function getPointOnOval(progress01) {
    const t = progress01 * Math.PI * 2;
    const v2 = getPointOnOval2D(t, TRACK_OUTER_RADIUS_X - TRACK_WIDTH * 0.5, TRACK_OUTER_RADIUS_Z - TRACK_WIDTH * 0.5);
    return new THREE.Vector3(v2.x, 0, v2.y);
  }  

  function buildLaneDashes() {
    // White dashed line around the middle of the asphalt
    const Rx = TRACK_OUTER_RADIUS_X - TRACK_WIDTH * 0.5;
    const Rz = TRACK_OUTER_RADIUS_Z - TRACK_WIDTH * 0.5;
    const geom = new THREE.BufferGeometry();
    const pts = [];
    const segments = 300;
    const dashEvery = 4;
    for (let i = 0; i < segments; i++) {
      const t0 = (i / segments) * Math.PI * 2;
      const t1 = ((i + 0.5) / segments) * Math.PI * 2;
      if (i % dashEvery === 0) {
        const a = getPointOnOval2D(t0, Rx, Rz);
        const b = getPointOnOval2D(t1, Rx, Rz);
        pts.push(new THREE.Vector3(a.x, 0.25, a.y), new THREE.Vector3(b.x, 0.25, b.y));
      }
    }
    geom.setFromPoints(pts);
    const mat = new THREE.LineBasicMaterial({ color: 0xffffff });
    return new THREE.LineSegments(geom, mat);
  }

  function buildCarPlaceholder() {
    // A simple boxy car with four 'wheels' so you have something to drive immediately.
    const group = new THREE.Group();
  
    const body = new THREE.Mesh(
      new THREE.BoxGeometry(1.6, 0.6, 3.4),
      new THREE.MeshStandardMaterial({ color: 0x1976d2, roughness: 0.8, metalness: 0.2 })
    );
    body.castShadow = true;
    body.position.y = 0.6 * 0.5;
    group.add(body);
  
    const cabin = new THREE.Mesh(
      new THREE.BoxGeometry(1.4, 0.5, 1.6),
      new THREE.MeshStandardMaterial({ color: 0x1565c0, roughness: 0.7 })
    );
    cabin.position.set(0, 0.6 + 0.25, -0.2);
    group.add(cabin);
  
    const wheelGeo = new THREE.CylinderGeometry(0.36, 0.36, 0.5, 16);
    wheelGeo.rotateZ(Math.PI / 2);
    const wheelMat = new THREE.MeshStandardMaterial({ color: 0x111111 });
    
    // Store rear wheels for animation
    const rearWheels = [];
    const wheelOffsets = [
      [ 0.75, 0.3,  1.20], // front right
      [-0.75, 0.3,  1.20], // front left
      [ 0.75, 0.3, -1.20], // rear right
      [-0.75, 0.3, -1.20], // rear left
    ];
    
    wheelOffsets.forEach(([x,y,z], index) => {
      const w = new THREE.Mesh(wheelGeo, wheelMat);
      w.castShadow = true;
      w.position.set(x,y,z);
      group.add(w);
      
      // Store rear wheels (index 2 and 3)
      if (index >= 2) {
        rearWheels.push(w);
      }
    });
  
    // Store rear wheels on the group for animation
    group.userData.rearWheels = rearWheels;
  
    // Car faces forward by default (no rotation needed)
     group.rotation.y = Math.PI;
  
    return group;
  }
  
  
  function makeCheckerTexture(w, h) {
    const cvs = document.createElement('canvas');
    cvs.width = w; cvs.height = h;
    const ctx = cvs.getContext('2d');
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const black = ((x ^ y) & 1) === 0;
        ctx.fillStyle = black ? '#000' : '#fff';
        ctx.fillRect(x, y, 1, 1);
      }
    }
    const tex = new THREE.CanvasTexture(cvs);
    tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
    tex.repeat.set(1, 1);
    tex.anisotropy = 8;
    return tex;
  }

  function getPointOnOval2D(t, Rx, Rz) {
    return new THREE.Vector2(Math.cos(t) * Rx, Math.sin(t) * Rz);
  }

  function getPointOnOval(progress01) {
    const t = progress01 * Math.PI * 2;
    const v2 = getPointOnOval2D(t, TRACK_OUTER_RADIUS_X - TRACK_WIDTH * 0.5, TRACK_OUTER_RADIUS_Z - TRACK_WIDTH * 0.5);
    return new THREE.Vector3(v2.x, 0, v2.y);
  }

  // ======== update ========
  function update(dt) {
    // Input
    const forward = keys['w'] || keys['arrowup'];
    const back    = keys['s'] || keys['arrowdown'];
    const left    = keys['a'] || keys['arrowleft'];
    const right   = keys['d'] || keys['arrowright'];
    const boostKey= keys['shift'] || keys['shiftleft'] || keys['shiftright'];

    // Surface grip (cheap check: are we inside asphalt ring?)
    const onAsphalt = pointInAsphalt(carRig.position.x, carRig.position.z);
    const grip = onAsphalt ? 1.0 : 0.55;
    const maxSpeed = onAsphalt ? params.maxSpeed : params.maxSpeed * 0.5;

    // Acceleration/braking
    if (forward) speed += (boostKey && boost > 0 ? params.boostAccel : params.accel) * dt;
    if (back)    speed -= params.brake * dt;
    // Friction
    const fr = params.friction * (onAsphalt ? 1.0 : 1.6);
    if (!forward && !back) {
      if (speed > 0) speed = Math.max(0, speed - fr * dt);
      if (speed < 0) speed = Math.min(0, speed + fr * dt);
    }
    // Clamp speed
    speed = THREE.MathUtils.clamp(speed, -25, maxSpeed);

    // Boost meter
    if (boostKey && forward && onAsphalt && boost > 0) {
      boost = Math.max(0, boost - params.boostDrain * dt);
    } else {
      boost = Math.min(params.maxBoost, boost + params.boostRegen * dt);
    }
    ui.boost.style.width = `${(boost / params.maxBoost) * 100}%`;

    // Steering
    const steer = (left ? 1 : 0) * (right ? 0 : 1) - (right ? 1 : 0) * (left ? 0 : 1);
    const turn = params.turnRate * steer * (0.6 + 0.4 * (1 - Math.abs(speed) / params.maxSpeed));
    heading += turn * dt * grip;

    // Integrate
    const vx = -Math.sin(heading) * speed * dt;
    const vz = -Math.cos(heading) * speed * dt;
    carRig.position.x += vx;
    carRig.position.z += vz;
    carRig.rotation.y = heading;

    // Animate rear wheels based on speed
    if (carBody && carBody.userData.rearWheels) {
      const wheelRotation = speed * dt * 2; // Adjust multiplier for realistic rotation
      carBody.userData.rearWheels.forEach(wheel => {
        wheel.rotation.x += wheelRotation;
      });
    }

    // Keep slightly above ground
    carRig.position.y = 0.3;

    // If off apron into deep grass (inside the infield hole), gently push back
    confineToPlayableArea();

    // Camera follow (spring) - THIRD PERSON VIEW
    const cam = camera.parent; // camRig
    const desired = new THREE.Vector3(0, 3, -8); // Mario Kart style - much closer
    cam.position.lerp(desired, 1 - Math.pow(0.001, dt));

    // Laps
    handleCheckpointsAndLaps();
    // Coins rotation and pickup
    if (coinGroup) {
      const carPos = carRig.position;
      for (const coin of coinGroup.children) {
        if (!coin.visible) continue;
        coin.rotation.z += 2.0 * dt; // Rotate around Z axis
        // simple distance check in XZ
        const dx = coin.position.x - carPos.x;
        const dz = coin.position.z - carPos.z;
        if ((dx*dx + dz*dz) < 1.2*1.2) {
          coin.visible = false;
          coinsCollected += 1;
          ui.coins.textContent = `${coinsCollected}`;
          flashBanner(`+1 coin (${coinsCollected})`);
        }
      }
    }


    // UI speed + lap timer
    ui.speed.textContent = `${Math.round(speed)}`;
    const now = performance.now();
    const lapMs = now - lapStartTime;
    ui.lapTimer.textContent = formatMs(lapMs);
    ui.lap.textContent = `${lap}`;
    ui.best.textContent = bestLap != null ? formatMs(bestLap) : '--:--.--';
  }

  function formatMs(ms) {
    const s = Math.floor(ms / 1000);
    const m = Math.floor(s / 60);
    const ss = s % 60;
    const cs = Math.floor((ms % 1000) / 10);
    return `${m}:${String(ss).padStart(2,'0')}.${String(cs).padStart(2,'0')}`;
  }

  function pointInAsphalt(x, z) {
    // inside outer ellipse && outside inner ellipse (asphalt ring)
    const inOuter = (x*x)/(TRACK_OUTER_RADIUS_X*TRACK_OUTER_RADIUS_X) + (z*z)/(TRACK_OUTER_RADIUS_Z*TRACK_OUTER_RADIUS_Z) <= 1.0;
    const innerRx = TRACK_OUTER_RADIUS_X - TRACK_WIDTH;
    const innerRz = TRACK_OUTER_RADIUS_Z - TRACK_WIDTH;
    const inInnerHole = (x*x)/(innerRx*innerRx) + (z*z)/(innerRz*innerRz) <= 1.0;
    return inOuter && !inInnerHole;
  }

  function confineToPlayableArea() {
    // Push back from beyond the outside wall slightly, and from deep infield
    const x = carRig.position.x, z = carRig.position.z;
    const out = (x*x)/( (TRACK_OUTER_RADIUS_X+1)*(TRACK_OUTER_RADIUS_X+1) ) + (z*z)/( (TRACK_OUTER_RADIUS_Z+1)*(TRACK_OUTER_RADIUS_Z+1) );
    if (out > 1.0) {
      // pull back along radial
      const angle = Math.atan2(z, x);
      const Rx = TRACK_OUTER_RADIUS_X - 1;
      const Rz = TRACK_OUTER_RADIUS_Z - 1;
      carRig.position.x = Math.cos(angle) * Rx;
      carRig.position.z = Math.sin(angle) * Rz;
      speed *= 0.6;
    }
    // Deep infield
    const innerRx = TRACK_OUTER_RADIUS_X - TRACK_WIDTH - APRON_WIDTH - 1.0;
    const innerRz = TRACK_OUTER_RADIUS_Z - TRACK_WIDTH - APRON_WIDTH - 1.0;
    const inside = (x*x)/(innerRx*innerRx) + (z*z)/(innerRz*innerRz);
    if (inside <= 1.0) {
      // push outward
      const angle = Math.atan2(z, x);
      const edgeRx = innerRx + 1.0;
      const edgeRz = innerRz + 1.0;
      carRig.position.x = Math.cos(angle) * edgeRx;
      carRig.position.z = Math.sin(angle) * edgeRz;
      speed *= 0.5;
    }
  }

  function handleCheckpointsAndLaps() {
    // We advance checkpoints in order when crossing the line defined by normal n at point p with a forward projection.
    const cp = checkpoints[nextCheckpoint];
    const rel = new THREE.Vector2(carRig.position.x - cp.p.x, carRig.position.z - cp.p.z);
    const crossed = rel.dot(cp.n) > 0; // moved 'forward' across the line
    if (crossed) {
      nextCheckpoint = (nextCheckpoint + 1) % checkpoints.length;
      // Completed full lap when we wrap from last cp to cp 0
      if (nextCheckpoint === 0) {
        lap += 1;
        const now = performance.now();
        const lapTime = now - lapStartTime;
        lapStartTime = now;
        if (bestLap == null || lapTime < bestLap) bestLap = lapTime;
        flashBanner(`Lap ${lap} — ${formatMs(lapTime)}`);
      }
    }
  }

  // ======== simple UI ========
  function ensureUI() {
    // Create a tiny hud if none exists
    let hud = document.getElementById('hud');
    if (!hud) {
      hud = document.createElement('div');
      hud.id = 'hud';
      hud.style.position = 'fixed';
      hud.style.left = '12px';
      hud.style.top = '12px';
      hud.style.zIndex = '10000';
      hud.style.fontFamily = 'system-ui, -apple-system, Segoe UI, Roboto, sans-serif';
      hud.style.color = '#fff';
      hud.style.textShadow = '0 1px 2px rgba(0,0,0,0.6)';
      hud.innerHTML = `
        <div style="display:flex; gap:16px; align-items:center">
          <div>Lap: <span id="hudLap">0</span></div><div>Coins: <span id="hudCoins">0</span></div>
          <div>Lap Time: <span id="hudLapTimer">0:00.00</span></div>
          <div>Best: <span id="hudBest">--:--.--</span></div>
          <div>Speed: <span id="hudSpeed">0</span> u/s</div>
        </div>
        <div style="margin-top:8px; width:220px; height:8px; border:1px solid rgba(255,255,255,0.6)">
          <div id="hudBoost" style="height:100%; width:100%; background:#19d27d"></div>
        </div>
      `;
      document.body.appendChild(hud);
      hud.style.display = 'none'; // Hide initially
    }
    // Banner
    let banner = document.getElementById('hudBanner');
    if (!banner) {
      banner = document.createElement('div');
      banner.id = 'hudBanner';
      banner.style.position = 'fixed';
      banner.style.top = '24px';
      banner.style.right = '24px';
      banner.style.padding = '10px 14px';
      banner.style.background = 'rgba(0,0,0,0.6)';
      banner.style.color = '#fff';
      banner.style.borderRadius = '8px';
      banner.style.fontWeight = '600';
      banner.style.display = 'none';
      banner.style.zIndex = '10001';
      document.body.appendChild(banner);
    }
    return {
      root: hud,
      speed: document.getElementById('hudSpeed'),
      lap: document.getElementById('hudLap'),
      lapTimer: document.getElementById('hudLapTimer'),
      best: document.getElementById('hudBest'),
      coins: document.getElementById('hudCoins'),
      boost: document.getElementById('hudBoost'),
      banner
    };
  }

  function flashBanner(text) {
    const el = document.getElementById('hudBanner');
    if (!el) return;
    el.textContent = text;
    el.style.display = 'block';
    el.style.opacity = '1';
    el.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 1800, easing: 'ease-out' }).onfinish = () => {
      el.style.display = 'none';
    };
  }


  function buildCoins(outerX, outerZ, trackWidth, count = 36) {
    const group = new THREE.Group();
    const Rx = outerX - trackWidth * 0.75;
    const Rz = outerZ - trackWidth * 0.75;
    
    for (let i = 0; i < count; i++) {
      const t = (i / count) * Math.PI * 2;
      const pos = getPointOnOval2D(t, Rx, Rz);
      
      // Simple coin with DW text
      const coin = new THREE.Mesh(
        new THREE.CylinderGeometry(1.5, 1.5, 0.3, 24),
        new THREE.MeshStandardMaterial({ color: 0xffd54f, metalness: 0.3, roughness: 0.4, emissive: 0x332200, emissiveIntensity: 0.2 })
      );
      coin.rotation.x = Math.PI / 2;
      coin.position.set(pos.x, 1.8, pos.y);

      coin.castShadow = true;
      coin.userData.alive = true;
      
      // Add simple DW text as small boxes
      const textMat = new THREE.MeshBasicMaterial({ color: 0xff0000 });
      
      // "D" - simple box
      const dBox = new THREE.Mesh(
        new THREE.BoxGeometry(0.6, 0.15, 0.2),
        textMat
      );
      dBox.position.set(-0.5, 0, 0.16);
      coin.add(dBox);
      
      // "W" - simple box
      const wBox = new THREE.Mesh(
        new THREE.BoxGeometry(0.6, 0.15, 0.2),
        textMat
      );
      wBox.position.set(0.5, 0, 0.16);

      coin.add(wBox);
      
      group.add(coin);
    }
    return group;
  }

}

// Initialize when DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initGame);
} else {
  initGame();
}

