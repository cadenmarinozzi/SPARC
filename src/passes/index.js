import { createCombineFragmentShader } from "./utils";

export function createDefaultConfigPasses(config) {
  config.passes.radiativeTransfer = {
    fragmentShader: "/shaders/radiativeTransfer.glsl",
    uniforms: {
      uInputTexture: { value: null },
      uResolution: { value: null },
      uCameraPosition: { value: config.scene.camera.position },
      uRelativisticPaths: { value: config.scene.relativisticPaths },
      uBaseTemperature: { value: config.scene.blackHole.baseTemperature },
      uMaxSteps: { value: config.scene.maxSteps },
      uInitialStepSize: { value: config.scene.initialStepSize },
      uMaxDistance: { value: config.scene.maxDistance },
      uSchwarzschildRadius: {
        value: config.scene.blackHole.schwarzschildRadius,
      },
      uUseInputTexture: { value: config.scene.blackHole.useInputTexture },
      uMass: { value: config.scene.blackHole.schwarzschildRadius / 2.0 },
      uDiskHeight: { value: 0.6 },
      uSpeedScale: { value: config.scene.speedScale },
      uPhotonRingRadius: {
        value: config.scene.blackHole.schwarzschildRadius * 1.5,
      },
      uInnerRadius: {
        value:
          config.scene.blackHole.schwarzschildRadius * 1.5 + config.scene.EPS,
      },
      uOuterRadius: {
        value: config.scene.blackHole.schwarzschildRadius * 1.5 + 8,
      },
      uEmissionCoefficient: {
        value: config.scene.blackHole.emissionCoefficient,
      },
      uAbsorptionCoefficient: {
        value: config.scene.blackHole.absorptionCoefficient,
      },
      uTime: { value: null },
    },
  };

  config.passes.combine = {
    isCombine: true,
    fragmentShader: createCombineFragmentShader(config.passes),
    uniforms: Object.fromEntries(
      Object.keys(config.passes).map((passName) => [
        `t${passName}`,
        { value: null },
      ])
    ),
  };
}
