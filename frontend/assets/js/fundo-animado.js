/* VIOLET — fundo da tela inicial animado (WebGL).
   A ilustração é "dobrada" suavemente por máscaras: cada mulher balança e respira em seu próprio ritmo,
   o cabelo ondula e as folhas mexem com o vento. Se o WebGL não existir (ou o usuário pedir menos movimento),
   fica só a imagem parada que já está no HTML. */
(function () {
  var bg = document.querySelector(".welcome__bg");
  if (!bg) return;
  // Só para se a pessoa ligou "Reduzir animações" dentro do app. A configuração do Windows é ignorada de propósito:
  // muitos computadores (faculdade, modo economia, acesso remoto) vêm com ela desligada e a tela ficava parada.
  if (document.documentElement.dataset.reduzir === "1") return;
  // Plano B: sem WebGL (ou se ficar lento), a imagem anima por CSS
  function planoB() { bg.classList.add("is-css"); if (canvas.parentNode) canvas.parentNode.removeChild(canvas); }

  var parar = false;
  var canvas = document.createElement("canvas");
  canvas.className = "welcome__canvas";
  var gl = canvas.getContext("webgl", { antialias: false, alpha: false, premultipliedAlpha: false });
  if (!gl) { planoB(); return; }
  canvas.addEventListener("webglcontextlost", function (e) { e.preventDefault(); parar = true; planoB(); });

  var VS = "attribute vec2 a;varying vec2 v;void main(){v=vec2(a.x*.5+.5,.5-a.y*.5);gl_Position=vec4(a,0.,1.);}";
  var FS = [
    "precision mediump float;",
    "varying vec2 v;",
    "uniform sampler2D uImg,uA,uB;",
    "uniform float uT,uCa,uAy;",
    "const vec2 SZ=vec2(853.,1844.);",
    "const float IA=853./1844.;",
    // deslocamento (em pixels da imagem) de uma mulher: balanço com alavanca (cabeça mexe mais), respiração e ondulação
    "vec2 mulher(vec2 p,float m,vec2 anc,float topo,float ax,float vel,float fase,float resp){",
    "  float h=clamp((anc.y-p.y)/(anc.y-topo),0.,1.);",
    "  float s=sin(uT*vel+fase);",
    "  vec2 d=vec2(s*ax*h*h, -sin(uT*vel*.8+fase+1.3)*resp*h);",
    "  d+=(p-anc)*.006*sin(uT*vel*.7+fase+2.);",
    "  d+=vec2(sin(p.y*.045+uT*1.9+fase),sin(p.x*.04+uT*1.5+fase))*1.6*h;",
    "  return d*m;",
    "}",
    "void main(){",
    "  vec2 uv;",
    // tela mais "larga" que a ilustração: corta um pouco em cima e mais embaixo (uAy=.3), assim o texto não cobre as cabeças
    "  if(uCa>IA){float f=IA/uCa;uv=vec2(v.x,(1.-f)*uAy+v.y*f);}",
    "  else{uv=vec2(.5+(v.x-.5)*(uCa/IA),v.y);}",
    "  vec2 p=uv*SZ;",
    "  vec3 a=texture2D(uA,uv).rgb; vec3 b=texture2D(uB,uv).rgb;",
    "  vec2 d=vec2(0.);",
    "  d+=mulher(p,a.r,vec2(470.,1400.),730.,7.,1.00,0.0,5.);",
    "  d+=mulher(p,a.g,vec2(150.,1600.),970.,8.,0.88,2.1,6.);",
    "  d+=mulher(p,a.b,vec2(700.,1700.),985.,7.,1.12,4.2,5.);",
    "  d+=mulher(p,b.r,vec2(470.,1800.),1200.,7.,1.25,1.1,6.);",
    // folhas ao vento
    "  d+=vec2(sin(uT*1.3+p.y*.012)*9.,sin(uT*1.7+p.x*.01)*3.)*b.g;",
    "  vec3 c=texture2D(uImg,(p-d)/SZ).rgb;",
    "  gl_FragColor=vec4(c,1.);",
    "}"
  ].join("\n");

  function sh(type, src) {
    var s = gl.createShader(type); gl.shaderSource(s, src); gl.compileShader(s);
    if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(s));
    return s;
  }
  var prog;
  try {
    prog = gl.createProgram();
    gl.attachShader(prog, sh(gl.VERTEX_SHADER, VS));
    gl.attachShader(prog, sh(gl.FRAGMENT_SHADER, FS));
    gl.linkProgram(prog);
    if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) throw new Error("link");
  } catch (e) { planoB(); return; }
  gl.useProgram(prog);
  gl.uniform1f(gl.getUniformLocation(prog, "uAy"), 0.3);

  var buf = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, buf);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW);
  var loc = gl.getAttribLocation(prog, "a");
  gl.enableVertexAttribArray(loc);
  gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);

  var uT = gl.getUniformLocation(prog, "uT"), uCa = gl.getUniformLocation(prog, "uCa");
  var srcs = ["assets/img/fundo-violet.jpg", "assets/img/fundo-mask-a.png", "assets/img/fundo-mask-b.png"];
  var units = ["uImg", "uA", "uB"], pendentes = srcs.length, falhou = false;

  srcs.forEach(function (src, i) {
    var img = new Image();
    img.decoding = "async";
    img.onload = function () {
      try {
        var tex = gl.createTexture();
        gl.activeTexture(gl.TEXTURE0 + i);
        gl.bindTexture(gl.TEXTURE_2D, tex);
        gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGB, gl.RGB, gl.UNSIGNED_BYTE, img);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
        gl.uniform1i(gl.getUniformLocation(prog, units[i]), i);
      } catch (e) { falhou = true; }
      if (--pendentes === 0 && !falhou) iniciar();
    };
    img.onerror = function () { falhou = true; planoB(); };
    img.src = src;
  });

  function ajustar() {
    var dpr = Math.min(window.devicePixelRatio || 1, 2);
    var w = Math.max(1, Math.round(bg.clientWidth * dpr)), h = Math.max(1, Math.round(bg.clientHeight * dpr));
    if (canvas.width !== w || canvas.height !== h) { canvas.width = w; canvas.height = h; }
    gl.viewport(0, 0, w, h);
    gl.uniform1f(uCa, w / h);
  }

  function iniciar() {
    bg.appendChild(canvas);
    ajustar();
    if (window.ResizeObserver) new ResizeObserver(ajustar).observe(bg); else window.addEventListener("resize", ajustar);
    var t0 = performance.now(), n = 0, medido = false;
    (function quadro(agora) {
      if (parar) return;
      gl.uniform1f(uT, (agora - t0) / 1000);
      gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
      if (!bg.classList.contains("is-live")) bg.classList.add("is-live");
      // computador sem placa de vídeo: se os primeiros quadros forem lentos (menos de ~12 por segundo), troca pelo plano B
      n++;
      if (!medido && (n === 40 || agora - t0 > 4000)) {
        medido = true;
        if ((agora - t0) / n > 85) { parar = true; bg.classList.remove("is-live"); planoB(); return; }
      }
      requestAnimationFrame(quadro);
    })(t0);
  }
})();
