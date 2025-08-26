import * as THREE from "three";
import config from "./config.js";

const windowWidth = window.innerWidth / 2;
const windowHeight = window.innerHeight / 2;

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

config.passes.blackHole = {
  fragmentShader: "/src/shaders/blackHoleFrag.glsl",
  uniforms: {
    uResolution: { value: null },
    uCameraPosition: { value: config.scene.camera.position },
    uRelativisticPaths: { value: config.scene.relativisticPaths },
    uBaseTemperature: { value: config.scene.blackHole.baseTemperature },
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

const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(windowWidth, windowHeight);
renderer.domElement.style = "width: 100%; height: 100%;";
document.body.appendChild(renderer.domElement);

const MS_IN_SECOND = 1000;

async function fetchShader(file) {
  const result = await fetch(file);
  const body = await result.text();

  return body;
}

async function load() {
  const vertexShader = await fetchShader("/src/shaders/vert.glsl");
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
        renderer.setRenderTarget(renderTarget);
      }

      renderer.render(scene, camera);
    }
  }

  function animate(t = config.scene.initialTime) {
    render(t);

    if (config.rendering.shouldAnimate)
      setTimeout(() => {
        animate(t + config.rendering.delayMs);
      }, config.rendering.delayMs);
  }

  animate();
}

load();
