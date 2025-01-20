
#ifdef GL_ES
precision mediump float;
#endif

uniform vec2 u_resolution;
uniform vec2 u_mouse;
uniform float u_time;
uniform sampler2D u_texture; 

const float PI = 3.14159265359;

struct Particle {
    vec2 pos;
    vec2 vel;
};

const int MAX_PARTICLES = 1000;
Particle particles[MAX_PARTICLES];

float rand(vec2 co){
    return fract(sin(dot(co.xy ,vec2(12.9898,78.233))) * 43758.5453);
}

void initParticles() {
    for(int i = 0; i < MAX_PARTICLES; i++) {
        particles[i].pos = vec2(rand(vec2(i, 0.0)) * u_resolution.x, rand(vec2(i, 1.0)) * u_resolution.y);
        particles[i].vel = vec2(sin(float(i) * 0.1 + u_time * 0.1), cos(float(i) * 0.1 + u_time * 0.1)) * 0.1;
    }
}

float distanceToShape(vec2 pos) {
    // Example: Distance to a circle
    vec2 center = vec2(u_mouse.x, u_mouse.y);
    float radius = 50.0;
    return distance(pos, center) - radius;
}

void updateParticles() {
    for(int i = 0; i < MAX_PARTICLES; i++) {
        // Basic movement with noise
        particles[i].pos += particles[i].vel + vec2(sin(particles[i].pos.x * 0.01 + u_time) * 0.01, cos(particles[i].pos.y * 0.01 + u_time) * 0.01);

        // Attraction to shape
        float dist = distanceToShape(particles[i].pos);
        if (dist < 50.0) { // Adjust attraction radius
            particles[i].vel -= normalize(particles[i].pos - vec2(u_mouse.x, u_mouse.y)) * 0.01 * (50.0 - dist); 
        }

        // Boundary check
        particles[i].pos = clamp(particles[i].pos, vec2(0.0), u_resolution);
    }
}

void main() {
    vec2 uv = gl_FragCoord.xy / u_resolution;

    // Initialize particles on first frame
    if (u_time == 0.0) {
        initParticles();
    }

    // Update particle positions
    updateParticles();

    vec4 color = texture2D(u_texture, uv);

    // Render particles
    for(int i = 0; i < MAX_PARTICLES; i++) {
        float dist = distance(uv, particles[i].pos / u_resolution);
        if (dist < 0.01) { // Adjust particle size
            color = vec4(1.0, 1.0, 1.0, 1.0); 
            break;
        }
    }

    gl_FragColor = color;
}