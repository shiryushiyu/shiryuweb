(() => {
  const canvas = document.getElementById('heroCanvas');
  const ctx = canvas.getContext('2d');
  let w, h, dpr;
  let particles = [];
  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  function resize(){
    dpr = Math.min(window.devicePixelRatio || 1, 2);
    w = canvas.offsetWidth; h = canvas.offsetHeight;
    canvas.width = w * dpr; canvas.height = h * dpr;
    ctx.setTransform(dpr,0,0,dpr,0,0);
  }

  function noise(x, y, t){
    return Math.sin(x*0.0022 + t*0.00016) + Math.cos(y*0.0025 - t*0.00012) + Math.sin((x+y)*0.0013 + t*0.0002);
  }

  function initParticles(){
    particles = [];
    const count = Math.floor((w*h)/9000);
    for(let i=0;i<count;i++){
      particles.push({
        x: Math.random()*w,
        y: Math.random()*h,
        life: Math.random()*200,
        cyan: Math.random() > 0.4
      });
    }
  }

  function draw(t){
    ctx.fillStyle = 'rgba(5,7,10,0.16)';
    ctx.fillRect(0,0,w,h);

    for(const p of particles){
      const angle = noise(p.x, p.y, t) * Math.PI;
      const speed = 0.6;
      const nx = p.x + Math.cos(angle)*speed;
      const ny = p.y + Math.sin(angle)*speed;

      ctx.beginPath();
      ctx.moveTo(p.x, p.y);
      ctx.lineTo(nx, ny);
      ctx.strokeStyle = p.cyan ? 'rgba(40,226,255,0.35)' : 'rgba(59,107,255,0.35)';
      ctx.lineWidth = 1;
      ctx.stroke();

      p.x = nx; p.y = ny;
      p.life--;
      if(p.life <= 0 || p.x<0 || p.x>w || p.y<0 || p.y>h){
        p.x = Math.random()*w; p.y = Math.random()*h; p.life = 100 + Math.random()*160;
      }
    }

    if(!reduceMotion) requestAnimationFrame(draw);
  }

  function start(){
    resize();
    ctx.fillStyle = '#05070a';
    ctx.fillRect(0,0,w,h);
    initParticles();
    if(reduceMotion){
      draw(0);
    } else {
      requestAnimationFrame(draw);
    }
  }

  window.addEventListener('resize', () => { resize(); initParticles(); });
  start();
})();
