import config from "../config.js";
import { createCombineFragmentShader } from "./utils";

export function createDefaultConfigPasses() {
  config.passes.push({
    name: "rayMarchRadiativeTransfer",
    fragmentShader: "/shaders/rayMarchRadiativeTransfer.glsl",
    uniforms: {
      uInputTexture: { value: null },
      uResolution: { value: null },
      uThickDisk: { value: config.scene.blackHole.thickDisk },
      uCameraPosition: { value: config.scene.camera.position },
      uCameraRotation: { value: config.scene.camera.rotation },
      uInputDataHeight: { value: config.scene.blackHole.inputDataHeight },
      uRelativisticPaths: { value: config.scene.relativisticPaths },
      uBaseTemperature: { value: config.scene.blackHole.baseTemperature },
      uMaxSteps: { value: config.scene.maxSteps },
      uMaxStepSize: { value: config.scene.maxStepSize },
      uMinStepSize: { value: config.scene.minStepSize },
      uMaxDistance: { value: config.scene.maxDistance },
      uLogFactor: { value: config.rendering.logFactor },
      uSchwarzschildRadius: {
        value: config.scene.blackHole.schwarzschildRadius,
      },
      uUseInputTexture: { value: config.scene.blackHole.useInputTexture },
      uMass: { value: config.scene.blackHole.schwarzschildRadius / 2.0 },
      uDiskHeight: { value: config.scene.blackHole.diskHeight },
      uSpeedScale: { value: config.scene.speedScale },
      uPhotonRingRadius: {
        value: config.scene.blackHole.schwarzschildRadius * 1.5,
      },
      uInnerRadius: {
        value:
          config.scene.blackHole.schwarzschildRadius *
            config.scene.blackHole.innerRadiusCoefficient +
          config.scene.EPS,
      },
      uOuterRadius: {
        value:
          config.scene.blackHole.schwarzschildRadius *
            config.scene.blackHole.innerRadiusCoefficient +
          15,
      },
      uBrightnessScale: {
        value: config.scene.brightnessScale,
      },
      uObserverFrequency: {
        value: config.scene.observerFrequency,
      },
      uTime: { value: null },
    },
  });

  config.passes.push({
    name: "combine",
    isCombine: true,
    fragmentShader: createCombineFragmentShader(config.passes),
    uniforms: Object.fromEntries(
      config.passes.map(({ name }) => [`t${name}`, { value: null }])
    ),
  });
}
