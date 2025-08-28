import { saveAs } from "file-saver";
import JSZip from "jszip";
import * as THREE from "three";
import config from "../config";
import { MS_IN_SECOND } from "../constants";
import { fetchShader } from "../IO/assets";
import { readH5File } from "../IO/hdf5";

export default class Simulation {
  constructor() {
    this.timeElapsed = config.scene.initialTime;
    this.timeIndex = 0;

    this.windowWidth = config.rendering.resolution.width;
    this.windowHeight = config.rendering.resolution.height;

    this.resolution = new THREE.Vector2(this.windowWidth, this.windowHeight);

    this.frames = [];

    this.nTimeFrames = null;
    this.passes = null;

    this.renderer = null;
    this.camera = null;

    this.timeTextures = [];

    this.passes = [];
  }

  createPasses = async () => {
    const vertexShader = await fetchShader("/shaders/vert.glsl");
    const geometry = new THREE.PlaneGeometry(2, 2);

    for (const { name, uniforms, fragmentShader, isCombine } of config.passes) {
      const shaderSource = isCombine
        ? fragmentShader
        : await fetchShader(fragmentShader);

      const shader = {
        uniforms,
        fragmentShader: shaderSource,
        vertexShader,
      };

      const renderTarget = new THREE.WebGLRenderTarget(
        this.windowWidth,
        this.windowHeight
      );
      const material = new THREE.ShaderMaterial(shader);
      const quad = new THREE.Mesh(geometry, material);
      const scene = new THREE.Scene();
      scene.add(quad);

      this.passes.push({
        name,
        shader,
        quad,
        scene,
        renderTarget,
        material,
        isCombine,
      });
    }
  };

  readInputData = async () => {
    const { rho, t } = await readH5File(config.scene.blackHole.inputDataPath);

    const nTimeFrames = t.length;
    this.nTimeFrames = nTimeFrames;

    const size = Math.sqrt(rho.length / nTimeFrames);
    const N = size * size;

    for (let i = 0; i < nTimeFrames; i++) {
      const rhoSlice = rho.slice(i * N, (i + 1) * N);

      const data = new Float32Array(N);
      data.set(rhoSlice);

      const texture = new THREE.DataTexture(data, size, size);
      texture.format = THREE.RedFormat;
      texture.type = THREE.FloatType;
      texture.minFilter = THREE.LinearFilter;
      texture.magFilter = THREE.LinearFilter;
      texture.unpackAlignment = 1;
      texture.needsUpdate = true;

      this.timeTextures.push(texture);
    }
  };

  initRenderer = () => {
    this.camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
    this.renderer = new THREE.WebGLRenderer({
      preserveDrawingBuffer: true,
    });

    this.renderer.setSize(this.windowWidth, this.windowHeight);
    this.renderer.domElement.style = "width: 100%; height: 100%;";
    document.body.appendChild(this.renderer.domElement);
  };

  download = async () => {
    if (config.rendering.shouldAnimate) {
      const imageType = config.rendering.output.video.imageType;

      const zip = new JSZip();
      const folder = zip.folder("images");

      for (const [index, frame] of this.frames.entries()) {
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
      this.renderer.domElement.toBlob((blob) =>
        saveAs(blob, `output.${imageType}`)
      );
    }
  };

  handleAnimationFinished = () => {
    const downloadButton = document.querySelector("button");
    downloadButton.style.display = "block";
    downloadButton.addEventListener("click", this.download);
  };

  handleRenderPass = (pass) => {
    const { renderTarget, scene, material, isCombine } = pass;
    const timeSeconds = this.timeElapsed / MS_IN_SECOND;

    if (material.uniforms.uTime) {
      material.uniforms.uTime.value = timeSeconds;
    }

    if (
      config.scene.blackHole.useInputTexture &&
      this.timeIndex < this.nTimeFrames &&
      material.uniforms.uInputTexture &&
      material.uniforms.uInputTexture !== this.timeTextures[this.timeIndex]
    ) {
      material.uniforms.uInputTexture.value = this.timeTextures[this.timeIndex];
    }

    if (
      material.uniforms.uResolution &&
      material.uniforms.uResolution.value !== this.resolution
    ) {
      material.uniforms.uResolution.value = this.resolution;
    }

    if (isCombine) {
      for (const {
        name: otherName,
        renderTarget: otherRenderTarget,
        isCombine: otherIsCombine,
      } of this.passes) {
        if (otherIsCombine) continue;

        material.uniforms[`t${otherName}`].value = otherRenderTarget.texture;
      }

      this.renderer.setRenderTarget(null);
      this.renderer.render(scene, this.camera);

      return;
    }

    this.renderer.setRenderTarget(renderTarget);
    this.renderer.render(scene, this.camera);
  };

  render = async () => {
    const renderStartTime = performance.now();
    this.timeIndex++;

    for (const pass of this.passes) {
      this.handleRenderPass(pass);

      if (config.rendering.shouldAnimate && config.rendering.output.save) {
        const imageType = config.rendering.output.video.imageType;
        const frame = this.renderer.domElement.toDataURL(`image/${imageType}`);
        this.frames.push(frame);
      }
    }

    const renderEndTime = performance.now();
    const deltaTime = renderEndTime - renderStartTime;

    if (config.debug)
      console.log(`Frame took ${deltaTime / MS_IN_SECOND} seconds to render`);
  };

  animate = (t = this.timeElapsed) => {
    this.timeElapsed = t;
    this.render();

    const finished =
      (config.scene.duration && t >= config.scene.duration) ||
      !config.rendering.shouldAnimate;

    if (finished) {
      this.handleAnimationFinished();

      if (config.debug)
        console.log(`Finished. Time elapsed: ${this.timeElapsed}`);

      return;
    }

    const delayMs = config.rendering.delayMs;

    if (delayMs && delayMs > 0) {
      const nextFrame = t + delayMs;

      const loop = (t) => {
        if (t >= nextFrame) {
          this.animate(t);
        } else {
          requestAnimationFrame(loop);
        }
      };

      requestAnimationFrame(loop);
    } else {
      requestAnimationFrame((t) => this.animate(t + config.scene.initialTime));
    }
  };
}
