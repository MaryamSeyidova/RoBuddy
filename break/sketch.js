let particles = [];
let particleCount = 6000;
let t = 0;

let pmx = 0;
let pmy = 0;
let pointerX = 0;
let pointerY = 0;

// ===== p5.sound oscillator =====
let osc;  
let filter;
let soundStarted = false;

function setup() {
  createCanvas(windowWidth, windowHeight);
  // background(255, 0, 0);

  // create oscillator (will start on first click)
  osc = new p5.Oscillator('triangle');
  osc.amp(0); // start silent

  // warm, softer sound by filtering the oscillator
  filter = new p5.LowPass();
  osc.disconnect();
  osc.connect(filter);
  filter.connect();
  filter.freq(900);
  filter.res(0.25);

  for (let i = 0; i < particleCount; i++) {
    particles.push({
      x: random(width),
      y: random(height),
      vx: 0,
      vy: 0
    });
  }

  pointerX = width / 2;
  pointerY = height / 2;
  pmx = pointerX;
  pmy = pointerY;

  if (canvas && canvas.elt) {
    canvas.elt.style.touchAction = "none";
    canvas.elt.style.userSelect = "none";

    const updateFromPointerEvent = (event) => {
      const rect = canvas.elt.getBoundingClientRect();
      const x = map(event.clientX, rect.left, rect.right, 0, width);
      const y = map(event.clientY, rect.top, rect.bottom, 0, height);
      updatePointerState(x, y);

      if (event.pointerType === "touch" || event.pointerType === "pen") {
        enableSound();
      }
    };

    canvas.elt.addEventListener("pointerdown", updateFromPointerEvent);
    canvas.elt.addEventListener("pointermove", updateFromPointerEvent);
    canvas.elt.addEventListener("pointerup", updateFromPointerEvent);
    canvas.elt.addEventListener("pointerleave", updateFromPointerEvent);
    canvas.elt.addEventListener("pointercancel", updateFromPointerEvent);
  }

  // optional instruction
  fill(255);
  textAlign(CENTER, CENTER);
  textSize(24);
  text("Tap or click anywhere to enable sound", width / 2, height / 2);
}

function draw() {
  noStroke();
  fill(35, 0, 0); // color bg
  rect(0, 0, width, height);

  let flowScale = map(pointerY, 0, height, 0.0006, 0.004);
  let chaos = map(pointerX, 0, width, 0.8, 3.2);

  let mouseSpeed = dist(pointerX, pointerY, pmx, pmy);
  let thickness = constrain(mouseSpeed * 0.05, 0.5, 2.5);

  stroke(255, 70);
  strokeWeight(thickness);

  for (let p of particles) {
    let angle =
      noise(p.x * flowScale, p.y * flowScale, t) *
      TWO_PI *
      chaos;

    let fx = cos(angle);
    let fy = sin(angle);

    let dx = pointerX - p.x;
    let dy = pointerY - p.y;
    let d = sqrt(dx * dx + dy * dy) + 0.001;

    if (d < 200) {
      let force = (200 - d) / 200;
      fx += dx / d * force * 0.4;
      fy += dy / d * force * 0.4;
    }

    p.vx = p.vx * 0.85 + fx * 0.5;
    p.vy = p.vy * 0.85 + fy * 0.5;

    let px = p.x;
    let py = p.y;

    p.x += p.vx;
    p.y += p.vy;

    if (p.x < 0) p.x = width;
    if (p.x > width) p.x = 0;
    if (p.y < 0) p.y = height;
    if (p.y > height) p.y = 0;

    // line trail
    line(px, py, p.x, p.y);

    // emergent shapes
    let speed = sqrt(p.vx * p.vx + p.vy * p.vy);

    if (speed > 1.5 && random() < 0.02 * chaos) {
      push();
      translate(p.x, p.y);
      rotate(angle);
      noFill();
      stroke(255, 120);
      strokeWeight(1);

      let s = speed * 4;
      beginShape();
      vertex(-s, 0);
      vertex(0, -s);
      vertex(s, 0);
      vertex(0, s);
      endShape(CLOSE);
      pop();
    }
  }

  pmx = pointerX;
  pmy = pointerY;
  t += 0.003;

  // handle generative sound
  handleSound();
}

function windowResized() {
  resizeCanvas(windowWidth, windowHeight);
}

// =======================================
//  center shape reacting X & Y mouse movement
// =======================================

let lastMouseSpeed = 0;
let centerAlpha = 0;

function updatePointerState(x, y) {
  let prevX = pointerX;
  let prevY = pointerY;

  pointerX = constrain(x, 0, width);
  pointerY = constrain(y, 0, height);

  pmx = prevX;
  pmy = prevY;

  pmouseX = prevX;
  pmouseY = prevY;
  mouseX = pointerX;
  mouseY = pointerY;

  lastMouseSpeed = dist(pointerX, pointerY, prevX, prevY);
}

function mouseMoved() {
  updatePointerState(mouseX, mouseY);
}

function mouseDragged() {
  updatePointerState(mouseX, mouseY);
}

function touchStarted() {
  if (touches.length > 0) {
    updatePointerState(touches[0].x, touches[0].y);
  }
  enableSound();
  return false;
}

function touchMoved() {
  if (touches.length > 0) {
    updatePointerState(touches[0].x, touches[0].y);
    enableSound();
  }
  return false;
}

function touchEnded() {
  if (touches.length > 0) {
    updatePointerState(touches[0].x, touches[0].y);
  }
  return false;
}

p5.prototype.registerMethod("post", () => {
  // fade in/out
  if (lastMouseSpeed > 0.5) {
    centerAlpha += 8;
  } else {
    centerAlpha -= 4;
  }
  centerAlpha = constrain(centerAlpha, 0, 255);

  if (centerAlpha <= 0) return;

  push();
  translate(width / 2, height / 2);

  // vertical movement → size
  let dy = pointerY - pmy;
  let baseSize = map(abs(dy), 0, 50, 60, 260, true);

  // horizontal movement → color
  let dx = pointerX - pmx;
  let palette = [
    color(0, 120, 255),    // bright blue
    color(255, 255, 255),  // white
    color(255, 220, 0),    // yellow
    color(0, 200, 255),    // cyan
    color(255, 0, 255),    // magenta
    color(230, 40, 40),    // red
    color(255, 140, 0)     // orange
  ];
  let idx = floor(map(dx, -width/2, width/2, 0, palette.length)) % palette.length;
  if(idx < 0) idx += palette.length;
  let nextIdx = (idx + 1) % palette.length;
  let mix = (sin(frameCount * 0.03) + 1) * 0.5;
  let col = lerpColor(palette[idx], palette[nextIdx], mix);

  stroke(col.levels[0], col.levels[1], col.levels[2], centerAlpha);
  strokeWeight(50);

  // rotation grows with overall speed
  let spd = constrain(lastMouseSpeed, 0, 40);
  rotate(frameCount * map(spd, 0, 40, 0.002, 0.03));

  rectMode(CENTER);
  rect(0, 0, baseSize, baseSize);

  pop();
});

// =======================================
//   SOUND FUNCTION
// =======================================

function handleSound() {
  if (!soundStarted) return; // wait for click

  // speed → volume, reduced significantly for a much quieter sound
  let speed = lastMouseSpeed;
  let vol = map(speed, 0, 40, 0, 0.06, true);

  // vertical movement → lower, warmer frequency range
  let freq = map(pointerY, 0, height, 240, 80);

  // horizontal movement → panning
  let pan = map(pointerX, 0, width, -1, 1);

  // warm the tone by rolling off higher frequencies
  filter.freq(map(pointerY, 0, height, 1200, 350));
  filter.res(0.35);

  if (speed > 0.10) {
    osc.freq(freq);
    osc.amp(vol, 0.08); // gentler fade in
    osc.pan(pan);
  } else {
    osc.amp(0, 0.15); // smoother fade out
  }
}

function enableSound() {
  if (soundStarted) return;

  userStartAudio();
  osc.start();
  osc.amp(0);
  soundStarted = true;

  const unlockButton = document.getElementById("audio-unlock");
  if (unlockButton) {
    unlockButton.style.display = "none";
  }
}

// 🎵 SOUND: unlock audio on first click/tap
function mousePressed() {
  if (window.matchMedia("(pointer: coarse)").matches) {
    return;
  }
  enableSound();
}

window.addEventListener("DOMContentLoaded", () => {
  const unlockButton = document.getElementById("audio-unlock");
  if (!unlockButton) return;

  if (!window.matchMedia("(pointer: coarse)").matches) {
    unlockButton.style.display = "none";
    return;
  }

  unlockButton.addEventListener("pointerdown", () => {
    enableSound();
  });
});
