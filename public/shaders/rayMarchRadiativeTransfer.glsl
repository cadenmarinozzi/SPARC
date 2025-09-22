precision highp float;

varying vec2 vUv;
uniform vec2 uResolution;
uniform float uInputDataHeight;
uniform vec3 uCameraPosition;
uniform vec3 uCameraRotation;
uniform bool uRelativisticPaths;
uniform float uBaseTemperature;
uniform int uMaxSteps;
uniform float uMaxDistance;
uniform float uTime;
uniform float uMass;
uniform float uEPS;
uniform float uSchwarzschildRadius;
uniform float uDiskHeight;
uniform float uPhotonRingRadius;
uniform float uInnerRadius;
uniform float uOuterRadius;
uniform bool uUseInputTexture;
uniform float uSpeedScale;
uniform float uBrightnessScale;
uniform float uObserverFrequency;
uniform float uMaxStepSize;
uniform float uMinStepSize;
uniform bool uThickDisk;
uniform sampler2D uInputTexture;
uniform float uLogFactor;
uniform bool uLogColor;
uniform bool uGammaColor;
uniform float uGammaFactor;

// Universal constants
const float PI = 3.1415926535897932384626433832795;
const float c = 3e8;
const float h = 6.626e-34;
const float k = 1.381e-23;
const float G = 6.6743e-11;

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

// https://gist.github.com/patriciogonzalezvivo/670c22f3966e662d2f83
float noise(vec3 v) {
    const vec2 C = vec2(1.0 / 6.0, 1.0 / 3.0);
    const vec4 D = vec4(0.0, 0.5, 1.0, 2.0);

    vec3 i = floor(v + dot(v, C.yyy));
    vec3 x0 = v - i + dot(i, C.xxx);

    vec3 g = step(x0.yzx, x0.xyz);
    vec3 l = 1.0 - g;
    vec3 i1 = min(g.xyz, l.zxy);
    vec3 i2 = max(g.xyz, l.zxy);

    vec3 x1 = x0 - i1 + C.xxx;
    vec3 x2 = x0 - i2 + C.yyy;
    vec3 x3 = x0 - D.yyy;

    i = mod289(i);
    vec4 p = permute(permute(permute(i.z + vec4(0.0, i1.z, i2.z, 1.0)) + i.y + vec4(0.0, i1.y, i2.y, 1.0)) + i.x + vec4(0.0, i1.x, i2.x, 1.0));

    float n_ = 0.142857142857;
    vec3 ns = n_ * D.wyz - D.xzx;

    vec4 j = p - 49.0 * floor(p * ns.z * ns.z);

    vec4 x_ = floor(j * ns.z);
    vec4 y_ = floor(j - 7.0 * x_);

    vec4 x = x_ * ns.x + ns.yyyy;
    vec4 y = y_ * ns.x + ns.yyyy;
    vec4 h = 1.0 - abs(x) - abs(y);

    vec4 b0 = vec4(x.xy, y.xy);
    vec4 b1 = vec4(x.zw, y.zw);

    vec4 s0 = floor(b0) * 2.0 + 1.0;
    vec4 s1 = floor(b1) * 2.0 + 1.0;
    vec4 sh = -step(h, vec4(0.0));

    vec4 a0 = b0.xzyw + s0.xzyw * sh.xxyy;
    vec4 a1 = b1.xzyw + s1.xzyw * sh.zzww;

    vec3 p0 = vec3(a0.xy, h.x);
    vec3 p1 = vec3(a0.zw, h.y);
    vec3 p2 = vec3(a1.xy, h.z);
    vec3 p3 = vec3(a1.zw, h.w);

    vec4 norm = taylorInvSqrt(vec4(dot(p0, p0), dot(p1, p1), dot(p2, p2), dot(p3, p3)));
    p0 *= norm.x;
    p1 *= norm.y;
    p2 *= norm.z;
    p3 *= norm.w;

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

float blackbodyIntensityAtFrequency(float T, float frequency) {
    return 2.0 * frequency * frequency * frequency / (exp(frequency / T) - 1.0);
}

vec3 temperatureToRGB(float T) {
    // Simple approximate mapping
    T = clamp(T, 1000.0, 40000.0);
    float t = (T - 1000.0) / (40000.0 - 1000.0); // normalize 0–1
    return vec3(clamp(1.5 - abs(2.0 * t - 1.0), 0.0, 1.0), // R
    clamp(1.5 - abs(2.0 * t - 0.5), 0.0, 1.0), // G
    clamp(1.5 - abs(2.0 * t), 0.0, 1.0)        // B
    );
}

// TODO: MAKE THIS
vec3 blackbodyRedshifted(float T, float redshift) {
    // wavelengths in meters
    float lambdaR = 700e-9;
    float lambdaG = 546e-9;
    float lambdaB = 435e-9;

// Planck function
    float BR = 2.0 * h * c * c / pow(lambdaR, 5.0) / (exp(h * c / (lambdaR * k * T)) - 1.0);
    float BG = 2.0 * h * c * c / pow(lambdaG, 5.0) / (exp(h * c / (lambdaG * k * T)) - 1.0);
    float BB = 2.0 * h * c * c / pow(lambdaB, 5.0) / (exp(h * c / (lambdaB * k * T)) - 1.0);

// normalize for visualization
    float maxI = max(max(BR, BG), BB);

    return vec3(BR, BG, BB) / maxI;
}

float beerLambert(float absorption, float depthTraveled) {
    return exp(-absorption * depthTraveled);
}

vec3 dPosition(vec3 direction) {
    return direction;
}

vec3 dDirection(vec3 position, vec3 direction) {
    vec3 L = cross(position, direction);
    float L2 = dot(L, L);
    float r = length(position);

    return -3.0 * uSchwarzschildRadius * L2 * position / pow(r, 5.0);
}

void RK4(inout vec3 position, inout vec3 direction, inout float stepSize) {
    vec3 k1Pos = dPosition(direction);
    vec3 k1Mom = dDirection(position, direction);

    vec3 k2Pos = dPosition(direction + 0.5 * stepSize * k1Mom);
    vec3 k2Mom = dDirection(position + 0.5 * stepSize * k1Pos, direction + 0.5 * stepSize * k1Mom);

    vec3 k3Pos = dPosition(direction + 0.5 * stepSize * k2Mom);
    vec3 k3Mom = dDirection(position + 0.5 * stepSize * k2Pos, direction + 0.5 * stepSize * k2Mom);

    vec3 k4Pos = dPosition(direction + stepSize * k3Mom);
    vec3 k4Mom = dDirection(position + stepSize * k3Pos, direction + stepSize * k3Mom);

    position += (stepSize / 6.0) * (k1Pos + 2.0 * k2Pos + 2.0 * k3Pos + k4Pos);
    direction += (stepSize / 6.0) * (k1Mom + 2.0 * k2Mom + 2.0 * k3Mom + k4Mom);
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

void radiativeTransferSample(inout vec3 color, inout float accumTransmittance, float density, float dist, vec3 direction, vec3 position, float stepSize) {
    float electronDensity = density;
    float electronTemperature = max(uBaseTemperature / 5.9e9 * pow(dist / uInnerRadius, -0.75), 0.1);

    // Magnetic field
    float magneticField = max(sqrt(density) * pow(dist / uInnerRadius, -1.0), 0.1);
    vec3 Bvec = normalize(vec3(-position.z, 0.2 * dist, position.x)) * magneticField;

    // Gravitational redshift
    float observerDist = length(uCameraPosition);
    float emitterDist = dist;
    float gravitationalRedshift = sqrt((1.0 - (2.0 * uMass * G) / observerDist) /
        (1.0 - (2.0 * uMass * G) / emitterDist));

    // Orbital velocity and gamma factor
    float diskPointVelocity = clamp(sqrt(uMass / (dist - 1.0)), 0.0, 1.0);
    float gamma = 1.0 / sqrt(1.0 - pow(diskPointVelocity, 2.0));

    // Tangential velocity using cross product for correct rotation
    vec3 radius = normalize(vec3(position.x, 0.0, position.z));
    vec3 tangentialVelocity = cross(vec3(0.0, 1.0, 0.0), radius) * diskPointVelocity;

    // Line-of-sight from emitter to observer
    vec3 lineOfSight = normalize(uCameraPosition - position);

    // Doppler factor
    float dopplerFactor = 1.0 / (gamma * (1.0 - dot(tangentialVelocity, lineOfSight)));

    // Emitted frequency
    float emitterFrequency = uObserverFrequency / dopplerFactor / gravitationalRedshift;

    // Synchrotron emission
    float cyclotronFrequency = magneticField / (2.0 * PI);
    float criticalFrequency = cyclotronFrequency * electronTemperature * electronTemperature;
    float x = emitterFrequency / criticalFrequency;
    float synchrotronEmissivity = electronDensity * magneticField * x * exp(-x);

    // Pitch angle modulation
    float pitchAngle = acos(dot(normalize(Bvec), lineOfSight));
    synchrotronEmissivity *= sin(pitchAngle);

    // Blackbody emission
    float temperature = uBaseTemperature * pow(dist / uInnerRadius, -0.75);
    float nu_emit = uObserverFrequency / dopplerFactor / gravitationalRedshift;

    vec3 bbColor = blackbodyRedshifted(temperature, nu_emit) * pow(dopplerFactor, 3.0);

    // Synchrotron absorption
    float bbIntensity = blackbodyIntensityAtFrequency(temperature, emitterFrequency);
    float synchrotronAbsorption = synchrotronEmissivity / max(bbIntensity, uEPS);
    float transmittance = beerLambert(synchrotronAbsorption, stepSize);

    // Accumulate color and transmittance
    color += bbColor * synchrotronEmissivity * stepSize * uBrightnessScale;
    accumTransmittance *= transmittance;
}

vec3 rayMarch(vec3 position, vec3 direction) {
    vec3 color = vec3(0);
    float accumTransmittance = 1.0; // Accumulated amount of light gone through

    float stepSize;

    for (int i = 0; i < uMaxSteps; i++) {
        float dist = length(position);

        if (dist > uMaxDistance)
            break;

        if (dist < uPhotonRingRadius)
            break;

        // Step size reduction near ISCO
        float adaptiveFactor = clamp((dist - uInnerRadius) / (uOuterRadius - uInnerRadius), 0.0, 1.0);
        stepSize = uMinStepSize + (uMaxStepSize - uMinStepSize) * pow((dist - uSchwarzschildRadius) / (uOuterRadius - uSchwarzschildRadius), 0.5);

        // For visual effect calculations
        float safeDist = max(dist, uInnerRadius);

        float density;
        bool inVolume = false;

        if (uThickDisk) {
            float pointTheta = atan(position.z, position.x);

            float speed = (uRelativisticPaths ? uSpeedScale : -uSpeedScale) / safeDist;
            float shift = uTime * speed;
            vec3 vortexPosition = vec3(safeDist * cos(pointTheta + shift), position.y, safeDist * sin(pointTheta + shift));

            if (uUseInputTexture) {
                vec2 textureCoords = (vortexPosition.xz + 20.0) / 40.0;
                density = texture(uInputTexture, textureCoords).r;

                inVolume = density > 0.0 && abs(position.y) < uInputDataHeight;
            } else {
                float noise = fbm(vortexPosition, 0.5, 4);
                float depth = noise / 2.0;
                density = (noise / 10.0 + 10.0) * (1.0 / safeDist);

                inVolume = abs(position.y) < uDiskHeight + depth && length(position.xz) < uOuterRadius + depth && length(position.xz) > uInnerRadius + depth;
            }
        } else {
            density = 1.0;
            inVolume = abs(position.y) < uDiskHeight && length(position.xz) < 20.0 && length(position.xz) > uInnerRadius;
        }

        if (inVolume) {
            radiativeTransferSample(color, accumTransmittance, density, safeDist, direction, position, stepSize);
        }

        if (uRelativisticPaths) {
            RK4(position, direction, stepSize);
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

// G: Gamma value
vec3 gammaCorrect(vec3 color, float G) {
    color = pow(color, vec3(1.0 / G));

    return color;
}

void main() {
    vec2 uv = vec2((vUv.x - 0.5) * (uResolution.x / uResolution.y), (vUv.y - 0.5));

    vec3 position = rotate(uCameraPosition, uCameraRotation);
    vec3 direction = normalize(rotate(vec3(uv, 1), uCameraRotation));

    vec3 color = rayMarch(position, direction);

    if (uLogColor) {
        color = linearToLog(color, uLogFactor);
    }

    if (uGammaColor) {
        color = gammaCorrect(color, uGammaFactor);
    }

    gl_FragColor = vec4(color, 1);
}