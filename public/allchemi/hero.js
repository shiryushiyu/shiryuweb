(() => {
  const canvas = document.getElementById('heroCanvas');
  const ctx = canvas.getContext('2d');
  let w, h, dpr;
  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  function resize(){
    dpr = Math.min(window.devicePixelRatio || 1, 2);
    w = canvas.offsetWidth; h = canvas.offsetHeight;
    canvas.width = w * dpr; canvas.height = h * dpr;
    ctx.setTransform(dpr,0,0,dpr,0,0);
  }

  // Build a simple icosahedron (vertices + edges)
  function buildIcosahedron(){
    const t = (1 + Math.sqrt(5)) / 2;
    const raw = [
      [-1, t, 0], [1, t, 0], [-1, -t, 0], [1, -t, 0],
      [0, -1, t], [0, 1, t], [0, -1, -t], [0, 1, -t],
      [t, 0, -1], [t, 0, 1], [-t, 0, -1], [-t, 0, 1]
    ];
    const len = Math.sqrt(1 + t*t);
    const verts = raw.map(v => v.map(c => c / len));
    const edges = [
      [0,1],[0,5],[0,7],[0,10],[0,11],
      [1,5],[1,7],[1,8],[1,9],
      [2,3],[2,4],[2,6],[2,10],[2,11],
      [3,4],[3,6],[3,8],[3,9],
      [4,5],[4,9],[4,11],
      [5,9],[5,11],
      [6,7],[6,8],[6,10],
      [7,8],[7,10],
      [8,9],
      [10,11]
    ];
    return { verts, edges };
  }

  const shapes = [];

  function initShapes(){
    shapes.length = 0;
    const count = w < 700 ? 1 : 2;
    for(let i=0;i<count;i++){
      shapes.push({
        cx: w * (0.62 + i * 0.16),
        cy: h * (0.4 + i * 0.12),
        radius: Math.min(w,h) * (i === 0 ? 0.24 : 0.13),
        rotX: Math.random()*Math.PI,
        rotY: Math.random()*Math.PI,
        speedX: 0.0004 + Math.random()*0.0002,
        speedY: 0.0006 + Math.random()*0.0002,
        geo: buildIcosahedron()
      });
    }
  }

  function project(v, rotX, rotY, radius, cx, cy){
    let [x,y,z] = v;
    // rotate around Y
    let x1 = x*Math.cos(rotY) - z*Math.sin(rotY);
    let z1 = x*Math.sin(rotY) + z*Math.cos(rotY);
    // rotate around X
    let y2 = y*Math.cos(rotX) - z1*Math.sin(rotX);
    let z2 = y*Math.sin(rotX) + z1*Math.cos(rotX);

    const perspective = 3.4 / (3.4 + z2);
    return {
      x: cx + x1 * radius * perspective,
      y: cy + y2 * radius * perspective,
      depth: z2
    };
  }

  function draw(t){
    ctx.clearRect(0,0,w,h);

    for(const s of shapes){
      s.rotX += s.speedX;
      s.rotY += s.speedY;

      const projected = s.geo.verts.map(v => project(v, s.rotX, s.rotY, s.radius, s.cx, s.cy));

      for(const [a,b] of s.geo.edges){
        const pa = projected[a], pb = projected[b];
        const avgDepth = (pa.depth + pb.depth) / 2;
        const alpha = 0.15 + (avgDepth + 1) * 0.15;
        ctx.beginPath();
        ctx.moveTo(pa.x, pa.y);
        ctx.lineTo(pb.x, pb.y);
        ctx.strokeStyle = `rgba(183,139,55,${alpha.toFixed(3)})`;
        ctx.lineWidth = 1;
        ctx.stroke();
      }

      for(const p of projected){
        const alpha = 0.25 + (p.depth + 1) * 0.2;
        ctx.beginPath();
        ctx.arc(p.x, p.y, 1.6, 0, Math.PI*2);
        ctx.fillStyle = `rgba(255,255,255,${alpha.toFixed(3)})`;
        ctx.fill();
      }
    }

    if(!reduceMotion) requestAnimationFrame(draw);
  }

  function start(){
    resize();
    initShapes();
    if(reduceMotion){
      draw(0);
    } else {
      requestAnimationFrame(draw);
    }
  }

  window.addEventListener('resize', () => { resize(); initShapes(); });
  start();
})();
