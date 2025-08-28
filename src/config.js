import * as THREE from "three";

export default {
  debug: true,
  passes: {},
  scene: {
    initialTime: 0,
    duration: 0,
    maxSteps: 600,
    speedScale: 1,
    initialStepSize: 0.08,
    maxDistance: 40,
    EPS: 1e-4,
    relativisticPaths: true,
    camera: {
      position: new THREE.Vector3(0, 0, -25),
    },
    blackHole: {
      schwarzschildRadius: 1.0,
      useInputTexture: true,
      inputDataPath: "/inputs/grmhd_history.h5",
      position: new THREE.Vector3(0, 0, 0),
      baseTemperature: 10000,
      emissionCoefficient: 10,
      absorptionCoefficient: 0.01,
    },
  },
  rendering: {
    resolution: {
      width: 300, //window.innerWidth,
      height: 300 * (window.innerHeight / window.innerWidth), //window.innerHeight,
    },
    delayMs: 0,
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
