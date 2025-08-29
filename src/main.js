import config from "./config.js";
import { createDefaultConfigPasses } from "./passes/index.js";
import Simulation from "./simulation.js";

createDefaultConfigPasses();

const simulation = new Simulation();

async function load() {
  simulation.initRenderer();

  if (config.scene.blackHole.useInputTexture) {
    await simulation.readInputData();
    simulation.warmUpTextures();
  }

  await simulation.createPasses();
  simulation.animate();
}

load();
