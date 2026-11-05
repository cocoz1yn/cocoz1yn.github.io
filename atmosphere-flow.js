(() => {
  "use strict";
  const canvas = document.createElement("canvas");
  canvas.className = "ambient-fluid";
  canvas.setAttribute("aria-hidden", "true");
  canvas.setAttribute("role", "presentation");
  document.body.prepend(canvas);

  const motionPreference = window.matchMedia("(prefers-reduced-motion: reduce)");
  const colorPreference = window.matchMedia("(forced-colors: active)");
  const pointer = { x: 0, y: 0, targetX: 0, targetY: 0, velocityX: 0, velocityY: 0, strength: 0, lastMove: -10000 };
  let elapsed = 7;
  let lastFrame = 0;
  let lastDraw = 0;
  let animationFrame = 0;
  let renderer = null;
  let aspect = 1;
  const finish = { chroma: .72, depth: .62, sheen: .4, edgeGrain: .18 };

  const vertexSource = `
    attribute vec2 aPosition;
    void main() { gl_Position = vec4(aPosition, 0.0, 1.0); }
  `;
  const fragmentSource = `
    precision highp float;
    uniform vec2 uResolution;
    uniform float uTime;
    uniform vec2 uPointer;
    uniform vec2 uPointerVelocity;
    uniform float uPointerStrength;
    uniform vec3 uFinish;
    uniform float uEdgeGrain;

    float grainHash(vec2 cell) {
      vec2 p = fract(cell * vec2(0.1031, 0.11369));
      p += dot(p, p + 19.19);
      return fract(p.x * p.y);
    }
    float materialNoise(vec2 position) {
      vec2 cell = floor(position);
      vec2 f = fract(position);
      vec2 blend = f * f * (3.0 - 2.0 * f);
      return mix(
        mix(grainHash(cell), grainHash(cell + vec2(1.0, 0.0)), blend.x),
        mix(grainHash(cell + vec2(0.0, 1.0)), grainHash(cell + vec2(1.0)), blend.x),
        blend.y
      );
    }

    void main() {
      vec2 uv = gl_FragCoord.xy / uResolution;
      vec2 p = (uv * 2.0 - 1.0) * vec2(uResolution.x / uResolution.y, 1.0);
      float t = uTime * 0.62;

      // Local vortices bend the flow around a moving pointer; content never moves.
      vec2 distanceToPointer = p - uPointer;
      float influence = exp(-dot(distanceToPointer, distanceToPointer) * 2.2) * uPointerStrength;
      p += vec2(-distanceToPointer.y, distanceToPointer.x) * influence * 0.95;
      p -= uPointerVelocity * influence * 0.18;

      // Smooth vector warps continuously stretch, curl, and fold the field.
      vec2 q = vec2(
        sin(p.y * 1.25 + t * 0.78) + cos(p.x * 0.9 - t * 0.34) * 0.42,
        cos(p.x * 1.15 - t * 0.63) + sin(p.y * 1.1 + t * 0.43) * 0.38
      );
      vec2 flow = p + q * 0.95;
      for (int i = 0; i < 3; i++) {
        float n = float(i) + 1.0;
        flow += 0.28 / n * vec2(
          sin(flow.y * 1.6 * n + t * 0.5 + n * 2.0),
          cos(flow.x * 1.5 * n - t * 0.42 + n * 1.4)
        );
      }
      float wavePhase = flow.x * 1.8 + flow.y * 1.2 + t * 0.48;
      float foldPhase = flow.y * 3.1 - flow.x * 1.15 - t * 0.78;
      float density = smoothstep(-0.8, 0.8, sin(wavePhase) * 0.68 + sin(foldPhase) * 0.32);

      vec3 paper = vec3(215.0, 215.0, 214.0) / 255.0;
      vec3 blue = vec3(132.0, 160.0, 203.0) / 255.0;
      vec3 lavender = vec3(172.0, 156.0, 201.0) / 255.0;
      vec3 warm = vec3(245.0, 244.0, 241.0) / 255.0;
      float colorMix = smoothstep(-0.95, 0.95, p.x + (q.y - q.x) * 0.35 + sin(t * 0.3) * 0.3);
      vec3 dye = mix(paper, mix(blue, lavender, colorMix), uFinish.x);
      float baseCoverage = smoothstep(0.22, 0.82, density);
      float edge = 4.0 * baseCoverage * (1.0 - baseCoverage);
      float grain = 0.0;
      if (edge > 0.001) {
        // Material-space grain bends with the flow, concentrated in its soft boundary.
        grain = (materialNoise(flow * 180.0 + q * 9.0) * 0.65
          + materialNoise(flow * 360.0 - q * 13.0) * 0.35) * 2.0 - 1.0;
      }
      float coverage = clamp(baseCoverage + grain * edge * uEdgeGrain, 0.0, 1.0);
      vec3 color = mix(paper, dye, coverage * uFinish.y);

      // Broad light and shadow travel over the folds without hard contour lines.
      float lightFold = pow(0.5 + 0.5 * cos(foldPhase), 3.0);
      vec3 normal = normalize(vec3(cos(wavePhase) * 0.35, cos(foldPhase) * 0.45, 0.9));
      float lighting = dot(normal, normalize(vec3(-0.45, 0.65, 1.0)));
      color -= smoothstep(0.15, 0.95, sin(foldPhase + 0.9)) * vec3(0.025, 0.03, 0.037) * coverage * 0.65;
      color = mix(color, warm, lightFold * uFinish.z * coverage);
      color += (lighting - 0.76) * 0.055 * coverage;
      color += grain * edge * uEdgeGrain * 0.16;
      gl_FragColor = vec4(clamp(color, 0.0, 1.0), 1.0);
    }
  `;

  function createWebGLRenderer() {
    const gl = canvas.getContext("webgl", { alpha: false, antialias: false, depth: false, stencil: false, powerPreference: "low-power" });
    if (!gl) return null;
    function compile(type, source) {
      const shader = gl.createShader(type);
      gl.shaderSource(shader, source);
      gl.compileShader(shader);
      if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
        gl.deleteShader(shader);
        return null;
      }
      return shader;
    }
    const vertex = compile(gl.VERTEX_SHADER, vertexSource);
    const precision = gl.getShaderPrecisionFormat(gl.FRAGMENT_SHADER, gl.HIGH_FLOAT);
    const fragment = compile(gl.FRAGMENT_SHADER, precision && precision.precision ? fragmentSource : fragmentSource.replace("precision highp float;", "precision mediump float;"));
    if (!vertex || !fragment) return null;
    const program = gl.createProgram();
    gl.attachShader(program, vertex);
    gl.attachShader(program, fragment);
    gl.linkProgram(program);
    gl.deleteShader(vertex);
    gl.deleteShader(fragment);
    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) return null;
    gl.useProgram(program);
    const buffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
    const position = gl.getAttribLocation(program, "aPosition");
    gl.enableVertexAttribArray(position);
    gl.vertexAttribPointer(position, 2, gl.FLOAT, false, 0, 0);
    const uniforms = Object.fromEntries(["uResolution", "uTime", "uPointer", "uPointerVelocity", "uPointerStrength", "uFinish", "uEdgeGrain"].map(name => [name, gl.getUniformLocation(program, name)]));
    return {
      name: "webgl",
      resize() {
        const pixelBudget = innerWidth <= 760 ? 360000 : 650000;
        const scale = Math.min(window.devicePixelRatio || 1, 1.25, Math.sqrt(pixelBudget / (innerWidth * innerHeight)));
        canvas.width = Math.max(1, Math.round(innerWidth * scale));
        canvas.height = Math.max(1, Math.round(innerHeight * scale));
        gl.viewport(0, 0, canvas.width, canvas.height);
      },
      draw(time) {
        gl.uniform2f(uniforms.uResolution, canvas.width, canvas.height);
        gl.uniform1f(uniforms.uTime, time);
        gl.uniform2f(uniforms.uPointer, pointer.x, pointer.y);
        gl.uniform2f(uniforms.uPointerVelocity, pointer.velocityX, pointer.velocityY);
        gl.uniform1f(uniforms.uPointerStrength, pointer.strength);
        gl.uniform3f(uniforms.uFinish, finish.chroma, finish.depth, finish.sheen);
        gl.uniform1f(uniforms.uEdgeGrain, finish.edgeGrain);
        gl.drawArrays(gl.TRIANGLES, 0, 3);
      }
    };
  }

  function createCanvasRenderer() {
    // A small, smoothly scaled flow field keeps motion available without WebGL.
    const replacement = document.createElement("canvas");
    replacement.className = canvas.className;
    replacement.setAttribute("aria-hidden", "true");
    replacement.setAttribute("role", "presentation");
    const context = replacement.getContext("2d", { alpha: false });
    if (!context) return null;
    canvas.replaceWith(replacement);
    let pixels;
    let width;
    let height;
    const blue = [132, 160, 203];
    const lavender = [172, 156, 201];
    const paper = [215, 215, 214];
    const warm = [245, 244, 241];
    return {
      name: "canvas2d",
      resize() {
        height = 110;
        width = Math.max(80, Math.min(240, Math.round(height * aspect)));
        replacement.width = width;
        replacement.height = height;
        pixels = context.createImageData(width, height);
      },
      draw(time) {
        const t = time * 0.62;
        for (let y = 0; y < height; y++) {
          for (let x = 0; x < width; x++) {
            let u = (x / width * 2 - 1) * aspect;
            let v = 1 - y / height * 2;
            const dx = u - pointer.x;
            const dy = v - pointer.y;
            const influence = Math.exp(-(dx * dx + dy * dy) * 2.2) * pointer.strength;
            u -= dy * influence * 0.8;
            v += dx * influence * 0.8;
            const q = Math.sin(u * 1.3 + v * 1.7 + t * 0.65) * 0.65 + Math.sin(v * 1.5 - t * 0.42) * 0.35;
            const r = Math.cos(v * 1.4 + u * 1.1 - t * 0.55 + q) * 0.7 + Math.sin(u * 1.8 + t * 0.38) * 0.3;
            const density = (Math.sin(u * 1.4 + v * 0.8 + q * 1.9 + r * 1.5) + 1) * 0.5;
            const coveragePosition = Math.max(0, Math.min(1, (density - 0.22) / 0.6));
            const baseCoverage = coveragePosition * coveragePosition * (3 - 2 * coveragePosition);
            const edge = 4 * baseCoverage * (1 - baseCoverage);
            const grainCoordinate = Math.sin(Math.floor((u + q * 0.8) * 96) * 12.9898 + Math.floor((v + r * 0.8) * 96) * 78.233) * 43758.5453;
            const grain = (grainCoordinate - Math.floor(grainCoordinate)) * 2 - 1;
            const coverage = Math.max(0, Math.min(1, baseCoverage + grain * edge * finish.edgeGrain * 0.35));
            const ribbon = Math.pow((Math.sin(u * 1.2 + v * 0.6 + q * 2.6 - r * 1.6 + t * 0.5) + 1) * 0.5, 2) * finish.sheen * coverage;
            const side = Math.max(0, Math.min(1, 0.5 + (u + q * 0.4) * 0.45));
            const depth = coverage * finish.depth;
            const offset = (y * width + x) * 4;
            for (let channel = 0; channel < 3; channel++) {
              const pigment = blue[channel] * (1 - side) + lavender[channel] * side;
              const dye = paper[channel] * (1 - finish.chroma) + pigment * finish.chroma;
              const color = paper[channel] * (1 - depth) + dye * depth;
              pixels.data[offset + channel] = color * (1 - ribbon) + warm[channel] * ribbon + grain * edge * finish.edgeGrain * 3;
            }
            pixels.data[offset + 3] = 255;
          }
        }
        context.putImageData(pixels, 0, 0);
      }
    };
  }

  try { renderer = createWebGLRenderer() || createCanvasRenderer(); }
  catch { renderer = createCanvasRenderer(); }
  if (!renderer) { canvas.remove(); return; }
  document.body.classList.add("fluid-atmosphere-ready");
  document.body.dataset.ambientRenderer = renderer.name;

  function resize() {
    aspect = innerWidth / Math.max(1, innerHeight);
    const theme = getComputedStyle(document.documentElement);
    const readFinish = (name, fallback) => {
      const value = parseFloat(theme.getPropertyValue(name));
      return Number.isFinite(value) ? Math.max(0, Math.min(1, value)) : fallback;
    };
    finish.chroma = readFinish("--ambient-chroma", .72);
    finish.depth = readFinish("--ambient-color-depth", .62);
    finish.sheen = readFinish("--ambient-sheen", .4);
    finish.edgeGrain = readFinish("--ambient-edge-grain", .18);
    renderer.resize();
    renderer.draw(elapsed);
  }
  function updatePointer(now, delta) {
    const ease = 1 - Math.exp(-delta * 4.5);
    pointer.x += (pointer.targetX - pointer.x) * ease;
    pointer.y += (pointer.targetY - pointer.y) * ease;
    const targetStrength = now - pointer.lastMove < 150 ? 0.85 : 0;
    pointer.strength += (targetStrength - pointer.strength) * Math.min(1, delta * 2.5);
    pointer.velocityX *= Math.exp(-delta * 2.5);
    pointer.velocityY *= Math.exp(-delta * 2.5);
  }
  function frame(now) {
    animationFrame = 0;
    if (document.hidden || motionPreference.matches || colorPreference.matches) return;
    const delta = lastFrame ? Math.min((now - lastFrame) / 1000, 0.06) : 0;
    lastFrame = now;
    elapsed += delta;
    updatePointer(now, delta);
    const interval = renderer.name === "webgl" ? 1000 / 30 : 1000 / 18;
    if (now - lastDraw >= interval) {
      renderer.draw(elapsed);
      lastDraw = now;
    }
    animationFrame = requestAnimationFrame(frame);
  }
  function syncMotion() {
    cancelAnimationFrame(animationFrame);
    animationFrame = 0;
    lastFrame = 0;
    if (colorPreference.matches) return;
    if (motionPreference.matches) {
      pointer.strength = 0;
      renderer.draw(elapsed);
    } else if (!document.hidden) {
      animationFrame = requestAnimationFrame(frame);
    }
  }
  window.addEventListener("resize", resize, { passive: true });
  window.addEventListener("pointermove", (event) => {
    if (motionPreference.matches || event.pointerType === "touch") return;
    const x = (event.clientX / innerWidth * 2 - 1) * aspect;
    const y = 1 - event.clientY / innerHeight * 2;
    pointer.velocityX = Math.max(-2, Math.min(2, (x - pointer.targetX) * 8));
    pointer.velocityY = Math.max(-2, Math.min(2, (y - pointer.targetY) * 8));
    pointer.targetX = x;
    pointer.targetY = y;
    pointer.lastMove = performance.now();
  }, { passive: true });
  document.addEventListener("visibilitychange", syncMotion);
  motionPreference.addEventListener("change", syncMotion);
  colorPreference.addEventListener("change", syncMotion);
  canvas.addEventListener("webglcontextlost", (event) => {
    event.preventDefault();
    cancelAnimationFrame(animationFrame);
    document.body.classList.remove("fluid-atmosphere-ready");
    canvas.hidden = true;
  });
  canvas.addEventListener("webglcontextrestored", () => {
    renderer = createWebGLRenderer();
    if (!renderer) return;
    canvas.hidden = false;
    document.body.classList.add("fluid-atmosphere-ready");
    resize();
    syncMotion();
  });
  resize();
  syncMotion();
})();
