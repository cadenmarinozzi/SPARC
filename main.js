import * as THREE from "three";

const windowWidth = window.innerWidth / 2;
const windowHeight = window.innerHeight / 2;

const aspectRatio = windowWidth / windowHeight;

const scene = new THREE.Scene();

const camera = new THREE.PerspectiveCamera(90, aspectRatio, 0.1, 1000);
camera.position.z = 1;

const renderer = new THREE.WebGLRenderer();
renderer.setSize(windowWidth, windowHeight);

renderer.domElement.style = "width:100%; height:100%;";

document.body.appendChild(renderer.domElement);

const MS_IN_SECOND = 1000;
const INITIAL_T = 0;

const RENDER_DELAY_MS = 100;
const SHOULD_ANIMATE = true;

async function fetchShader(file) {
  const result = await fetch(file);
  const body = await result.text();

  return body;
}

async function load() {
  const vertexShader = await fetchShader("vert.glsl");
  const fragmentShader = await fetchShader("frag.glsl");

  const textureLoader = new THREE.TextureLoader();
  const blackbodyTexture = await textureLoader.loadAsync("blackbody.png");

  const geometry = new THREE.PlaneGeometry(2 * aspectRatio, 2);
  const material = new THREE.ShaderMaterial({
    uniforms: {
      uResolution: { value: new THREE.Vector2(windowWidth, windowHeight) },
      uTime: { value: 0 },
      uBlackbodyTexture: { value: blackbodyTexture },
    },
    vertexShader,
    fragmentShader,
  });

  const plane = new THREE.Mesh(geometry, material);
  scene.add(plane);

  function render(t) {
    material.uniforms.uTime.value = t / MS_IN_SECOND; // Pass in seconds
    renderer.render(scene, camera);
  }

  function animate(t = INITIAL_T) {
    render(t);

    if (SHOULD_ANIMATE)
      setTimeout(() => {
        animate(t + RENDER_DELAY_MS);
      }, RENDER_DELAY_MS);
  }

  animate();
}

load();
