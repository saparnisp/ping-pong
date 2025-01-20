document.addEventListener("DOMContentLoaded", () => {
  const canvas = document.getElementById("canvas");
  if (canvas) {
    canvas.width = window?.innerWidth;
    canvas.height = window?.innerHeight;
  }
});

// const getRenderingContext = () => {
//   const canvas = document.getElementById("canvas");

//   return canvas.getContext("webgl2");
// };

// window.addEventListener("load", setupWebGL, false);
// let gl;
// let program;

// function setupWebGL(evt) {
//   window.removeEventListener(evt.type, setupWebGL, false);
//   if (!(gl = getRenderingContext())) return;

//   let source = document.querySelector("#vertex-shader").innerHTML;
//   const vertexShader = gl.createShader(gl.VERTEX_SHADER);
//   gl.shaderSource(vertexShader, source);
//   gl.compileShader(vertexShader);

//   source = document.querySelector("#fragment-shader").innerHTML;
//   const fragmentShader = gl.createShader(gl.FRAGMENT_SHADER);
//   gl.shaderSource(fragmentShader, source);
//   gl.compileShader(fragmentShader);
//   program = gl.createProgram();
//   gl.attachShader(program, vertexShader);
//   gl.attachShader(program, fragmentShader);
//   gl.linkProgram(program);
//   gl.detachShader(program, vertexShader);
//   gl.detachShader(program, fragmentShader);
//   gl.deleteShader(vertexShader);
//   gl.deleteShader(fragmentShader);
//   if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
//     const linkErrLog = gl.getProgramInfoLog(program);
//     cleanup();
//     document.querySelector(
//       "p"
//     ).textContent = `Shader program did not link successfully. Error log: ${linkErrLog}`;
//     return;
//   }

//   initializeAttributes();

//   gl.useProgram(program);
//   gl.drawArrays(gl.POINTS, 0, 1);

//   cleanup();
// }

// let buffer;
// function initializeAttributes() {
//   gl.enableVertexAttribArray(0);
//   buffer = gl.createBuffer();
//   gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
//   gl.vertexAttribPointer(0, 1, gl.FLOAT, false, 0, 0);
// }

// function cleanup() {
//   gl.useProgram(null);
//   if (buffer) {
//     gl.deleteBuffer(buffer);
//   }
//   if (program) {
//     gl.deleteProgram(program);
//   }
// }
