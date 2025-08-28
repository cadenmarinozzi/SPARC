export function createCombineFragmentShader(passes) {
  const passNames = Object.keys(passes);

  return `
  ${passNames.map((passName) => `uniform sampler2D t${passName};`).join("\n")}

  varying vec2 vUv;

  void main() {
    ${passNames
      .map(
        (passName) =>
          `vec3 ${passName}Color = texture2D(t${passName}, vUv).rgb;`
      )
      .join("\n")}


    gl_FragColor = vec4(${passNames
      .map((passName) => `${passName}Color`)
      .join("+")}, 1.0);
  }`;
}
