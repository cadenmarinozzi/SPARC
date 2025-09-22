import { saveAs } from "file-saver";
import JSZip from "jszip";
import * as THREE from "three";
import config from "./config";
import { MS_IN_SECOND } from "./constants";
import { fetchShader } from "./IO/assets";
import { readH5File } from "./IO/hdf5";
import { linearInterpolate3 } from "./utils";

export default class Simulation {
  constructor() {
    this.simulationTime = config.scene.initialTime;
    this.timeStep = (1 / 60) * MS_IN_SECOND;
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

    this.state = {
      camera: {
        position: config.scene.camera.position.clone(),
        rotation: config.scene.camera.rotation.clone(),
      },
    };
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
      const rhoSlice = rho.slice(i * N, (i + 1) * N).map((x) => x * 20);

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
      preserveDrawingBuffer: config.rendering.output.save,
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

  warmUpTextures = () => {
    const gl = this.renderer.getContext();

    for (const tex of this.timeTextures) {
      try {
        if (this.renderer.initTexture) this.renderer.initTexture(tex);
      } catch (e) {
        const dummyMat = new THREE.MeshBasicMaterial({ map: tex });
        const quad = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), dummyMat);
        const scene = new THREE.Scene();
        scene.add(quad);

        this.renderer.setRenderTarget(this.combineRenderTarget);
        this.renderer.clear();
        this.renderer.render(scene, this.camera);

        dummyMat.dispose();
        quad.geometry.dispose();
      }
    }

    if (gl && gl.finish) gl.finish();
  };

  canvasToDataURL = (imageType) => {
    return new Promise((resolve, reject) => {
      const mime = `image/${imageType}`;

      this.renderer.domElement.toBlob((blob) => {
        if (!blob) return reject(new Error("toBlob produced no blob"));

        const reader = new FileReader();
        reader.onerror = (err) => reject(err);
        reader.onloadend = () => {
          resolve(reader.result);
        };
        reader.readAsDataURL(blob);
      }, mime);
    });
  };

  handleRenderPass = (pass) => {
    const { renderTarget, scene, material, name } = pass;
    const timeSeconds = this.simulationTime / MS_IN_SECOND;

    if (config.debug) console.log(`Rendering pass: ${name}`);

    if (material.uniforms.uTime) {
      material.uniforms.uTime.value = timeSeconds;
    }

    if (
      config.scene.blackHole.useInputTexture &&
      this.timeIndex < this.nTimeFrames &&
      material.uniforms.uInputTexture
    ) {
      material.uniforms.uInputTexture.value = this.timeTextures[this.timeIndex];
    }

    if (material.uniforms.uResolution) {
      material.uniforms.uResolution.value = this.resolution;
    }

    this.renderer.setRenderTarget(renderTarget);
    this.renderer.clear(true, true, true);
    this.renderer.render(scene, this.camera);
  };

  render = async () => {
    const renderStartTime = performance.now();
    this.timeIndex++;

    for (const pass of this.passes) {
      if (!pass.isCombine) this.handleRenderPass(pass);
    }

    const combinePass = this.passes.find(({ isCombine }) => isCombine);

    if (combinePass) {
      for (const {
        name: otherName,
        renderTarget: otherRenderTarget,
        isCombine: otherIsCombine,
      } of this.passes) {
        if (otherIsCombine) continue;

        combinePass.material.uniforms[`t${otherName}`].value =
          otherRenderTarget.texture;
      }

      this.renderer.setRenderTarget(null);
      this.renderer.clear(true, true, true);
      this.renderer.render(combinePass.scene, this.camera);
    }

    const gl = this.renderer.getContext();

    if (gl && gl.finish) {
      gl.finish();
    }

    if (config.rendering.shouldAnimate && config.rendering.output.save) {
      const imageType = config.rendering.output.video.imageType;

      try {
        const dataUrl = await this.canvasToDataURL(imageType);
        this.frames.push(dataUrl);
      } catch (err) {
        console.error("Failed to save frame:", err);
      }
    }

    const renderEndTime = performance.now();
    const deltaTime = renderEndTime - renderStartTime;

    if (config.debug)
      console.log(`Frame took ${deltaTime / MS_IN_SECOND} seconds to render`);
  };

  updateState = () => {
    if (!config.scene.animation) return;

    const currentCameraPosition = linearInterpolate3(
      config.scene.animation.start.camera.position,
      config.scene.animation.end.camera.position,
      (this.simulationTime - config.scene.initialTime) / config.scene.duration
    );

    const currentCameraRotation = linearInterpolate3(
      config.scene.animation.start.camera.rotation,
      config.scene.animation.end.camera.rotation,
      // 1
      (this.simulationTime - config.scene.initialTime) / config.scene.duration
    );

    this.state.camera.position = currentCameraPosition;
    this.state.camera.rotation = currentCameraRotation;

    for (const pass of this.passes) {
      if (pass.material.uniforms.uCameraPosition?.value) {
        pass.material.uniforms.uCameraPosition.value = new THREE.Vector3(
          this.state.camera.position[0],
          this.state.camera.position[1],
          this.state.camera.position[2]
        );
      }

      if (pass.material.uniforms.uCameraRotation?.value) {
        pass.material.uniforms.uCameraRotation.value = new THREE.Vector3(
          this.state.camera.rotation[0],
          this.state.camera.rotation[1],
          this.state.camera.rotation[2]
        );
      }
    }
  };

  animate = () => {
    this.simulationTime += this.timeStep;

    this.render();
    this.updateState();

    const finished =
      (config.scene.duration &&
        this.simulationTime - config.scene.initialTime >=
          config.scene.duration) ||
      !config.rendering.shouldAnimate;

    if (finished) {
      this.handleAnimationFinished();

      if (config.debug)
        console.log(`Finished. Simulation time: ${this.simulationTime}`);

      return;
    }

    requestAnimationFrame(this.animate);
  };
}
