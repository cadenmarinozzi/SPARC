import * as THREE from "three";

export default {
  passes: {},
  scene: {
    initialTime: 0,
    relativisticPaths: true,
    camera: {
      position: new THREE.Vector3(0, 0, -15),
    },
    blackHole: {
      position: new THREE.Vector3(0, 0, 0),
      baseTemperature: 10000,
    },
  },
  rendering: {
    delayMs: 100,
    shouldAnimate: false,
  },
};
