// Continuous local deformation of one sharp texture. No optical-flow blends.
sampler2D Input : register(s0);
sampler2D ClosedEyes : register(s1);
float4 Anim : register(c0); // time, strength, lookX, lookY
float4 Mood : register(c1); // blink, walk weight, hand wave, sleep weight
float4 main(float2 uv : TEXCOORD) : COLOR {
    float t = Anim.x;
    float strength = Anim.y;
    float2 p = uv;
    float head = 1 - smoothstep(0.34, 0.65, p.y);
    // A very small chest rise, pinned at the feet.
    float breath = (sin(t * 1.9) * 0.0035 + sin(t * 0.71) * 0.001) * strength;
    p.y = (p.y - 0.95) / (1 + breath) + 0.95;
    p.x -= head * Anim.z * 0.0055;
    p.y -= head * Anim.w * 0.003;
    // Hair and wing motion are localized outside the face and torso.
    float side = smoothstep(0.16, 0.34, abs(p.x - 0.51));
    float hair = side * smoothstep(0.24, 0.6, p.y);
    p.x -= hair * sin(t * 1.6 + p.y * 7) * 0.005 * strength;
    float wings = side * (1 - smoothstep(0.56, 0.75, p.y)) * smoothstep(0.3, 0.44, p.y);
    p.y -= wings * sin(t * 2.4 + p.x * 2) * 0.006 * strength;
    float tail = smoothstep(0.65, 0.88, p.x) * smoothstep(0.57, 0.78, p.y);
    p.x -= tail * sin(t * 1.9 - 0.6) * 0.004 * strength;
    float legs = smoothstep(0.67, 0.91, p.y);
    p.y += legs * sin(t * 9.5 + (p.x - 0.5) * 12) * 0.007 * Mood.y;
    // Small hand/forearm movement in the waving pose.
    float hand = saturate(1 - length((p - float2(0.31, 0.43)) / float2(0.13, 0.15)));
    p.x += hand * sin(t * 9) * 0.012 * Mood.z;
    float4 color = tex2D(Input, p);
    float4 closed = tex2D(ClosedEyes, p);
    return lerp(color, closed, Mood.x);
}
