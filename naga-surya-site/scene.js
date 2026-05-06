// === Naga Surya — Three.js shadowbox scene ===
// Shadowbox = inner relief artwork inside a 3D box-frame with side walls.
// Side walls parallax in z-axis with cursor (desktop) or device tilt (mobile).
// Lighting = vertical sun-beam pulsing down center → tree-of-life energy → green flora pulse.

import * as THREE from 'three';

let CONFIG = null;
let CURRENT_PAGE = 'home';

async function loadConfig() {
  const local = localStorage.getItem('ns_config');
  if (local) { try { return JSON.parse(local); } catch (e) {} }
  const res = await fetch(window.NS_DEFAULT_CONFIG_URL);
  return await res.json();
}

const VERT = `
  varying vec2 vUv;
  varying vec3 vWorldPos;
  void main() {
    vUv = uv;
    vec4 wp = modelMatrix * vec4(position, 1.0);
    vWorldPos = wp.xyz;
    gl_Position = projectionMatrix * viewMatrix * wp;
  }
`;

// Lit relief layer — staged white→green energy flow choreographed by uIntroProgress (0..1 over 10s)
// then continues as a persistent 50% green throb via uGreenPulse.
const FRAG_LIT = `
  precision highp float;
  varying vec2 vUv;
  varying vec3 vWorldPos;
  uniform sampler2D uColor;
  uniform sampler2D uNormal;
  uniform vec3 uLightDir;
  uniform vec3 uLightColor;
  uniform vec3 uAmbient;
  uniform float uOpacity;
  uniform float uEmissive;
  uniform float uTime;
  uniform float uHasNormal;
  uniform float uRimStrength;
  uniform float uDissolve;
  uniform float uSunPulse;       // top-spotlight breathing 0..1
  uniform float uIntroProgress;  // 0..1 over the first 10s
  uniform float uGreenPulse;     // ongoing throbbing green energy 0..1
  uniform float uIsFoliage;
  uniform float uIsTitle;
  uniform float uIsSun;
  uniform float uIsTrunk;        // tree trunk + roots layer (heroPlate-ish)
  uniform float uIsPanels;       // panels live on the foliage; we use foliage flag
  uniform float uBeamCenter;
  uniform vec2  uReflectUV;      // parallax-driven reflection center
  void main() {
    vec4 c = texture2D(uColor, vUv);
    if (c.a < 0.02) discard;
    vec3 N = vec3(0.0, 0.0, 1.0);
    if (uHasNormal > 0.5) {
      vec3 n = texture2D(uNormal, vUv).rgb * 2.0 - 1.0;
      N = normalize(n);
    }
    // Directional shading — stronger contrast: faces facing the light read bright,
    // faces angled away read darker. Wrap is reduced so dark side stays dark.
    float ndl = max(dot(N, normalize(uLightDir)), 0.0);
    float wrap = pow(ndl, 0.85) * 1.05 + 0.22;
    vec3 lit = c.rgb * (uAmbient + uLightColor * wrap);

    // Rim — sculpted edge
    float rim = pow(1.0 - max(N.z, 0.0), 2.5) * uRimStrength;
    lit += vec3(1.0, 0.85, 0.45) * rim * 0.50;

    // Parallax reflection — a subtle warm-white shine that sweeps across the
    // surface as the cursor moves. No sharp streak; just a soft, broad sheen
    // that brightens whichever region is currently lit, gated by surface normal
    // so it reads as light cast onto the geometry rather than glow on top.
    vec2 reflD = vUv - uReflectUV;
    float reflProx = 1.0 - smoothstep(0.0, 0.55, length(reflD));
    float sheen = pow(reflProx, 1.4) * (0.30 + (1.0 - max(N.z, 0.0)) * 0.40);
    lit += vec3(1.0, 0.94, 0.82) * sheen * 0.22;

    // Top spotlight (fixed) onto the central sun column
    float beamProx = 1.0 - smoothstep(0.0, 0.30, abs(vUv.x - uBeamCenter));
    float topFall  = 1.0 - smoothstep(0.0, 0.55, vUv.y);
    float spotlight = beamProx * (0.55 + topFall * 0.6) * uSunPulse;
    lit += vec3(1.0, 0.92, 0.55) * spotlight * 0.40;

    // ===== STAGED INTRO ENERGY FLOW =====
    // Phase mapping (uIntroProgress 0..1 ≈ 0..10s):
    //   0.00–0.20  white pulse forms at sun
    //   0.20–0.45  pulse spreads to panels (along foliage branches)
    //   0.45–0.70  pulse runs down the trunk
    //   0.70–1.00  green energy emerges from roots into nature
    float pSun     = smoothstep(0.00, 0.20, uIntroProgress) * (1.0 - smoothstep(0.55, 0.90, uIntroProgress));
    float pPanels  = smoothstep(0.18, 0.45, uIntroProgress) * (1.0 - smoothstep(0.65, 0.95, uIntroProgress));
    float pTrunk   = smoothstep(0.45, 0.70, uIntroProgress) * (1.0 - smoothstep(0.85, 1.00, uIntroProgress));
    float pRoots   = smoothstep(0.70, 1.00, uIntroProgress);

    // SUN: bright white halo when pSun is high
    if (uIsSun > 0.5) {
      float d = distance(vUv, vec2(0.5, 0.55));
      float halo = exp(-d * 6.0) * pSun;
      lit += vec3(1.0, 0.98, 0.92) * halo * 1.4;
    }

    // PANELS / FOLIAGE branches: bright white travelling pulse
    if (uIsFoliage > 0.5) {
      // distance from sun (top center) outward along branches
      float br = length(vec2((vUv.x - 0.5) * 1.4, (vUv.y - 0.65) * 1.6));
      // ring travelling outward as pPanels animates
      float ring = exp(-pow((br - pPanels * 1.3) * 4.0, 2.0));
      lit += vec3(1.0, 0.98, 0.85) * ring * pPanels * 1.2;
      // tiny shimmer on panels — small bands
      float shimmer = sin(vUv.x * 60.0 + uTime * 2.0) * 0.5 + 0.5;
      lit += vec3(0.95, 1.0, 0.95) * shimmer * pPanels * 0.05;
    }

    // TRUNK: vertical pulse running downward
    if (uIsTrunk > 0.5) {
      // band travels from top (vUv.y=1) to bottom (vUv.y=0) as pTrunk goes 0→1
      float bandY = 1.0 - pTrunk;  // current y of the pulse front
      float bandW = 0.18;
      float band = exp(-pow((vUv.y - bandY) / bandW, 2.0));
      // limit to center column (trunk)
      float trunkX = 1.0 - smoothstep(0.0, 0.18, abs(vUv.x - 0.5));
      lit += vec3(1.0, 0.98, 0.88) * band * trunkX * pTrunk * 1.4;
    }

    // ROOTS / NATURE: green energy traces the foliage's actual leaves, stems, veins
    // (via texture brightness + Sobel-style edge detection on the color map),
    // not a radial flood.
    if (uIsFoliage > 0.5) {
      // 1) Body mask: how green/saturated this pixel is in the source texture.
      //    Foliage layer's plant pixels are green-dominant; this isolates them.
      float green = c.g;
      float bodyMask = clamp((green - max(c.r, c.b)) * 2.0 + (green - 0.15) * 0.6, 0.0, 1.0);
      bodyMask *= c.a;

      // 2) Edge / vein mask via small Sobel on the alpha+luma signal.
      //    Sample 4 neighbors in UV space — distance set so leaf outlines pop.
      float texel = 0.0035;
      float lC = (c.r + c.g + c.b) * c.a;
      float lL = (texture2D(uColor, vUv + vec2(-texel, 0.0)).rgb).g + texture2D(uColor, vUv + vec2(-texel, 0.0)).a * 0.001;
      float lR = (texture2D(uColor, vUv + vec2( texel, 0.0)).rgb).g;
      float lU = (texture2D(uColor, vUv + vec2(0.0,  texel)).rgb).g;
      float lD = (texture2D(uColor, vUv + vec2(0.0, -texel)).rgb).g;
      float gx = lR - lL;
      float gy = lU - lD;
      float edge = clamp(sqrt(gx * gx + gy * gy) * 9.0, 0.0, 1.0);
      // Thin the edge: pow gives a sharper, more linear line.
      edge = pow(edge, 0.85);

      // 3) A finer-scale vein detection using a second derivative — picks up the
      //    interior streaks within leaves.
      float texel2 = 0.0011;
      float vCx = texture2D(uColor, vUv + vec2(-texel2, 0.0)).g + texture2D(uColor, vUv + vec2(texel2, 0.0)).g - 2.0 * c.g;
      float vCy = texture2D(uColor, vUv + vec2(0.0, -texel2)).g + texture2D(uColor, vUv + vec2(0.0, texel2)).g - 2.0 * c.g;
      float veins = clamp(abs(vCx) * 14.0 + abs(vCy) * 14.0, 0.0, 1.0);
      veins = pow(veins, 0.85);

      // Combined "where the energy lives" mask — strongest on outlines + veins,
      // moderate on the body of the plant matter.
      // Edges + veins dominate; body mask contribution is small so glow stays as fine
      // outline lines tracing actual plant geometry rather than flooding leaf interiors.
      float plantMask = max(edge * 1.15, veins * 0.95) + bodyMask * 0.18;
      plantMask = clamp(plantMask, 0.0, 1.4);

      // 4) Travelling intro burst from the roots — a wavefront radiating outward
      //    over plant surfaces (gated by plantMask, not by raw distance).
      vec2 rootP = vec2(vUv.x - 0.5, vUv.y - 0.10);
      float dr = length(vec2(rootP.x * 1.2, rootP.y * 1.4));
      float introFront = exp(-pow((dr - pRoots * 1.4) * 3.0, 2.0)) * pRoots;

      // 5) Persistent post-intro waves at 0.025 Hz (~40 s period). Multiple
      //    concentric wavefronts, slow, low intensity, traced along the same
      //    plant geometry.
      float slowPhase = uTime * 0.025 * 6.2831853;   // 0.025 Hz angular
      // wave radius slowly grows then resets (frac wrapped to make repeating fronts)
      float wr = fract(uTime * 0.025);
      // primary front
      float w1 = exp(-pow((dr - wr * 1.6) * 3.5, 2.0));
      // a second front offset by half a cycle so coverage feels continuous
      float w2 = exp(-pow((dr - fract(uTime * 0.025 + 0.5) * 1.6) * 3.5, 2.0));
      // soft breathing between fronts
      float breath = 0.5 + 0.5 * sin(slowPhase);
      float slowWaves = (w1 + w2 * 0.85) * (0.45 + 0.55 * breath);

      // Plant memory: the persistent waves only travel through tissue the intro
      // already touched. Approximate "intro had touched here" with a signed
      // distance from the foliage body that the intro ring previously swept past.
      float reachedByIntro = smoothstep(0.0, 0.7, max(pRoots, 0.0));

      vec3 greenCol  = vec3(0.10, 0.55, 0.18);   // deep forest emerald
      vec3 greenHi   = vec3(0.55, 0.95, 0.65);   // brighter hairline core (still emerald-tinted, not white)

      // Compose: intro burst (gated on plant) + ongoing slow waves (gated on plant
      // AND on memory of intro coverage) at uGreenPulse intensity.
      float introContrib = introFront * plantMask * 1.9;
      float slowContrib  = slowWaves * plantMask * uGreenPulse * reachedByIntro * 0.75;

      // Mix biased toward the bright core color along edges/veins — high-fidelity outlines.
      float lineCore = clamp(edge * 1.2 + veins * 0.9, 0.0, 1.0);
      lit += mix(greenCol, greenHi, lineCore) * (introContrib + slowContrib);

      // Always-on hairline outline along leaf edges + veins so the plant geometry
      // is legible even at the trough of the green pulse.
      lit += greenHi * (edge * 0.55 + veins * 0.40) * (0.30 + uGreenPulse * 0.55) * reachedByIntro;
    }

    // Trunk / roots also keep a green memory band radiating up its center
    if (uIsTrunk > 0.5) {
      float trunkX = 1.0 - smoothstep(0.0, 0.20, abs(vUv.x - 0.5));
      float lower = smoothstep(0.55, 0.0, vUv.y);
      float slow = sin(uTime * 0.025 * 6.2831853 + vUv.y * 8.0) * 0.5 + 0.5;
      lit += vec3(0.35, 0.95, 0.40) * trunkX * lower * slow * uGreenPulse * 0.15;
    }

    // Title sculpted-gold breathing
    if (uIsTitle > 0.5) {
      lit += c.rgb * (0.18 + uSunPulse * 0.25);
    }

    // Emissive override (sun, etc.)
    lit += c.rgb * uEmissive;

    float alpha = c.a * uOpacity;
    if (uDissolve > 0.001) {
      float n = fract(sin(dot(vUv * 100.0, vec2(12.9898, 78.233))) * 43758.5453);
      if (n < uDissolve) discard;
      alpha *= 1.0 - uDissolve * 0.6;
    }
    // Overall brightness lift (+11% on top of previous): 1.20 → 1.33
    lit *= 1.33;
    lit = lit / (1.0 + lit * 0.10); // subtle filmic shoulder so highlights don't clip flat
    gl_FragColor = vec4(lit, alpha);
  }
`;

// Procedural marble — INSIDE the shadowbox only (back wall of the box)
const FRAG_MARBLE = `
  precision highp float;
  varying vec2 vUv;
  uniform float uTime;
  uniform float uVeinFlow;
  uniform vec2 uAspect;
  uniform float uOpacity;
  uniform float uSunPulse;
  uniform float uBeamCenter;
  uniform float uCausticAmt;
  uniform float uGreenPulse;
  float hash(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}
  float noise(vec2 p){vec2 i=floor(p),f=fract(p);float a=hash(i),b=hash(i+vec2(1,0)),c=hash(i+vec2(0,1)),d=hash(i+vec2(1,1));vec2 u=f*f*(3.0-2.0*f);return mix(mix(a,b,u.x),mix(c,d,u.x),u.y);}
  float fbm(vec2 p){float s=0.0,a=0.5;for(int i=0;i<5;i++){s+=a*noise(p);p*=2.07;a*=0.5;}return s;}
  void main() {
    vec2 p = vUv * uAspect;
    vec2 cv = vUv - 0.5;
    float vig = 1.0 - dot(cv, cv) * 1.1;
    vec3 base = mix(vec3(0.045,0.035,0.025), vec3(0.10,0.08,0.055), vig);
    float cloud = fbm(p * 1.6 + vec2(0.0, uTime * 0.005));
    base += vec3(0.04,0.03,0.02) * cloud;
    vec2 vp = p * 1.2;
    vp.x += fbm(vp * 0.6 + uTime * uVeinFlow * 0.04) * 1.4;
    vp.y += fbm(vp * 0.6 + 13.7 + uTime * uVeinFlow * 0.04) * 1.4;
    float veins = abs(noise(vp * 1.4) - 0.5);
    veins = 1.0 - smoothstep(0.0, 0.04, veins);
    veins *= 0.55;
    float vp2 = abs(noise(p * 3.5 + 3.0) - 0.5);
    vp2 = 1.0 - smoothstep(0.0, 0.025, vp2);
    veins += vp2 * 0.35;
    vec3 veinCol = mix(vec3(0.55,0.40,0.18), vec3(1.0,0.85,0.45), veins);
    base += veinCol * veins * 0.55;
    // Vertical sun beam wash on back wall
    float beamProx = 1.0 - smoothstep(0.0, 0.30, abs(vUv.x - uBeamCenter));
    float topFall = 1.0 - smoothstep(0.0, 0.7, vUv.y);
    base += vec3(1.0, 0.88, 0.55) * beamProx * topFall * uSunPulse * 0.15;

    // === Sub-page state: caustic green light pattern + lingering rays ===
    // Dappled green caustic light, biased to where the motif used to be.
    // Driven by uGreenPulse which itself moves at the persistent slow rate.
    vec2 cp = p * 1.4 + vec2(uTime * 0.04, uTime * 0.03);
    float ca = fbm(cp);
    float cb = fbm(cp + vec2(5.2, 1.3) + ca);
    float caustic = smoothstep(0.45, 0.85, cb);
    float center = 1.0 - smoothstep(0.0, 0.65, length(vUv - vec2(0.5, 0.5)));
    // Slow 0.025 Hz wave radiating outward from where the motif used to be
    float dCenter = length(vUv - vec2(0.5, 0.5));
    float wr = fract(uTime * 0.025);
    float slowRing = exp(-pow((dCenter - wr * 0.9) * 4.0, 2.0));
    base += vec3(0.30, 0.95, 0.36) * caustic * center * uGreenPulse * uCausticAmt * 0.55;
    base += vec3(0.45, 1.00, 0.50) * slowRing * uGreenPulse * uCausticAmt * 0.30;
    // Soft warm rays remembered from where the spotlight fell
    float ray = pow(beamProx, 1.5) * topFall;
    base += vec3(1.0, 0.86, 0.52) * ray * uCausticAmt * 0.20;

    gl_FragColor = vec4(base, uOpacity);
  }
`;

// Box-frame (3D) — sculpted polished-gold matching the title typography.
// Multi-stop gradient (#fff8d4 → #ffe089 → #f4c14a → #d4a02a → #a37016 → #6a430c)
// plus a moving parallax specular hotspot driven by uReflectUV.
const FRAG_GOLD = `
  precision highp float;
  varying vec2 vUv;
  varying vec3 vWorldPos;
  uniform float uTime;
  uniform float uOpacity;
  uniform vec3 uLightDir;
  uniform float uShadeBias;
  uniform float uSunPulse;
  uniform float uGreenPulse;
  uniform float uIntroProgress;
  uniform vec2  uReflectUV;     // moving specular center (0..1)
  uniform float uBevelAxis;     // 0 = vUv.y is the bevel cross-section, 1 = vUv.x is

  // Sample the same 6-stop polished gold ramp the title uses (top -> bottom).
  vec3 polishedGold(float t) {
    t = clamp(t, 0.0, 1.0);
    vec3 c0 = vec3(1.000, 0.973, 0.831);   // #fff8d4
    vec3 c1 = vec3(1.000, 0.878, 0.537);   // #ffe089
    vec3 c2 = vec3(0.957, 0.757, 0.290);   // #f4c14a
    vec3 c3 = vec3(0.831, 0.627, 0.165);   // #d4a02a
    vec3 c4 = vec3(0.639, 0.439, 0.086);   // #a37016
    vec3 c5 = vec3(0.416, 0.263, 0.047);   // #6a430c
    if (t < 0.18)      return mix(c0, c1, t / 0.18);
    else if (t < 0.38) return mix(c1, c2, (t - 0.18) / 0.20);
    else if (t < 0.58) return mix(c2, c3, (t - 0.38) / 0.20);
    else if (t < 0.78) return mix(c3, c4, (t - 0.58) / 0.20);
    else               return mix(c4, c5, (t - 0.78) / 0.22);
  }

  void main() {
    // Bevel cross-section: which uv axis describes the curvature of this face
    float across = mix(vUv.y, vUv.x, uBevelAxis);
    // Apex at across ≈ 0.5: a sculpted bevel reads brightest at the center
    float bevel = 1.0 - abs(across - 0.5) * 2.0;       // 0 at edge, 1 at apex
    bevel = smoothstep(0.0, 1.0, bevel);
    // Map bevel to a polished gradient: bright apex, dark valleys (top->bot of ramp)
    float t = mix(0.92, 0.08, bevel);                  // edges → deep, apex → highlight
    vec3 gold = polishedGold(t);

    // Burnished cross-grain bands
    float bands = sin(across * 90.0 + uTime * 0.35) * 0.025
                + sin(across * 240.0 - uTime * 0.6) * 0.012;
    gold += bands;

    // Per-face shade bias (sidewalls darker than the front frame)
    gold *= (1.0 + uShadeBias);

    // Top spotlight breathing — adds a warm highlight band near the upper edge
    float topGlint = (1.0 - smoothstep(0.0, 0.4, vUv.y)) * uSunPulse;
    gold += vec3(1.0, 0.92, 0.62) * topGlint * 0.10;

    // Parallax reflection — broad soft sheen sweeping across the gold as the
    // cursor pans. No sharp streak. Slightly bevel-modulated so the apex picks
    // up a touch more shine than the valleys, but the overall feel is a gentle
    // surface-wide brightening.
    float reflD = distance(vUv, uReflectUV);
    float reflBase = 1.0 - smoothstep(0.0, 0.55, reflD);
    float sheen = pow(reflBase, 1.4) * (0.55 + bevel * 0.45);
    gold += vec3(1.0, 0.94, 0.80) * sheen * 0.20;

    // Subtle green tint kissing the lower edge (tying frame into the living-light state)
    float lower = smoothstep(0.6, 0.0, vUv.y);
    gold += vec3(0.20, 0.55, 0.22) * lower * uGreenPulse * 0.05;

    // Overall brightness lift (+11%): 1.18 → 1.31
    gold *= 1.31;
    gold = gold / (1.0 + gold * 0.08);

    gl_FragColor = vec4(gold, uOpacity);
  }
`;

const VERT_MOTE = `
  attribute float aSeed;
  uniform float uTime;
  uniform float uPixelRatio;
  uniform vec3 uBoundsMin;
  uniform vec3 uBoundsMax;
  varying float vBrightness;
  void main() {
    float t = uTime * 0.15;
    vec3 p = vec3(
      sin(aSeed * 12.0 + t * 0.6),
      sin(aSeed * 7.7 + t * 0.4),
      sin(aSeed * 3.3 + t * 0.5) * 0.5
    );
    p.x = mix(uBoundsMin.x, uBoundsMax.x, fract(p.x * 0.5 + 0.5 + aSeed * 0.3 + t * 0.05));
    p.y = mix(uBoundsMin.y, uBoundsMax.y, fract(p.y * 0.5 + 0.5 + aSeed * 0.7 + t * 0.07));
    p.z = mix(uBoundsMin.z, uBoundsMax.z, fract(p.z + 0.5 + aSeed * 0.9));
    gl_Position = projectionMatrix * modelViewMatrix * vec4(p, 1.0);
    gl_PointSize = (2.0 + sin(aSeed * 23.0 + t) * 1.0) * uPixelRatio;
    vBrightness = 0.4 + sin(aSeed * 31.0 + uTime * 0.8) * 0.5;
  }
`;
const FRAG_MOTE = `
  precision highp float;
  varying float vBrightness;
  void main() {
    vec2 d = gl_PointCoord - 0.5;
    float r = length(d);
    if (r > 0.5) discard;
    float a = (1.0 - r * 2.0) * vBrightness * 0.4;
    gl_FragColor = vec4(1.0, 0.85, 0.45, a);
  }
`;

const VERT_PARTICLE = `
  attribute vec3 aStart;
  attribute vec3 aEnd;
  attribute vec3 aColor;
  attribute float aSeed;
  uniform float uProgress;
  uniform float uTime;
  uniform float uPixelRatio;
  varying vec3 vColor;
  varying float vAlpha;
  void main() {
    float t = uProgress;
    vec3 mid = aStart + vec3(
      sin(aSeed * 6.28 + uTime * 0.5) * 1.6,
      cos(aSeed * 4.31 + uTime * 0.7) * 1.0,
      (aSeed - 0.5) * 1.4
    );
    vec3 pos;
    if (t < 0.5) pos = mix(aStart, mid, smoothstep(0.0, 1.0, t * 2.0));
    else pos = mix(mid, aEnd, smoothstep(0.0, 1.0, (t - 0.5) * 2.0));
    gl_Position = projectionMatrix * modelViewMatrix * vec4(pos, 1.0);
    gl_PointSize = (4.0 + sin(aSeed * 17.0) * 2.0) * uPixelRatio;
    vColor = aColor;
    vAlpha = sin(t * 3.14159) * 0.95;
  }
`;
const FRAG_PARTICLE = `
  precision highp float;
  varying vec3 vColor;
  varying float vAlpha;
  void main() {
    vec2 d = gl_PointCoord - 0.5;
    float r = length(d);
    if (r > 0.5) discard;
    float a = (1.0 - r * 2.0) * vAlpha;
    gl_FragColor = vec4(vColor + vec3(0.4, 0.3, 0.1) * (1.0 - r), a);
  }
`;

const texLoader = new THREE.TextureLoader();
function loadTex(path) {
  return new Promise((resolve, reject) => {
    texLoader.load(path, t => {
      t.colorSpace = THREE.SRGBColorSpace;
      t.minFilter = THREE.LinearFilter;
      t.magFilter = THREE.LinearFilter;
      t.anisotropy = 4;
      resolve(t);
    }, undefined, reject);
  });
}

class NagaScene {
  constructor(rootEl) {
    this.root = rootEl;
    this.renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    this.renderer.setClearColor(0x050403, 1);
    rootEl.appendChild(this.renderer.domElement);

    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(35, window.innerWidth / window.innerHeight, 0.1, 100);
    this.camera.position.set(0, 0, 6);

    this.world = new THREE.Group();
    this.scene.add(this.world);

    // The shadowbox is its own group — gets parallax tilt
    this.box = new THREE.Group();
    this.world.add(this.box);

    this.lightDir = new THREE.Vector3(0, 1, 0.4).normalize(); // overhead
    this.cursor = new THREE.Vector2(0, 0);
    this.cursorTarget = new THREE.Vector2(0, 0);
    this.layers = {};
    this.allLitMaterials = [];
    this.transition = null;
    this.startTime = performance.now();
    this.introStart = performance.now() - 11000;   // skip intro burst
    this.isHero = true;
    this._reflectUV = new THREE.Vector2(0.5, 0.5);

    this._setupParticles();
    this._setupMotes();
    this._bindEvents();
    this._loop();
  }

  _quad(w, h, color, normal, opts = {}) {
    const mat = new THREE.ShaderMaterial({
      vertexShader: VERT,
      fragmentShader: FRAG_LIT,
      uniforms: {
        uColor: { value: color },
        uNormal: { value: normal || color },
        uLightDir: { value: new THREE.Vector3(0, 1, 0.4).normalize() },
        uLightColor: { value: new THREE.Color(1.0, 0.92, 0.72) },
        uAmbient: { value: new THREE.Color(0.18, 0.16, 0.14) },
        uOpacity: { value: opts.opacity ?? 1 },
        uEmissive: { value: opts.emissive ?? 0 },
        uTime: { value: 0 },
        uHasNormal: { value: normal ? 1 : 0 },
        uRimStrength: { value: opts.rim ?? 0.5 },
        uDissolve: { value: 0 },
        uSunPulse: { value: 0 },
        uIntroProgress: { value: 0 },
        uGreenPulse: { value: 0 },
        uIsFoliage: { value: opts.foliage ? 1 : 0 },
        uIsTitle: { value: opts.title ? 1 : 0 },
        uIsSun: { value: opts.sun ? 1 : 0 },
        uIsTrunk: { value: opts.trunk ? 1 : 0 },
        uIsPanels: { value: 0 },
        uBeamCenter: { value: 0.5 },
        uReflectUV: { value: new THREE.Vector2(0.5, 0.5) },
      },
      transparent: true,
      depthWrite: false,
      depthTest: true,
    });
    this.allLitMaterials.push(mat);
    return new THREE.Mesh(new THREE.PlaneGeometry(w, h), mat);
  }

  _marble(w, h) {
    const mat = new THREE.ShaderMaterial({
      vertexShader: VERT,
      fragmentShader: FRAG_MARBLE,
      uniforms: {
        uTime: { value: 0 },
        uVeinFlow: { value: 1 },
        uAspect: { value: new THREE.Vector2(w / h, 1) },
        uOpacity: { value: 1 },
        uSunPulse: { value: 0 },
        uBeamCenter: { value: 0.5 },
        uCausticAmt: { value: 0 },
        uGreenPulse: { value: 0 },
      },
    });
    return new THREE.Mesh(new THREE.PlaneGeometry(w, h), mat);
  }

  _gold(w, h, opts = {}) {
    const mat = new THREE.ShaderMaterial({
      vertexShader: VERT,
      fragmentShader: FRAG_GOLD,
      uniforms: {
        uTime: { value: 0 },
        uOpacity: { value: 1 },
        uLightDir: { value: new THREE.Vector3(0, 1, 0.4) },
        uShadeBias: { value: opts.shade ?? 0 },
        uSunPulse: { value: 0 },
        uGreenPulse: { value: 0 },
        uIntroProgress: { value: 0 },
        uReflectUV: { value: new THREE.Vector2(0.5, 0.5) },
        uBevelAxis: { value: opts.bevelAxis ?? 0 },
      },
      side: opts.side ?? THREE.FrontSide,
    });
    return new THREE.Mesh(new THREE.PlaneGeometry(w, h), mat);
  }

  _setupParticles() {
    const N = 600;
    const aStart = new Float32Array(N*3), aEnd = new Float32Array(N*3), aColor = new Float32Array(N*3), aSeed = new Float32Array(N);
    for (let i = 0; i < N; i++) {
      aStart[i*3] = (Math.random()-0.5)*5;
      aStart[i*3+1] = (Math.random()-0.5)*3;
      aStart[i*3+2] = (Math.random()-0.5)*0.5;
      aEnd[i*3]=aStart[i*3];aEnd[i*3+1]=aStart[i*3+1];aEnd[i*3+2]=aStart[i*3+2];
      aColor[i*3]=1;aColor[i*3+1]=0.85;aColor[i*3+2]=0.4;
      aSeed[i]=Math.random();
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(new Float32Array(N*3), 3));
    g.setAttribute('aStart', new THREE.BufferAttribute(aStart, 3));
    g.setAttribute('aEnd', new THREE.BufferAttribute(aEnd, 3));
    g.setAttribute('aColor', new THREE.BufferAttribute(aColor, 3));
    g.setAttribute('aSeed', new THREE.BufferAttribute(aSeed, 1));
    const mat = new THREE.ShaderMaterial({
      vertexShader: VERT_PARTICLE,
      fragmentShader: FRAG_PARTICLE,
      uniforms: { uProgress: { value: 0 }, uTime: { value: 0 }, uPixelRatio: { value: Math.min(window.devicePixelRatio, 2) } },
      transparent: true, blending: THREE.AdditiveBlending, depthWrite: false,
    });
    this.particles = new THREE.Points(g, mat);
    this.particles.visible = false;
    this.particles.renderOrder = 999;
    this.world.add(this.particles);
  }

  _setupMotes() {
    const N = 80;
    const seed = new Float32Array(N);
    for (let i = 0; i < N; i++) seed[i] = Math.random();
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(new Float32Array(N*3), 3));
    g.setAttribute('aSeed', new THREE.BufferAttribute(seed, 1));
    const mat = new THREE.ShaderMaterial({
      vertexShader: VERT_MOTE,
      fragmentShader: FRAG_MOTE,
      uniforms: {
        uTime: { value: 0 },
        uPixelRatio: { value: Math.min(window.devicePixelRatio, 2) },
        uBoundsMin: { value: new THREE.Vector3(-2.5, -1.4, -1) },
        uBoundsMax: { value: new THREE.Vector3(2.5, 1.4, 0.4) },
      },
      transparent: true, blending: THREE.AdditiveBlending, depthWrite: false,
    });
    this.motes = new THREE.Points(g, mat);
    this.world.add(this.motes);
  }

  async setup(config) {
    this.config = config;
    const m = config.media;
    const heroAspect = m.heroAspect || (1126 / 544);
    const [heroPlate, heroNormal, sunMask, dragonL, dragonR, title, foliage] = await Promise.all([
      loadTex(m.heroPlate), loadTex(m.heroNormal), loadTex(m.sunMask),
      loadTex(m.dragonLeft), loadTex(m.dragonRight), loadTex(m.title), loadTex(m.foliage),
    ]);

    const fov = this.camera.fov * Math.PI / 180;
    const distance = 6;
    const visibleH = 2 * Math.tan(fov / 2) * distance;
    const visibleW = visibleH * this.camera.aspect;

    // ===== MOBILE-AWARE FRAME SIZING =====
    // Phone gets a tall portrait frame; desktop keeps the landscape frame.
    // Title sits ABOVE on phone, tagline BELOW; frame fills the middle band.
    const isMobile = window.innerWidth < 720;
    this.isMobileLayout = isMobile;
    let boxW, boxH, boxDepth;
    if (isMobile) {
      // Wider — only 3% padding on each side. Portrait aspect ~0.66 (slightly taller than 2:3).
      boxW = visibleW * 0.97;
      const frameVerticalSpace = visibleH * 0.74; // leave ~14% above (title) + ~12% below (tagline + chip)
      const portraitAspect = 0.66;
      boxH = boxW / portraitAspect;
      if (boxH > frameVerticalSpace) {
        boxH = frameVerticalSpace;
        boxW = boxH * portraitAspect;
      }
      // Deeper box on phone — 26% vs 14% on desktop — for richer 3D parallax.
      boxDepth = boxH * 0.26;
      // Shift the box slightly down so title above gets visual breathing room.
      this.box.position.y = -visibleH * 0.04;
    } else {
      boxW = visibleW * 0.82;
      boxH = boxW / heroAspect;
      if (boxH > visibleH * 0.74) {
        boxH = visibleH * 0.74;
        boxW = boxH * heroAspect;
      }
      boxDepth = boxH * 0.14;
      this.box.position.y = -visibleH * 0.03;
    }

    // Inner artwork (slightly smaller than box opening)
    const artW = boxW * 0.96;
    const artH = boxH * 0.96;

    // === BACK WALL (marble) ===
    const back = this._marble(boxW, boxH);
    back.position.z = -boxDepth;
    this.box.add(back);
    this.layers.back = back;

    // === SIDE WALLS (gold-lined inner sides of the box) === sculpted bevel matches title
    // Left/right walls: vertical strips, bevel runs across vUv.x → bevelAxis 1
    const wallL = this._gold(boxDepth, boxH, { shade: -0.3, bevelAxis: 1 });
    wallL.rotation.y = Math.PI / 2;
    wallL.position.set(-boxW/2, 0, -boxDepth/2);
    this.box.add(wallL);
    this.layers.wallL = wallL;
    const wallR = this._gold(boxDepth, boxH, { shade: -0.3, bevelAxis: 1 });
    wallR.rotation.y = -Math.PI / 2;
    wallR.position.set(boxW/2, 0, -boxDepth/2);
    this.box.add(wallR);
    this.layers.wallR = wallR;
    // Top/bottom walls: horizontal strips, bevel runs across vUv.y → bevelAxis 0
    const wallT = this._gold(boxW, boxDepth, { shade: 0.1, bevelAxis: 0 });
    wallT.rotation.x = Math.PI / 2;
    wallT.position.set(0, boxH/2, -boxDepth/2);
    this.box.add(wallT);
    const wallB = this._gold(boxW, boxDepth, { shade: -0.4, bevelAxis: 0 });
    wallB.rotation.x = -Math.PI / 2;
    wallB.position.set(0, -boxH/2, -boxDepth/2);
    this.box.add(wallB);

    // === ARTWORK LAYERS (inside the box opening) ===
    // On mobile (portrait frame), each layer gets bespoke dimensions and positions
    // so the composition restages: sun bigger and higher, dragons tighter to sides,
    // tree (plate) taller. On desktop the original landscape staging is preserved.
    const sunW = isMobile ? artW * 1.10 : artW;
    const sunH = isMobile ? sunW * 0.55 : artH;
    const sunY = isMobile ? artH * 0.30 : artH * 0.05;

    const plateW = isMobile ? artW * 0.95 : artW;
    const plateH = isMobile ? artH * 0.85 : artH;
    const plateY = isMobile ? -artH * 0.10 : 0;

    const folW = isMobile ? artW * 1.05 : artW;
    const folH = isMobile ? artH * 1.05 : artH;
    const folY = isMobile ? -artH * 0.05 : 0;

    // Dragons get squeezed in width and pushed toward the sides on portrait, so
    // the silhouettes wrap inward like Naga sentinels along the frame walls.
    const dragW = isMobile ? artW * 0.85 : artW;
    const dragH = isMobile ? artH * 0.95 : artH;
    const dragShiftX = isMobile ? artW * 0.10 : 0;
    const dragShiftY = isMobile ? -artH * 0.02 : 0;

    const sun = this._quad(sunW, sunH, sunMask, null, { rim: 0, sun: true });
    sun.position.set(0, sunY, -boxDepth * 0.55);
    this.box.add(sun); this.layers.sun = sun;

    const dragLeft = this._quad(dragW, dragH, dragonL, heroNormal, { rim: 0.5 });
    dragLeft.position.set(-dragShiftX, dragShiftY, -boxDepth * 0.35);
    this.box.add(dragLeft); this.layers.dragonLeft = dragLeft;

    const dragRight = this._quad(dragW, dragH, dragonR, heroNormal, { rim: 0.5 });
    dragRight.position.set(dragShiftX, dragShiftY, -boxDepth * 0.35);
    this.box.add(dragRight); this.layers.dragonRight = dragRight;

    const plate = this._quad(plateW, plateH, heroPlate, heroNormal, { rim: 0.55, trunk: true });
    plate.position.set(0, plateY, -boxDepth * 0.18);
    this.box.add(plate); this.layers.plate = plate;

    // On mobile the gilded NAGA SURYA letters are NOT rendered inside the frame
    // (the DOM title above the frame replaces them). We still create the mesh so
    // existing transition logic can address layers.title — but it's invisible.
    const titleM = this._quad(artW, artH, title, heroNormal, { rim: 0.6, opacity: isMobile ? 0 : 0, title: true });
    titleM.position.z = -boxDepth * 0.10;
    titleM.visible = !isMobile; // hidden on phone
    this.box.add(titleM); this.layers.title = titleM;

    const fol = this._quad(folW, folH, foliage, heroNormal, { rim: 0.3, foliage: true });
    fol.position.set(0, folY, -boxDepth * 0.05);
    this.box.add(fol); this.layers.foliage = fol;

    // === WHITE-PULSE BRIDGE PLANE === fills the inner frame opening during transitions.
    // Pure additive white wash. uOpacity is animated by the transition state machine.
    const pulseMat = new THREE.ShaderMaterial({
      vertexShader: VERT,
      fragmentShader: `
        precision highp float;
        varying vec2 vUv;
        uniform float uOpacity;
        uniform float uTime;
        void main() {
          // Soft vignette so the pulse blooms from center
          vec2 c = vUv - 0.5;
          float r = length(c);
          float bloom = smoothstep(0.85, 0.0, r);
          // Slight breathing during the pulse
          float breath = 1.0 + 0.08 * sin(uTime * 12.0);
          vec3 col = vec3(1.0, 0.985, 0.94);
          gl_FragColor = vec4(col, uOpacity * bloom * breath);
        }`,
      uniforms: { uOpacity: { value: 0 }, uTime: { value: 0 } },
      transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
    });
    const pulse = new THREE.Mesh(new THREE.PlaneGeometry(artW, artH), pulseMat);
    pulse.position.z = 0.01; // very near the front, above all relief layers
    this.box.add(pulse);
    this.layers.pulse = pulse;

    // === OUTER FRAME (gold border around the box opening) ===
    // Build as 4 thin gold rectangles around the box opening
    // === OUTER FRAME (sculpted polished gold border around the box opening) ===
    // Top/bottom strips: bevel cross-section runs along the strip's short side (vUv.y) → bevelAxis 0
    // Left/right strips: bevel cross-section runs along the strip's short side (vUv.x) → bevelAxis 1
    const frameT = (boxH * 0.05);
    const outerW = boxW + frameT * 2;
    const outerH = boxH + frameT * 2;
    const top = this._gold(outerW, frameT, { shade: 0.05, bevelAxis: 0 });
    top.position.set(0, boxH/2 + frameT/2, 0.02);
    this.box.add(top);
    const bot = this._gold(outerW, frameT, { shade: -0.1, bevelAxis: 0 });
    bot.position.set(0, -boxH/2 - frameT/2, 0.02);
    this.box.add(bot);
    const lf = this._gold(frameT, boxH, { shade: 0, bevelAxis: 1 });
    lf.position.set(-boxW/2 - frameT/2, 0, 0.02);
    this.box.add(lf);
    const rf = this._gold(frameT, boxH, { shade: 0, bevelAxis: 1 });
    rf.position.set(boxW/2 + frameT/2, 0, 0.02);
    this.box.add(rf);
    this.layers.frame = [top, bot, lf, rf];

    this.boxDims = { w: boxW, h: boxH, d: boxDepth };

    this.applyPage('home', false);

    setTimeout(() => {
      const splash = document.getElementById('splash');
      if (splash) { splash.classList.add('hidden'); setTimeout(() => splash.remove(), 800); }
    }, 200);
  }

  applyPage(pageId) {
    const cfg = this.config.pages[pageId];
    if (!cfg) return;
    CURRENT_PAGE = pageId;
    const isHero = cfg.type === 'hero';
    this.isHero = isHero;

    // Target relief opacity. The transition state machine ramps the actual
    // applied value through fade-out / pulse-bridge / fade-in.
    this._reliefTarget = isHero ? 1 : 0;

    // Frame, side walls, marble back wall — ALWAYS visible (the frame is the
    // persistent staged set the spec requires).
    this.layers.back.material.uniforms.uOpacity.value = 1;
    this.box.children.forEach(c => {
      if (c.material && c.material.uniforms && c.material.uniforms.uShadeBias !== undefined) {
        c.material.uniforms.uOpacity.value = 1;
      }
    });

    // 3D title plane stays off — DOM owns the wordmark inside the relief itself
    // (it's painted into the title texture and rides with the relief group).
    this.layers.title.material.uniforms.uOpacity.value = 0;

    // Dragon position bookkeeping (kept for hero variations)
    const dragonPos = cfg.dragonPos || 'center';
    let dxL=0, dxR=0, dy=0;
    if (dragonPos==='left'){dxL=-0.2;dxR=4;dy=0.1;}
    else if (dragonPos==='coiled'){dxL=-0.05;dxR=0.05;dy=-0.05;}
    else if (dragonPos==='peeking'){dxL=4;dxR=0.3;dy=0.3;}
    this.layers.dragonLeft.position.x = dxL;
    this.layers.dragonLeft.position.y = dy;
    this.layers.dragonRight.position.x = dxR;
    this.layers.dragonRight.position.y = dy;
    // Reset parallax base captures so inner-layer differential parallax tracks
    // the new page-target positions instead of the previous ones.
    this.layers.dragonLeft.userData.baseX = dxL;
    this.layers.dragonLeft.userData.baseY = dy;
    this.layers.dragonRight.userData.baseX = dxR;
    this.layers.dragonRight.userData.baseY = dy;

    this.lightTilt = (cfg.lightTilt || 0) * Math.PI / 180;

    if (isHero) this.introStart = performance.now() - 11000;  // skip intro burst
    else        this.introStart = null;

    // Notify the DOM/UI that the active page has officially changed,
    // so it can swap visible content during the white-pulse bridge.
    window.dispatchEvent(new CustomEvent('ns-page', { detail: { page: pageId } }));
  }

  // ===== Universal transition state machine =====
  // Stages: idle → fadeOut (450ms) → pulseHold (1100ms, applyPage at midpoint)
  //         → pulseFade (550ms) → fadeIn (500ms) → idle.
  // Triggered by nav clicks. The white pulse always covers the swap.
  triggerTransition(toPage) {
    if (toPage === CURRENT_PAGE) return;
    if (this._tx) return; // ignore mid-transition clicks
    this._tx = {
      stage: 'fadeOut',
      to: toPage,
      t0: performance.now(),
      durations: { fadeOut: 450, pulseHold: 1100, pulseFade: 550, fadeIn: 500 },
    };
  }

  // Easter egg: full white wash over the relief without changing pages.
  triggerEasterEgg() {
    if (this._tx) return;
    this._tx = {
      stage: 'easterEgg',
      to: CURRENT_PAGE,
      t0: performance.now(),
      durations: { easterEgg: 1400 },
    };
  }

  _bindEvents() {
    window.addEventListener('resize', () => {
      this.renderer.setSize(window.innerWidth, window.innerHeight);
      this.camera.aspect = window.innerWidth / window.innerHeight;
      this.camera.updateProjectionMatrix();
    });

    // ===== Input system =====
    // Modes: 'cursor' (desktop) | 'tilt' (mobile w/ permission) | 'touch' (mobile fallback)
    // The chosen mode writes into this.cursorTarget. The render loop also tracks
    // idle time and gently auto-recenters → slow auto-pans when input goes quiet.
    this.lastInputAt = performance.now();
    this.inputMode = 'cursor';
    this._touchAccum = new THREE.Vector2(0, 0); // persistent touch-drag offset

    // prefers-reduced-motion → 25% intensity
    const reducedMotion = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    this.motionScale = reducedMotion ? 0.25 : 1.0;

    const markInput = () => { this.lastInputAt = performance.now(); };

    // --- Desktop pointer (mouse) ---
    const onPointer = (cx, cy) => {
      this.cursorTarget.set((cx/window.innerWidth)*2-1, -((cy/window.innerHeight)*2-1));
      markInput();
    };
    window.addEventListener('pointermove', e => {
      if (e.pointerType === 'mouse' || e.pointerType === 'pen') {
        this.inputMode = 'cursor';
        onPointer(e.clientX, e.clientY);
      }
    });

    // --- Touch fallback: drag-to-look + edge-aware mapping ---
    let touchStartX = 0, touchStartY = 0, touchStartAccum = new THREE.Vector2();
    window.addEventListener('touchstart', e => {
      if (this.inputMode === 'tilt') return;
      const t = e.touches[0]; if (!t) return;
      touchStartX = t.clientX; touchStartY = t.clientY;
      touchStartAccum.copy(this._touchAccum);
      markInput();
    }, { passive: true });
    window.addEventListener('touchmove', e => {
      if (this.inputMode === 'tilt') return;
      const t = e.touches[0]; if (!t) return;
      this.inputMode = 'touch';
      const dx = (t.clientX - touchStartX) / window.innerWidth * 2.5;
      const dy = (t.clientY - touchStartY) / window.innerHeight * 2.5;
      this._touchAccum.set(
        Math.max(-1, Math.min(1, touchStartAccum.x + dx)),
        Math.max(-1, Math.min(1, touchStartAccum.y - dy))
      );
      this.cursorTarget.copy(this._touchAccum);
      markInput();
    }, { passive: true });

    // --- Device orientation tilt ---
    const onTilt = e => {
      if (e.beta == null || e.gamma == null) return;
      this.inputMode = 'tilt';
      // Mobile sensitivity multiplier (0.7) baked in here so tilt feels natural.
      const x = Math.max(-1, Math.min(1, e.gamma / 30)) * 0.7;
      const y = Math.max(-1, Math.min(1, (e.beta - 30) / 40)) * 0.7;
      this.cursorTarget.set(x, y);
      markInput();
    };

    // iOS Safari requires a user-gesture permission request. We expose
    // window.__nagaRequestTilt() so the on-page sun chip can call it.
    const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) ||
                  (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
    const needsPermission = isIOS && typeof DeviceOrientationEvent !== 'undefined' &&
                            typeof DeviceOrientationEvent.requestPermission === 'function';

    window.__nagaRequestTilt = async () => {
      try {
        if (needsPermission) {
          const res = await DeviceOrientationEvent.requestPermission();
          if (res !== 'granted') return false;
        }
        window.addEventListener('deviceorientation', onTilt);
        return true;
      } catch (err) {
        console.warn('Tilt permission failed:', err);
        return false;
      }
    };

    // Auto-attach where no permission is needed (Android Chrome, desktops with sensors)
    if (!needsPermission && 'DeviceOrientationEvent' in window) {
      window.addEventListener('deviceorientation', onTilt);
    }

    // Notify the page whether a sun-chip prompt is needed
    window.__nagaTiltNeedsPrompt = needsPermission && ('ontouchstart' in window);

    // Sun click → page-wide radiant pulse (pebble in a pond)
    this._sunRipples = [];
  }

  // Trigger a radiant ripple from the sun. Called from the page when the sun is clicked.
  triggerSunRipple() {
    this._sunRipples = this._sunRipples || [];
    this._sunRipples.push({ t0: performance.now() });
    // Also dispatch a DOM event so the page CSS can echo a soft full-viewport ripple.
    window.dispatchEvent(new CustomEvent('naga:sun-ripple'));
  }

  _loop() {
    const tick = () => {
      const now = performance.now();
      const elapsed = (now - this.startTime) / 1000;
      this.cursor.lerp(this.cursorTarget, 0.10);
      const isMobile = window.innerWidth < 720;

      // ===== Idle auto-recenter → slow auto-pan =====
      // After ~5s of no input we ease cursorTarget back to center over ~3s, then
      // start a low-amplitude figure-8 auto-pan so the scene stays alive.
      const idleMs = now - (this.lastInputAt || now);
      if (idleMs > 5000 && this.inputMode !== 'touch') {
        // Recenter window 5s..8s (3-second slow return)
        const recenterT = Math.min(1, (idleMs - 5000) / 3000);
        const autoPanAmp = Math.min(1, (idleMs - 8500) / 3000) * 0.18;
        const ap = elapsed * 0.18;
        const px = Math.sin(ap) * autoPanAmp;
        const py = Math.sin(ap * 1.7) * autoPanAmp * 0.6;
        // Slow exponential pull toward center while recentering
        const pull = 0.012 * recenterT;
        this.cursorTarget.x += (px - this.cursorTarget.x) * pull;
        this.cursorTarget.y += (py - this.cursorTarget.y) * pull;
      }

      // ===== Box-tilt + camera shift =====
      // Max 7° box rotation (toRadians(7) ≈ 0.122). Camera shifts a third as much,
      // for "small camera + larger box tilt" combined feel. Scaled by motionScale
      // (25% if user prefers-reduced-motion).
      const tiltMaxRad = 0.122; // 7°
      const ms = this.motionScale;
      this.box.rotation.y = this.cursor.x * tiltMaxRad * ms;
      this.box.rotation.x = -this.cursor.y * tiltMaxRad * ms;
      // Camera shift — gentle head movement. ~0.18 world units at full input.
      this.camera.position.x = this.cursor.x * 0.18 * ms;
      this.camera.position.y = this.cursor.y * 0.14 * ms;
      this.camera.lookAt(0, 0, 0);

      // ===== Inner-layer differential parallax =====
      // Each relief plane sits at a known z; we shift it on X/Y proportional to its
      // depth so the inner stack shears with viewpoint like a real diorama.
      // Layers further from the back wall (closer to camera) shift LESS than the back.
      // The scale factor is small because the box tilt already provides primary depth.
      if (this.boxDims) {
        const d = this.boxDims.d;
        const px = -this.cursor.x * 0.10 * ms;
        const py = -this.cursor.y * 0.08 * ms;
        const apply = (mesh) => {
          if (!mesh) return;
          if (mesh.userData.baseX === undefined) {
            mesh.userData.baseX = mesh.position.x;
            mesh.userData.baseY = mesh.position.y;
          }
          const depth = Math.max(0, Math.min(1, -mesh.position.z / d));
          mesh.position.x = mesh.userData.baseX + px * depth;
          mesh.position.y = mesh.userData.baseY + py * depth;
        };
        apply(this.layers.sun);
        apply(this.layers.dragonLeft);
        apply(this.layers.dragonRight);
        apply(this.layers.plate);
        apply(this.layers.foliage);
      }

      // Top spotlight breathing — fixed light pinned to the top of the frame.
      const breath = 0.55 + Math.sin(elapsed * 1.1) * 0.18;
      const sharp  = Math.pow(Math.max(0, Math.sin(elapsed * 0.8)), 4) * 0.45;
      const sunPulseVal = Math.min(1, breath + sharp);

      // ===== INTRO PROGRESS (10 s choreography) =====
      // Plays once on entering the hero. After it finishes the persistent green throb
      // takes over at 50% intensity.
      const introMs = 10000;
      let introProg = 0;
      if (this.isHero && this.introStart != null) {
        introProg = Math.min(1, (now - this.introStart) / introMs);
      }
      // Persistent throbbing green energy — capped at 0.5 once the intro ends.
      // The slow 0.025 Hz wave timing is driven inside the fragment shader; this
      // value is just the amplitude envelope.
      const greenBase = this.isHero ? 0.5 * Math.min(1, introProg / 0.85) : 0.55;
      // A very gentle outer envelope so the amplitude itself sighs over ~25s.
      const greenEnvelope = 0.85 + 0.15 * Math.sin(elapsed * 0.25);
      const greenPulseVal = greenBase * greenEnvelope;

      // Parallax reflection target — moves opposite cursor direction across the gold,
      // simulating a physical surface catching the spotlight. Kept subtle (0.18/0.12)
      // so the sheen glides rather than sweeping hard across all surfaces at once.
      const reflTargetX = 0.5 - this.cursor.x * 0.18;
      const reflTargetY = 0.5 - this.cursor.y * 0.12;
      this._reflectUV.lerp(new THREE.Vector2(reflTargetX, reflTargetY), 0.08);

      // Light direction — overhead spotlight, fixed to avoid shading phase shifts during parallax.
      // Only a tiny x nudge (0.06) so the light feels slightly 3-dimensional without flickering.
      if (!this._lightDirTarget) this._lightDirTarget = new THREE.Vector3(0, 1, 0.4).normalize();
      const lx = this.cursor.x * 0.06;
      const ly = isMobile ? 0.5 + this.cursor.y * 0.10 : 0.95 + this.cursor.y * 0.05;
      const lz = isMobile ? 0.9 : 0.40;
      this._lightDirTarget.set(lx, ly + (this.lightTilt || 0), lz).normalize();
      // Smooth the light so it can never snap — interpolate at 3% per frame
      this.lightDir.lerp(this._lightDirTarget, 0.03);

      // Push uniforms to all lit (relief) materials
      for (const mat of this.allLitMaterials) {
        const u = mat.uniforms;
        u.uLightDir.value.copy(this.lightDir);
        u.uTime.value = elapsed;
        u.uSunPulse.value = sunPulseVal;
        u.uIntroProgress.value = introProg;
        u.uGreenPulse.value = greenPulseVal;
        u.uReflectUV.value.copy(this._reflectUV);
      }

      // Marble back wall
      if (this.layers.back) {
        const u = this.layers.back.material.uniforms;
        u.uTime.value = elapsed;
        u.uSunPulse.value = sunPulseVal;
        u.uGreenPulse.value = greenPulseVal;
        u.uCausticAmt.value = this.isHero ? 0 : 1;
      }

      // Gold pieces (frame + walls)
      this.box.children.forEach(c => {
        if (c.material && c.material.uniforms && c.material.uniforms.uShadeBias !== undefined) {
          const u = c.material.uniforms;
          u.uTime.value = elapsed;
          u.uSunPulse.value = sunPulseVal;
          u.uGreenPulse.value = greenPulseVal;
          u.uIntroProgress.value = introProg;
          u.uReflectUV.value.copy(this._reflectUV);
        }
      });

      this.motes.material.uniforms.uTime.value = elapsed;

      // Sun emissive — bright white halo during the first ~2s (intro pulse origin),
      // then gentle breathing. Sun-click ripples add a sharp emissive flash.
      let ripplePeak = 0;
      if (this._sunRipples && this._sunRipples.length) {
        this._sunRipples = this._sunRipples.filter(r => (now - r.t0) < 2200);
        for (const r of this._sunRipples) {
          const p = (now - r.t0) / 2200;
          // Sharp attack, slow decay
          const flash = Math.max(0, Math.exp(-p * 4) * (1 - p));
          ripplePeak = Math.max(ripplePeak, flash);
        }
      }
      if (this.layers.sun) {
        const introHalo = Math.max(0, 1 - introProg / 0.25) * 0.8;
        this.layers.sun.material.uniforms.uEmissive.value = 0.2 + sunPulseVal * 0.5 + introHalo + ripplePeak * 1.4;
        const scale = 1 + sunPulseVal * 0.04 + introHalo * 0.06 + ripplePeak * 0.10;
        this.layers.sun.scale.setScalar(scale);
      }

      // Dragon head turn
      if (this.layers.dragonLeft) {
        const a = this.cursor.x * 0.15;
        this.layers.dragonLeft.rotation.y = a;
        this.layers.dragonRight.rotation.y = a;
      }

      // ===== Universal transition state machine =====
      // _reliefOpacity is what we actually multiply the per-layer opacities by.
      // _pulseOpacity drives the inner-frame white-light bridge plane.
      if (!this._reliefOpacity && this._reliefOpacity !== 0) {
        this._reliefOpacity = this.isHero ? 1 : 0;
      }
      if (this._pulseOpacity == null) this._pulseOpacity = 0;
      const reliefTarget = this._reliefTarget != null ? this._reliefTarget : (this.isHero ? 1 : 0);

      if (this._tx) {
        const tx = this._tx;
        const t = now - tx.t0;
        const d = tx.durations;
        if (tx.stage === 'easterEgg') {
          // Symmetric supercharged white wash, no page change
          const total = d.easterEgg;
          const k = Math.min(1, t / total);
          // Triangle wave 0→1→0 with eased peak
          const env = Math.sin(k * Math.PI);
          this._pulseOpacity = Math.pow(env, 1.4) * 1.4; // brief overshoot, clamped via blending
          if (k >= 1) { this._tx = null; this._pulseOpacity = 0; }
        } else if (tx.stage === 'fadeOut') {
          const k = Math.min(1, t / d.fadeOut);
          // Fade relief out toward 0
          this._reliefOpacity = (this.isHero ? 1 : 0) * (1 - k) + 0 * k;
          // Pulse already starting to bloom in
          this._pulseOpacity = k * 0.6;
          if (k >= 1) {
            this._tx = { ...tx, stage: 'pulseHold', t0: now };
          }
        } else if (tx.stage === 'pulseHold') {
          const k = Math.min(1, t / d.pulseHold);
          this._reliefOpacity = 0;
          // Bloom up to peak then start coming down at 70%
          this._pulseOpacity = 0.6 + Math.sin(Math.min(k, 1) * Math.PI) * 0.7;
          // At the midpoint, swap the page
          if (!tx.swapped && k >= 0.45) {
            tx.swapped = true;
            this.applyPage(tx.to);
            // After applyPage updates isHero, our local reliefTarget becomes the new target
          }
          if (k >= 1) {
            this._tx = { ...tx, stage: 'pulseFade', t0: now };
          }
        } else if (tx.stage === 'pulseFade') {
          const k = Math.min(1, t / d.pulseFade);
          this._pulseOpacity = (1 - k) * 0.7;
          this._reliefOpacity = 0;
          if (k >= 1) {
            this._tx = { ...tx, stage: 'fadeIn', t0: now };
          }
        } else if (tx.stage === 'fadeIn') {
          const k = Math.min(1, t / d.fadeIn);
          this._reliefOpacity = reliefTarget * k;
          this._pulseOpacity = 0;
          if (k >= 1) {
            this._tx = null;
            this._reliefOpacity = reliefTarget;
          }
        }
      } else {
        // Idle — settle relief to whatever the current page wants
        this._reliefOpacity += (reliefTarget - this._reliefOpacity) * 0.15;
        this._pulseOpacity *= 0.9;
      }

      // Apply relief opacity to all motif layers (sun, plate, dragon L/R, foliage)
      const ro = this._reliefOpacity;
      if (this.layers.sun)         this.layers.sun.material.uniforms.uOpacity.value = ro;
      if (this.layers.plate)       this.layers.plate.material.uniforms.uOpacity.value = ro;
      if (this.layers.foliage)     this.layers.foliage.material.uniforms.uOpacity.value = ro;
      if (this.layers.dragonLeft)  this.layers.dragonLeft.material.uniforms.uOpacity.value = ro;
      if (this.layers.dragonRight) this.layers.dragonRight.material.uniforms.uOpacity.value = ro;

      // White-pulse bridge plane
      if (this.layers.pulse) {
        this.layers.pulse.material.uniforms.uOpacity.value = Math.max(0, this._pulseOpacity);
        this.layers.pulse.material.uniforms.uTime.value = elapsed;
      }

      this.renderer.render(this.scene, this.camera);
      requestAnimationFrame(tick);
    };
    tick();
  }
}

async function main() {
  CONFIG = await loadConfig();
  window.NS_CONFIG = CONFIG;
  const root = document.getElementById('scene-root');
  const scene = new NagaScene(root);
  await scene.setup(CONFIG);
  window.NS_SCENE = scene;
  window.dispatchEvent(new CustomEvent('ns-ready'));
}
main().catch(err => {
  console.error('Naga Surya scene failed:', err && (err.stack || err.message || err));
  document.getElementById('splash').innerHTML = '<div class="splash-mark" style="color:#ff8a6c">SCENE ERROR — see console</div>';
});

window.NS_navigate = (pageId) => { if (window.NS_SCENE) window.NS_SCENE.triggerTransition(pageId); };
window.NS_easterEgg = () => { if (window.NS_SCENE) window.NS_SCENE.triggerEasterEgg(); };
window.NS_sunRipple = () => { if (window.NS_SCENE) window.NS_SCENE.triggerSunRipple(); };
window.NS_setConfig = (cfg) => {
  if (window.NS_SCENE) {
    window.NS_SCENE.config = cfg;
    window.NS_CONFIG = cfg;
    localStorage.setItem('ns_config', JSON.stringify(cfg));
    window.NS_SCENE.applyPage(window.NS_currentPage || 'home', false);
  }
};
