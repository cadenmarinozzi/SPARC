import * as THREE from "three";

export default {
  debug: false,
  passes: [],
  scene: {
    initialTime: 5000,
    duration: 2000,
    maxSteps: 1500,
    speedScale: 5,
    minStepSize: 0.001,
    maxStepSize: 0.05,
    maxDistance: 40,
    EPS: 1e-4,
    relativisticPaths: true,
    brightnessScale: 1000,
    observerFrequency: 0.0015,
    camera: {
      position: new THREE.Vector3(0, 0, -25),
      rotation: new THREE.Vector3(0.2, 0, 0),
    },
    blackHole: {
      innerRadiusCoefficient: 3,
      diskHeight: 0.4,
      schwarzschildRadius: 1,
      useInputTexture: false,
      thickDisk: true,
      inputDataHeight: 0.2,
      inputDataPath: "/inputs/grmhd_history.h5",
      baseTemperature: 10000,
    },
    animation: {
      start: {
        camera: {
          position: [0, 0, -25],
          rotation: [0.5, 0, 0],
        },
      },
      end: {
        camera: {
          position: [0, 0, -20],
          rotation: [-0.1, 0, 0],
        },
      },
      stepSize: 0.001,
    },
  },
  rendering: {
    logColor: true,
    gammaColor: false,
    gammaFactor: 2.2,
    logFactor: 5,
    resolution: {
      width: 1920,
      height: 1920 * (window.innerHeight / window.innerWidth),
    },
    shouldAnimate: false,
    output: {
      save: true,
      image: {
        type: "png",
      },
      video: {
        imageType: "jpeg",
      },
    },
  },
};
