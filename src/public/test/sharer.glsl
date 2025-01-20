
precision highp float;


void mainImage( out vec4 fragColor, in vec2 fragCoord )
{
    // Normalized pixel coordinates (from 0 to 1)
    vec2 uv = fragCoord / iResolution.xy;
    
    // Calculate the to center distance
    float d = length(uv - 0.5) * 2.0;
    
    // Calculate the ripple time
    float t = d * d * 25.0 - iTime * 3.0;
    
    // Calculate the ripple thickness
    d = (cos(t) * 0.5 + 0.5) * (1.0 - d);
    
    // Time varying pixel color
    vec3 col = 0.5 + 0.5 * cos(t / 20.0 + uv.xyx + vec3(0.0,2.0,4.0));

    // Set the output color to rgb channels and the thickness to alpha channel
    // AO is automatically calculated
    fragColor = vec4(col, d);
}

/** SHADERDATA
{
	"title": "My Shader 0",
	"description": "Lorem ipsum dolor",
	"model": "person"
}
*/