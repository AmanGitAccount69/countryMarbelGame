import React, { useEffect, useRef } from 'react';
import Matter from 'matter-js';
import { Country } from '../types';
import { GAME_CONFIG } from '../constants';

interface GameCanvasProps {
  countries: Country[];
  onRoundWin: (winnerId: string) => void;
  isPaused: boolean;
  onElimination: (remainingIds: string[]) => void;
  triggerRestart: number;
  soundEnabled: boolean;
}

const GameCanvas: React.FC<GameCanvasProps> = ({ 
  countries, 
  onRoundWin, 
  onElimination,
  triggerRestart,
  isPaused,
  soundEnabled
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const engineRef = useRef<Matter.Engine | null>(null);
  const runnerRef = useRef<Matter.Runner | null>(null);
  const renderLoopRef = useRef<number | null>(null);
  const arenaBodyRef = useRef<Matter.Body | null>(null);
  const audioCtxRef = useRef<AudioContext | null>(null);
  
  // Preloaded Audio Data
  const audioBuffersRef = useRef<{
    pop: AudioBuffer | null;
  }>({ pop: null });

  // Strict round control
  const roundCompletedRef = useRef(false);

  // Refs for callbacks
  const onRoundWinRef = useRef(onRoundWin);
  const onEliminationRef = useRef(onElimination);

  useEffect(() => { onRoundWinRef.current = onRoundWin; }, [onRoundWin]);
  useEffect(() => { onEliminationRef.current = onElimination; }, [onElimination]);
  
  const sceneState = useRef({
    width: 0,
    height: 0,
    cx: 0,
    cy: 0,
    radius: 0,
    rotation: 0
  });

  const imagesRef = useRef<Map<string, HTMLImageElement>>(new Map());

  // Helper to load flag images
  useEffect(() => {
    countries.forEach(country => {
      if (!imagesRef.current.has(country.id)) {
        const img = new Image();
        img.src = `https://flagcdn.com/w80/${country.code}.png`;
        imagesRef.current.set(country.id, img);
      }
    });
  }, [countries]);

  // Audio Context & Preloading Setup
  useEffect(() => {
    const AudioContext = window.AudioContext || (window as any).webkitAudioContext;
    if (AudioContext) {
      const ctx = new AudioContext();
      audioCtxRef.current = ctx;

      // PRELOAD / PRE-WARM PROCEDURAL SOUNDS
      // We generate a short "marble click" buffer once to reuse instead of creating nodes every time.
      const sampleRate = ctx.sampleRate;
      const length = 0.05 * sampleRate; // 50ms
      const buffer = ctx.createBuffer(1, length, sampleRate);
      const data = buffer.getChannelData(0);
      for (let i = 0; i < length; i++) {
        // Decay sine wave for "click"
        const t = i / sampleRate;
        const envelope = Math.exp(-t * 60);
        data[i] = Math.sin(2 * Math.PI * (800 + Math.sin(t * 10) * 100) * t) * envelope * 0.5;
      }
      audioBuffersRef.current.pop = buffer;
      
      const resumeAudio = () => {
        if (ctx.state === 'suspended') {
          ctx.resume();
        }
      };
      document.addEventListener('click', resumeAudio);
      document.addEventListener('touchstart', resumeAudio);
      
      return () => {
        document.removeEventListener('click', resumeAudio);
        document.removeEventListener('touchstart', resumeAudio);
        if (ctx.state !== 'closed') ctx.close();
      };
    }
  }, []);

  useEffect(() => {
    if (runnerRef.current) {
        runnerRef.current.enabled = !isPaused;
    }
  }, [isPaused]);

  const playCollisionSound = (impact: number) => {
    if (!audioCtxRef.current || isPaused || !soundEnabled) return;
    const ctx = audioCtxRef.current;
    if (impact < 1.2) return; 

    const vol = Math.min(Math.max(impact / 70, 0.02), 0.15);
    const buffer = audioBuffersRef.current.pop;

    if (buffer) {
      const source = ctx.createBufferSource();
      source.buffer = buffer;
      const gain = ctx.createGain();
      gain.gain.setValueAtTime(vol, ctx.currentTime);
      source.connect(gain);
      gain.connect(ctx.destination);
      source.start();
    }
  };

  const playEliminationSound = () => {
    if (!audioCtxRef.current || isPaused || !soundEnabled) return;
    const ctx = audioCtxRef.current;

    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);

    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(150, ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(30, ctx.currentTime + 0.4);

    gain.gain.setValueAtTime(0.1, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.4);

    osc.start(ctx.currentTime);
    osc.stop(ctx.currentTime + 0.45);
  };

  useEffect(() => {
    if (!containerRef.current || !canvasRef.current) return;

    const engine = Matter.Engine.create();
    engine.gravity.y = 0.8;
    engineRef.current = engine;

    const runner = Matter.Runner.create();
    runner.enabled = !isPaused;
    runnerRef.current = runner;

    Matter.Events.on(engine, 'collisionStart', (event) => {
        event.pairs.forEach((pair) => {
            const bodyA = pair.bodyA;
            const bodyB = pair.bodyB;
            
            if (bodyA.label.startsWith('ball-') && bodyB.label.startsWith('ball-')) {
                const speed = Matter.Vector.magnitude(Matter.Vector.sub(bodyA.velocity, bodyB.velocity));
                playCollisionSound(speed);

                // Anti-sticking impulse
                const normal = Matter.Vector.normalise(Matter.Vector.sub(bodyB.position, bodyA.position));
                const forceMagnitude = 0.015; 
                Matter.Body.applyForce(bodyA, bodyA.position, Matter.Vector.mult(normal, -forceMagnitude));
                Matter.Body.applyForce(bodyB, bodyB.position, Matter.Vector.mult(normal, forceMagnitude));
            }
        });
    });

    const createArena = (cx: number, cy: number, radius: number, angle: number) => {
      const wallThickness = 24;
      const segments = 60;
      const parts: Matter.Body[] = [];
      const gapSizeRad = (GAME_CONFIG.GAP_SIZE_DEGREES * Math.PI) / 180;
      const step = (2 * Math.PI) / segments;

      for (let a = 0; a < 2 * Math.PI; a += step) {
        const x = cx + radius * Math.cos(a);
        const y = cy + radius * Math.sin(a);
        const isGap = a < gapSizeRad;

        const wall = Matter.Bodies.rectangle(x, y, 44, wallThickness, {
          isStatic: false, 
          angle: a + Math.PI / 2,
          render: { visible: !isGap },
          isSensor: isGap,
          collisionFilter: isGap ? { mask: 0 } : undefined,
          friction: 0,
          restitution: 1.15
        });
        parts.push(wall);
      }

      const arena = Matter.Body.create({
        parts: parts,
        isStatic: true,
        label: 'Arena',
        friction: 0,
        restitution: 1.15
      });
      
      Matter.Body.setPosition(arena, { x: cx, y: cy });
      Matter.Body.setAngle(arena, angle);
      return arena;
    };

    const handleResize = () => {
      if (!containerRef.current || !canvasRef.current || !engineRef.current) return;
      
      const width = containerRef.current.clientWidth;
      const height = containerRef.current.clientHeight;
      
      canvasRef.current.width = width;
      canvasRef.current.height = height;

      const cx = width / 2;
      const cy = height / 2;
      const minDimension = Math.min(width, height);
      const radius = Math.max(60, (minDimension / 2) - 40);

      sceneState.current = { ...sceneState.current, width, height, cx, cy, radius };

      let currentAngle = sceneState.current.rotation;
      if (arenaBodyRef.current) {
         currentAngle = arenaBodyRef.current.angle;
         Matter.World.remove(engineRef.current.world, arenaBodyRef.current);
      }
      
      const newArena = createArena(cx, cy, radius, currentAngle);
      arenaBodyRef.current = newArena;
      Matter.World.add(engineRef.current.world, newArena);
    };

    handleResize();
    window.addEventListener('resize', handleResize);

    Matter.Runner.run(runner, engine);

    const ctx = canvasRef.current.getContext('2d');
    
    const render = () => {
      if (!ctx || !canvasRef.current || !engineRef.current) return;
      const { width, height } = sceneState.current;
      ctx.clearRect(0, 0, width, height);
      
      const grad = ctx.createRadialGradient(width/2, height/2, 100, width/2, height/2, Math.max(width, height));
      grad.addColorStop(0, '#1e293b');
      grad.addColorStop(1, '#0f172a');
      ctx.fillStyle = grad;
      ctx.fillRect(0,0, width, height);

      const bodies = Matter.Composite.allBodies(engine.world);

      bodies.forEach(body => {
        if (body.label === 'Arena') {
          ctx.fillStyle = '#475569';
          body.parts.forEach(part => {
            if(part.id === body.id) return; 
            if(part.render.visible === false) return;
            ctx.save();
            ctx.translate(part.position.x, part.position.y);
            ctx.rotate(part.angle);
            ctx.fillRect(-22, -12, 44, 24);
            ctx.restore();
          });
        } else if (body.label.startsWith('ball-')) {
            const radius = GAME_CONFIG.BALL_SIZE;
            const countryId = body.label.replace('ball-', '');
            const img = imagesRef.current.get(countryId);

            ctx.save();
            ctx.translate(body.position.x, body.position.y);
            ctx.rotate(body.angle);
            ctx.beginPath();
            ctx.arc(0, 0, radius, 0, 2 * Math.PI);
            ctx.clip();

            if (img && img.complete) {
               const scale = (radius * 2.5) / img.width;
               ctx.drawImage(img, -img.width * scale / 2, -img.height * scale / 2, img.width * scale, img.height * scale);
            } else {
               ctx.fillStyle = '#fff'; ctx.fill();
            }

            ctx.beginPath();
            ctx.arc(-radius*0.3, -radius*0.3, radius*0.4, 0, Math.PI*2);
            ctx.fillStyle = 'rgba(255,255,255,0.2)';
            ctx.fill();

            ctx.beginPath();
            ctx.arc(0, 0, radius, 0, 2 * Math.PI);
            ctx.strokeStyle = 'rgba(255,255,255,0.8)';
            ctx.lineWidth = 2;
            ctx.stroke();
            ctx.restore();
        }
      });

      renderLoopRef.current = requestAnimationFrame(render);
    };

    renderLoopRef.current = requestAnimationFrame(render);

    let rotationAngle = sceneState.current.rotation; 
    const gameLogicEvents = Matter.Events.on(engine, 'beforeUpdate', () => {
        if (arenaBodyRef.current) {
            rotationAngle += GAME_CONFIG.ARENA_ROTATION_SPEED;
            Matter.Body.setAngle(arenaBodyRef.current, rotationAngle);
            sceneState.current.rotation = rotationAngle;
        }

        const balls = Matter.Composite.allBodies(engine.world).filter(b => b.label.startsWith('ball-'));
        const activeBallIds: string[] = [];
        let eliminationHappened = false;
        const { width, height } = sceneState.current;
        const buffer = 150;
        const MAX_SPEED = 14;

        balls.forEach(ball => {
            if (ball.speed > MAX_SPEED) {
                Matter.Body.setVelocity(ball, Matter.Vector.mult(Matter.Vector.normalise(ball.velocity), MAX_SPEED));
            }
            if (ball.speed < 0.4) {
                Matter.Body.applyForce(ball, ball.position, { x: (Math.random() - 0.5) * 0.001, y: -0.001 });
            }
            if (ball.position.y > height + buffer || ball.position.x < -buffer || ball.position.x > width + buffer) {
                playEliminationSound();
                Matter.World.remove(engine.world, ball);
                eliminationHappened = true;
            } else {
                activeBallIds.push(ball.label.replace('ball-', ''));
            }
        });

        if (eliminationHappened) onEliminationRef.current(activeBallIds);

        if (!roundCompletedRef.current && activeBallIds.length === 1) {
            const winnerId = activeBallIds[0];
            if (winnerId) {
                roundCompletedRef.current = true;
                onRoundWinRef.current(winnerId);
            }
        }
    });

    return () => {
      window.removeEventListener('resize', handleResize);
      if (renderLoopRef.current) cancelAnimationFrame(renderLoopRef.current);
      if (engineRef.current) Matter.Events.off(engineRef.current, 'beforeUpdate', gameLogicEvents);
      if (runnerRef.current) Matter.Runner.stop(runnerRef.current);
      if (engineRef.current) Matter.Engine.clear(engineRef.current);
    };
  }, [soundEnabled]); 

  useEffect(() => {
     if (!engineRef.current || !containerRef.current) return;
     roundCompletedRef.current = false;

     const world = engineRef.current.world;
     Matter.Composite.allBodies(world).filter(b => b.label.startsWith('ball-')).forEach(b => Matter.World.remove(world, b));

     const newBalls: Matter.Body[] = [];
     const { cx, cy, radius } = sceneState.current;
     const spawnRadius = Math.max(20, radius * 0.55); 
     const eligibleCountries = countries.filter(c => !c.isChampion);

     eligibleCountries.forEach((country) => {
        const angle = Math.random() * Math.PI * 2;
        const r = Math.random() * spawnRadius;
        const ball = Matter.Bodies.circle(cx + r * Math.cos(angle), cy + r * Math.sin(angle), GAME_CONFIG.BALL_SIZE, {
            restitution: 1.15,
            friction: 0,
            frictionAir: 0.0005,
            density: 0.04,
            slop: 0,
            label: `ball-${country.id}`,
            sleepThreshold: -1 
        });
        Matter.Body.setVelocity(ball, { x: (Math.random() - 0.5) * 6, y: (Math.random() - 0.5) * 6 });
        newBalls.push(ball);
     });

     Matter.World.add(world, newBalls);
     onEliminationRef.current(eligibleCountries.map(c => c.id));
  }, [triggerRestart, countries]);


  return (
    <div ref={containerRef} className="absolute inset-0 w-full h-full overflow-hidden z-0 bg-slate-900">
      <canvas ref={canvasRef} className="block w-full h-full" />
    </div>
  );
};

export default GameCanvas;