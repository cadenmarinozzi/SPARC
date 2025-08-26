import * as THREE from "three";

export default {
  passes: {},
  scene: {
    initialTime: 0,
    duration: 1000,
    maxSteps: 600,
    initialStepSize: 0.08,
    maxDistance: 40,
    schwarzschildRadius: 1.0,
    EPS: 1e-4,
    relativisticPaths: true,
    camera: {
      position: new THREE.Vector3(0, 0, -15),
    },
    blackHole: {
      position: new THREE.Vector3(0, 0, 0),
      baseTemperature: 10000,
      emissionCoefficient: 10,
      absorptionCoefficient: 0.01,
    },
  },
  rendering: {
    width: window.innerWidth,
    height: window.innerHeight,
    delayMs: 100,
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
