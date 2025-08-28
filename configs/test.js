import * as THREE from "three";

export default {
  debug: false,
  passes: [],
  scene: {
    initialTime: 6000,
    duration: 0,
    maxSteps: 5000,
    speedScale: 5,
    minStepSize: 0.001,
    maxStepSize: 0.05,
    maxDistance: 40,
    gravitationalConstant: 1,
    EPS: 1e-4,
    relativisticPaths: true,
    brightnessScale: 5000,
    observerFrequency: 0.0009,
    camera: {
      position: new THREE.Vector3(0, 0, -30),
      rotation: new THREE.Vector3(0.5, 0, 0),
    },
    blackHole: {
      diskHeight: 0.3,
      schwarzschildRadius: 1,
      useInputTexture: false,
      thickDisk: true,
      inputDataHeight: 0.2,
      inputDataPath: "/inputs/grmhd_history.h5",
      baseTemperature: 10000,
      emissionCoefficient: 20,
      absorptionCoefficient: 0.001,
    },
  },
  rendering: {
    logFactor: 5,
    resolution: {
      width: window.innerWidth, //300, //window.innerWidth,
      height: window.innerHeight, //300 * (window.innerHeight / window.innerWidth), //window.innerHeight,
    },
    delayMs: 100,
    shouldAnimate: false,
    output: {
      save: false,
      image: {
        type: "png",
      },
      video: {
        imageType: "jpeg",
      },
    },
  },
};
