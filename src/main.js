import config from "./config.js";
import { createDefaultConfigPasses } from "./passes/index.js";
import Simulation from "./simulation/index.js";

createDefaultConfigPasses(config);

const simulation = new Simulation();

async function load() {
  simulation.initRenderer();

  if (config.scene.blackHole.useInputTexture) await simulation.readInputData();
  await simulation.createPasses();

  simulation.animate();
}

load();
