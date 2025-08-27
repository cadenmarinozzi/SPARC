precision highp float;

varying vec2 vUv;
uniform vec2 uResolution;
uniform vec3 uCameraPosition;
uniform bool uRelativisticPaths;
uniform float uBaseTemperature;
uniform int uMaxSteps;
uniform float uInitialStepSize;
uniform float uMaxDistance;
uniform float uTime;
uniform float uMass;
uniform float uEPS;
uniform float uSchwarzschildRadius;
uniform float uDiskHeight;
uniform float uPhotonRingRadius;
uniform float uInnerRadius;
uniform float uOuterRadius;
uniform float uEmissionCoefficient;
uniform float uAbsorptionCoefficient;

uniform sampler3D diskTexture;

float random(vec2 co) {
    return fract(sin(dot(co, vec2(12.9898, 78.233))) * 43758.5453);
}

vec3 mod289(vec3 x) {
    return x - floor(x * (1.0 / 289.0)) * 289.0;
}

vec4 mod289(vec4 x) {
    return x - floor(x * (1.0 / 289.0)) * 289.0;
}

vec4 permute(vec4 x) {
    return mod289(((x * 34.0) + 10.0) * x);
}

vec4 taylorInvSqrt(vec4 r) {
    return 1.79284291400159 - 0.85373472095314 * r;
}

float noise(vec3 v) {
    const vec2 C = vec2(1.0 / 6.0, 1.0 / 3.0);
    const vec4 D = vec4(0.0, 0.5, 1.0, 2.0);

    // First corner
    vec3 i = floor(v + dot(v, C.yyy));
    vec3 x0 = v - i + dot(i, C.xxx);

    // Other corners
    vec3 g = step(x0.yzx, x0.xyz);
    vec3 l = 1.0 - g;
    vec3 i1 = min(g.xyz, l.zxy);
    vec3 i2 = max(g.xyz, l.zxy);

    //   x0 = x0 - 0.0 + 0.0 * C.xxx;
    //   x1 = x0 - i1  + 1.0 * C.xxx;
    //   x2 = x0 - i2  + 2.0 * C.xxx;
    //   x3 = x0 - 1.0 + 3.0 * C.xxx;
    vec3 x1 = x0 - i1 + C.xxx;
    vec3 x2 = x0 - i2 + C.yyy; // 2.0*C.x = 1/3 = C.y
    vec3 x3 = x0 - D.yyy;      // -1.0+3.0*C.x = -0.5 = -D.y

    // Permutations
    i = mod289(i);
    vec4 p = permute(permute(permute(i.z + vec4(0.0, i1.z, i2.z, 1.0)) + i.y + vec4(0.0, i1.y, i2.y, 1.0)) + i.x + vec4(0.0, i1.x, i2.x, 1.0));

    // Gradients: 7x7 points over a square, mapped onto an octahedron.
    // The ring size 17*17 = 289 is close to a multiple of 49 (49*6 = 294)
    float n_ = 0.142857142857; // 1.0/7.0
    vec3 ns = n_ * D.wyz - D.xzx;

    vec4 j = p - 49.0 * floor(p * ns.z * ns.z);  //  mod(p,7*7)

    vec4 x_ = floor(j * ns.z);
    vec4 y_ = floor(j - 7.0 * x_);    // mod(j,N)

    vec4 x = x_ * ns.x + ns.yyyy;
    vec4 y = y_ * ns.x + ns.yyyy;
    vec4 h = 1.0 - abs(x) - abs(y);

    vec4 b0 = vec4(x.xy, y.xy);
    vec4 b1 = vec4(x.zw, y.zw);

    //vec4 s0 = vec4(lessThan(b0,0.0))*2.0 - 1.0;
    //vec4 s1 = vec4(lessThan(b1,0.0))*2.0 - 1.0;
    vec4 s0 = floor(b0) * 2.0 + 1.0;
    vec4 s1 = floor(b1) * 2.0 + 1.0;
    vec4 sh = -step(h, vec4(0.0));

    vec4 a0 = b0.xzyw + s0.xzyw * sh.xxyy;
    vec4 a1 = b1.xzyw + s1.xzyw * sh.zzww;

    vec3 p0 = vec3(a0.xy, h.x);
    vec3 p1 = vec3(a0.zw, h.y);
    vec3 p2 = vec3(a1.xy, h.z);
    vec3 p3 = vec3(a1.zw, h.w);

    //Normalise gradients
    vec4 norm = taylorInvSqrt(vec4(dot(p0, p0), dot(p1, p1), dot(p2, p2), dot(p3, p3)));
    p0 *= norm.x;
    p1 *= norm.y;
    p2 *= norm.z;
    p3 *= norm.w;

    // Mix final noise value
    vec4 m = max(0.5 - vec4(dot(x0, x0), dot(x1, x1), dot(x2, x2), dot(x3, x3)), 0.0);
    m = m * m;

    return 105.0 * dot(m * m, vec4(dot(p0, x0), dot(p1, x1), dot(p2, x2), dot(p3, x3)));
}

// v: Vector to rotate
// rotation: Rotation angles vector
vec3 rotate(vec3 v, vec3 rotation) {
    float cx = cos(rotation.x);
    float sx = sin(rotation.x);

    float cy = cos(rotation.y);
    float sy = sin(rotation.y);

    float cz = cos(rotation.z);
    float sz = sin(rotation.z);

    // Rotate x
    // [1  0   0]
    // [0 cx -sx]
    // [0 sx  cx]
    v = vec3(v.x, v.y * cx + v.z * -sx, v.y * sx + v.z * cx);

    // Rotate y
    // [ cy 0 sy]
    // [  0 1  0]
    // [-sy 0 cy]
    v = vec3(v.x * cy + v.z * sy, v.y, v.x * -sy + v.z * cy);

    // Rotate z
    // [cz -sz 0]
    // [sz  cz 0]
    // [ 0   0 1]
    v = vec3(v.x * cz + v.y * -sz, v.x * sz + v.y * cz, v.z);

    return v;
}

// H: Hurst represents self similarity 
float fbm(vec3 p, float H, int n) {
    float gain = exp2(-H);
    float amplitude = 1.0;
    float f = 1.0;

    float val = 0.0;

    for (int i = 0; i < n; i++) {
        // Sample noise originating at the vector scaling down per iteration
        val += amplitude * noise(f * p);

        f *= 2.0; // Half the wavelength each iteration
        amplitude *= gain;
    }

    return val;
}

float beerLambert(float absorption, float depthTraveled) {
    return exp(-absorption * depthTraveled);
}

// TODO: MAKE THIS
vec3 blackbodyRedshifted(float T, float g_total) {
    // wavelengths in meters
    float lambdaR = 700e-9 / g_total;
    float lambdaG = 546e-9 / g_total;
    float lambdaB = 435e-9 / g_total; 

    // constants
    float h = 6.626e-34;
    float c = 3e8;
    float k = 1.381e-23;

    // Planck function
    float BR = 2.0 * h * c * c / pow(lambdaR, 5.0) / (exp(h * c / (lambdaR * k * T)) - 1.0);
    float BG = 2.0 * h * c * c / pow(lambdaG, 5.0) / (exp(h * c / (lambdaG * k * T)) - 1.0);
    float BB = 2.0 * h * c * c / pow(lambdaB, 5.0) / (exp(h * c / (lambdaB * k * T)) - 1.0);

    // normalize for visualization
    float maxI = max(max(BR, BG), BB);

    return vec3(BR, BG, BB) / maxI;
}

vec3 dPosition(vec3 direction) {
    return direction;
}

vec3 dDirection(vec3 position, float h2) {
    return -1.5 * uSchwarzschildRadius * h2 * position / pow(pow(length(position), 2.0), 2.5);
}

void RK4(inout vec3 position, inout vec3 direction, float h2, inout float stepSize) {
    vec3 k1Position = dPosition(direction);
    vec3 k1Direction = dDirection(position, h2);

    vec3 k2Position = dPosition(direction + stepSize / 2.0 * k1Direction);
    vec3 k2Direction = dDirection(position + stepSize / 2.0 * k1Position, h2);

    vec3 k3Position = dPosition(direction + stepSize / 2.0 * k2Direction);
    vec3 k3Direction = dDirection(position + stepSize / 2.0 * k2Position, h2);

    vec3 k4Position = dPosition(direction + stepSize * k3Direction);
    vec3 k4Direction = dDirection(position + stepSize * k3Position, h2);

    position += (stepSize / 6.0) * (k1Position + 2.0 * k2Position + 2.0 * k3Position + k4Position);

    vec3 acceleration = (stepSize / 6.0) * (k1Direction + 2.0 * k2Direction + 2.0 * k3Direction + k4Direction);
    direction += acceleration;
}

void radiativeTransferSample(inout vec3 color, inout float accumTransmittance, float density, float dist, vec3 direction, vec3 position, float stepSize) {
    float emission = density * uEmissionCoefficient;
    float absorption = density * uAbsorptionCoefficient;

    float observerVelocity2 = 1.0 - 1.0 / length(uCameraPosition);
    float emittedVelocity2 = 1.0 - 1.0 / dist;
    float gravitationalRedshift = sqrt(emittedVelocity2 / observerVelocity2);

    float diskPointVelocity = clamp(sqrt(uMass / (dist - 1.0)), 0.0, 1.0); // Velocity of the particle of matter in the accretion disk
    float gamma = 1.0 / sqrt(1.0 - pow(diskPointVelocity, 2.0));
    vec3 normalVelocity = uRelativisticPaths ? normalize(direction) : normalize(uCameraPosition - position);
    vec3 tangentialVelocity = vec3(-position.z / dist, 0, position.x / dist);
    float dopplerRedshift = 1.0 / (gamma * (1.0 - diskPointVelocity * dot(tangentialVelocity, normalVelocity)));

    float totalRedshiftFactor = dopplerRedshift * gravitationalRedshift;
    float scaledRedshiftFactor = pow(totalRedshiftFactor, 3.0); // Scaled for visual purposes. for physically accurate, don't scale

    float transmittance = beerLambert(absorption, stepSize);

    float T = uBaseTemperature * pow(dist / uInnerRadius, -0.75);

    vec3 bbColor = blackbodyRedshifted(T, 1.0 / totalRedshiftFactor);

    accumTransmittance *= transmittance;
    color += bbColor * emission * scaledRedshiftFactor * accumTransmittance * stepSize;
}

vec3 rayMarch(vec3 position, vec3 direction) {
    vec3 color = vec3(0);
    float accumTransmittance = 1.0; // Accumulated amount of light gone through

    float h2 = pow(length(cross(position, direction)), 2.0);

    float stepSize = uInitialStepSize;

    for (int i = 0; i < uMaxSteps; i++) {
        float dist = length(position);

        if (dist > uMaxDistance)
            break;

        if (dist < uPhotonRingRadius)
            break;

        // Reduce FBM spikes near event horizon
        if (dist <= uInnerRadius * 1.1) {
            stepSize = uInitialStepSize * 2.0;
        } else {
            stepSize = uInitialStepSize;
        }

        float safeDist = max(dist, uInnerRadius + uEPS);

        float pointTheta = atan(position.z, position.x);

        float speed = (uRelativisticPaths ? 2.0 : -2.0) / safeDist;
        float shift = uTime * speed;
        vec3 vortexPosition = vec3(safeDist * cos(pointTheta + shift), position.y, safeDist * sin(pointTheta + shift));

        float noise = fbm(vortexPosition, 0.5, 4);
        float density = (noise / 10.0 + 10.0) * (1.0 / safeDist);
        float depth = noise / 2.0;

        // vec3 texPos = (position + 1.0) / 2.0; // maps [-1,1] → [0,1]
        // float dens = textureCube(diskTexture, vUv.xyz).r;

        // if (dens > 0.0) {
        if (abs(position.y) < uDiskHeight + depth && length(position.xz) < uOuterRadius + depth && length(position.xz) > uInnerRadius + depth) {
            radiativeTransferSample(color, accumTransmittance, density, safeDist, direction, position, stepSize);
            // return vec3(1);
        }

        if (uRelativisticPaths) {
            RK4(position, direction, h2, stepSize);
        } else {
            position += direction * stepSize;
        }
    }

    return color / float(uMaxSteps);
}

vec3 linearToLog(vec3 color, float a) {
    color = max(color, vec3(0.0));

    return log(1.0 + a * color) / log(1.0 + a);
}

void main() {
    vec2 uv = vec2((vUv.x - 0.5) * (uResolution.x / uResolution.y), (vUv.y - 0.5));
    // vec3 lookAt = vec3(sin(uTime / 2.0) * 1.0 + 1.0, 0, 0);
    vec3 lookAt = vec3(0.2, 0, 0);

    vec3 position = rotate(uCameraPosition, lookAt);
    vec3 direction = normalize(rotate(vec3(uv, 1), lookAt));

    vec3 color = rayMarch(position, direction);
    vec3 logColor = linearToLog(color, 5.0);

    gl_FragColor = vec4(logColor, 1);
}