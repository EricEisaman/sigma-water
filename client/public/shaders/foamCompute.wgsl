// Foam particle compute shader - SIGGRAPH quality dynamic foam simulation

struct FoamParticle {
  position: vec3<f32>,
  velocity: vec3<f32>,
  age: f32,
  lifetime: f32,
  density: f32,
};

struct SimParams {
  time: f32,
  deltaTime: f32,
  windDir: vec2<f32>,
  windSpeed: f32,
  gravity: f32,
  boatPos: vec3<f32>,
  boatRadius: f32,
  dissipation: f32,
  foamSpawnRate: f32,
};

@group(0) @binding(0) var<storage, read_write> particles: array<FoamParticle, 4096>;
@group(0) @binding(1) var<uniform> params: SimParams;
@group(0) @binding(2) var foamTexture: texture_storage_2d<rgba8unorm, read_write>;

fn hash(seed: vec3<f32>) -> f32 {
  return fract(sin(dot(seed, vec3<f32>(12.9898, 78.233, 45.164))) * 43758.5453);
}

fn pseudo_random(seed: vec3<f32>) -> vec3<f32> {
  let h1 = hash(seed);
  let h2 = hash(seed + vec3<f32>(1.0, 0.0, 0.0));
  let h3 = hash(seed + vec3<f32>(0.0, 1.0, 0.0));
  return vec3<f32>(h1, h2, h3);
}

@compute @workgroup_size(64)
fn main(@builtin(global_invocation_id) global_id: vec3<u32>) {
  let idx = global_id.x;
  if (idx >= 4096u) { return; }
  
  var particle = particles[idx];
  
  // Update particle age
  particle.age += params.deltaTime;
  
  // Check if particle is alive
  if (particle.age > particle.lifetime) {
    // Respawn particle at wave crest or boat collision
    let rand = pseudo_random(vec3<f32>(f32(idx), params.time, 0.0));
    
    // 70% spawn on wave crests, 30% on boat collision
    if (rand.x < 0.7) {
      // Spawn on wave surface
      let spawnX = rand.y * 400.0 - 200.0;
      let spawnZ = rand.z * 400.0 - 200.0;
      let waveHeight = sin(spawnX * 0.05 + params.time) * 2.0 + cos(spawnZ * 0.05 + params.time) * 2.0;
      
      particle.position = vec3<f32>(spawnX, waveHeight, spawnZ);
      particle.velocity = vec3<f32>(0.0, 0.5, 0.0);
      particle.age = 0.0;
      particle.lifetime = 3.0 + rand.x * 2.0;
      particle.density = 1.0;
    } else {
      // Spawn at boat collision
      let angle = rand.x * 6.28318530718;
      let radius = 15.0;
      particle.position = params.boatPos + vec3<f32>(cos(angle) * radius, 2.0, sin(angle) * radius);
      particle.velocity = vec3<f32>(cos(angle) * 5.0, 3.0, sin(angle) * 5.0);
      particle.age = 0.0;
      particle.lifetime = 4.0 + rand.y * 3.0;
      particle.density = 1.5;
    }
  } else {
    // Update existing particle
    
    // Apply wind force
    let windForce = params.windDir * params.windSpeed * 0.5;
    particle.velocity += windForce * params.deltaTime;
    
    // Apply gravity
    particle.velocity.y -= params.gravity * params.deltaTime;
    
    // Boat collision - repel foam away from boat
    let toParticle = particle.position - params.boatPos;
    let distToBoat = length(toParticle);
    if (distToBoat < params.boatRadius + 5.0) {
      let repelDir = normalize(toParticle);
      particle.velocity += repelDir * 8.0 * (1.0 - distToBoat / (params.boatRadius + 5.0));
    }
    
    // Update position
    particle.position += particle.velocity * params.deltaTime;
    
    // Dissipation - reduce density over lifetime
    let lifeProgress = particle.age / particle.lifetime;
    particle.density = (1.0 - lifeProgress * lifeProgress) * params.dissipation;
    
    // Clamp to world bounds
    if (particle.position.y < -10.0) {
      particle.age = particle.lifetime + 1.0; // Kill particle
    }
    if (abs(particle.position.x) > 500.0 || abs(particle.position.z) > 500.0) {
      particle.age = particle.lifetime + 1.0; // Kill particle
    }
  }
  
  particles[idx] = particle;
  
  // Write foam density to texture
  let texCoord = (particle.position.xz + vec2<f32>(500.0)) / 1000.0;
  let pixelCoord = vec2<u32>(texCoord * 512.0);
  
  if (pixelCoord.x < 512u && pixelCoord.y < 512u && particle.density > 0.01) {
    let foamValue = particle.density * 255.0;
    textureStore(foamTexture, pixelCoord, vec4<f32>(foamValue / 255.0, foamValue / 255.0, foamValue / 255.0, 1.0));
  }
}
