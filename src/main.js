import { saveAs } from "file-saver";
import JSZip from "jszip";
import * as THREE from "three";
import config from "./config.js";

const windowWidth = config.rendering.resolution.width;
const windowHeight = config.rendering.resolution.height;

const MS_IN_SECOND = 1000;

function createCombineFragmentShader() {
  const passNames = Object.keys(config.passes);

  return `
  ${passNames.map((passName) => `uniform sampler2D t${passName};`).join("\n")}

  varying vec2 vUv;

  void main() {
    ${passNames
      .map(
        (passName) =>
          `vec3 ${passName}Color = texture2D(t${passName}, vUv).rgb;`
      )
      .join("\n")}


    gl_FragColor = vec4(${passNames
      .map((passName) => `${passName}Color`)
      .join("+")}, 1.0);
  }`;
}

config.passes.radiativeTransfer = {
  fragmentShader: "/shaders/radiativeTransfer.glsl",
  uniforms: {
    uResolution: { value: null },
    uCameraPosition: { value: config.scene.camera.position },
    uRelativisticPaths: { value: config.scene.relativisticPaths },
    uBaseTemperature: { value: config.scene.blackHole.baseTemperature },
    uMaxSteps: { value: config.scene.maxSteps },
    uInitialStepSize: { value: config.scene.initialStepSize },
    uMaxDistance: { value: config.scene.maxDistance },
    uSchwarzschildRadius: { value: config.scene.schwarzschildRadius },
    uMass: { value: config.scene.schwarzschildRadius / 2.0 },
    uDiskHeight: { value: 0.6 },
    uPhotonRingRadius: { value: config.scene.schwarzschildRadius * 1.5 },
    uInnerRadius: {
      value: config.scene.schwarzschildRadius * 1.5 + config.scene.EPS,
    },
    uOuterRadius: {
      value: config.scene.schwarzschildRadius * 1.5 + 8,
    },
    uEmissionCoefficient: {
      value: config.scene.blackHole.emissionCoefficient,
    },
    uAbsorptionCoefficient: {
      value: config.scene.blackHole.absorptionCoefficient,
    },
    uTime: { value: null },
  },
};

config.passes.combine = {
  isCombine: true,
  fragmentShader: createCombineFragmentShader(),
  uniforms: Object.fromEntries(
    Object.keys(config.passes).map((passName) => [
      `t${passName}`,
      { value: null },
    ])
  ),
};

const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
const geometry = new THREE.PlaneGeometry(2, 2);

const renderer = new THREE.WebGLRenderer({
  preserveDrawingBuffer: true,
});
renderer.setSize(windowWidth, windowHeight);
renderer.domElement.style = "width: 100%; height: 100%;";
document.body.appendChild(renderer.domElement);

async function fetchShader(file) {
  const result = await fetch(`${file}?t=${Date.now()}`);
  const body = await result.text();

  return body;
}

async function load() {
  const vertexShader = await fetchShader("/shaders/vert.glsl");
  const passes = {};

  for (const [
    passName,
    { uniforms, fragmentShader, isCombine },
  ] of Object.entries(config.passes)) {
    const shaderSource = isCombine
      ? fragmentShader
      : await fetchShader(fragmentShader);

    const shader = {
      uniforms,
      fragmentShader: shaderSource,
      vertexShader,
    };

    const renderTarget = new THREE.WebGLRenderTarget(windowWidth, windowHeight);
    const material = new THREE.ShaderMaterial(shader);
    const quad = new THREE.Mesh(geometry, material);
    const scene = new THREE.Scene();
    scene.add(quad);

    passes[passName] = {
      shader,
      quad,
      scene,
      renderTarget,
      material,
      isCombine,
    };
  }

  const Nx = 64; // x grid size
  const Ny = 64; // y grid size
  const Nz = 64; // z grid size
  const R = 0.3; // torus major radius (normalized 0..1)
  const r = 0.1; // torus minor radius (thickness)

  // -----------------------------
  // Create data array (RGBA)
  // -----------------------------
  const dataArray = new Float32Array(Nx * Ny * Nz * 4);

  for (let i = 0; i < Nx; i++) {
    const x = (i / (Nx - 1)) * 2 - 1; // normalize -1..1
    for (let j = 0; j < Ny; j++) {
      const y = (j / (Ny - 1)) * 2 - 1;
      for (let k = 0; k < Nz; k++) {
        const z = (k / (Nz - 1)) * 2 - 1;

        // distance from torus center
        const rho = Math.sqrt(x * x + z * z);
        const dist = Math.sqrt((rho - R) ** 2 + y * y);

        // Simple torus: 1 inside, 0 outside
        const value = dist < r ? 1.0 : 0.0;

        const idx = 4 * (i * Ny * Nz + j * Nz + k);
        dataArray[idx + 0] = value; // R channel -> density
        dataArray[idx + 1] = 0.5; // G channel -> temperature
        dataArray[idx + 2] = 0.0; // B channel -> velocity placeholder
        dataArray[idx + 3] = 0.0; // A channel -> B-field placeholder
      }
    }
  }

  const texture = new THREE.Data3DTexture(dataArray, Nx, Ny, Nz);
  texture.format = THREE.RGBAFormat;
  texture.type = THREE.FloatType;
  texture.minFilter = THREE.LinearFilter;
  texture.magFilter = THREE.LinearFilter;
  texture.unpackAlignment = 1;

  const frames = [];

  function render(t) {
    const timeSeconds = t / MS_IN_SECOND;

    for (const { renderTarget, scene, material, isCombine } of Object.values(
      passes
    )) {
      if (material.uniforms.uTime) material.uniforms.uTime.value = timeSeconds;
      if (material.uniforms.uResolution)
        material.uniforms.uResolution.value = new THREE.Vector2(
          windowWidth,
          windowHeight
        );

      if (isCombine) {
        for (const [
          otherPassName,
          { renderTarget: otherRenderTarget, isCombine: otherIsCombine },
        ] of Object.entries(passes)) {
          if (otherIsCombine) continue;

          material.uniforms[`t${otherPassName}`].value =
            otherRenderTarget.texture;
        }

        renderer.setRenderTarget(null);
      } else {
        material.uniforms.diskTexture = texture;
        renderer.setRenderTarget(renderTarget);
      }

      renderer.render(scene, camera);

      if (config.rendering.shouldAnimate && config.rendering.output.save) {
        const imageType = config.rendering.output.video.imageType;
        const frame = renderer.domElement.toDataURL(`image/${imageType}`);
        frames.push(frame);
      }
    }
  }

  async function download() {
    if (config.rendering.shouldAnimate) {
      const imageType = config.rendering.output.video.imageType;

      const zip = new JSZip();
      const folder = zip.folder("images");

      for (const [index, frame] of frames.entries()) {
        const data = frame.replace(/^data:image\/\w+;base64,/, "");
        const fileName = `${index.toString().padStart(4, "0")}.${imageType}`;

        folder.file(fileName, data, {
          base64: true,
        });
      }

      const content = await zip.generateAsync({ type: "blob" });
      saveAs(content, "images.zip");
    } else {
      const imageType = config.rendering.output.image.type;
      renderer.domElement.toBlob((blob) => saveAs(blob, `output.${imageType}`));
    }
  }

  function handleAnimationFinished() {
    const downloadButton = document.querySelector("button");
    downloadButton.style.display = "block";
    downloadButton.addEventListener("click", download);
  }

  function animate(t = config.scene.initialTime) {
    render(t);

    if (t >= config.scene.duration || !config.rendering.shouldAnimate) {
      handleAnimationFinished();

      return;
    }

    if (!config.rendering.shouldAnimate) return;

    const delayMs = config.rendering.delayMs;

    if (delayMs && delayMs > 0) {
      setTimeout(() => animate(t + delayMs), delayMs);
    } else {
      requestAnimationFrame(animate);
    }
  }

  animate();
}

load();
