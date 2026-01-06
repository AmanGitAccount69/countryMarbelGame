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
  
  // Strict round control
  const roundCompletedRef = useRef(false);

  // Refs for callbacks to prevent stale closures in Matter.js loop
  const onRoundWinRef = useRef(onRoundWin);
  const onEliminationRef = useRef(onElimination);

  useEffect(() => {
    onRoundWinRef.current = onRoundWin;
  }, [onRoundWin]);

  useEffect(() => {
    onEliminationRef.current = onElimination;
  }, [onElimination]);
  
  // Track scene dimensions for responsiveness
  const sceneState = useRef({
    width: 0,
    height: 0,
    cx: 0,
    cy: 0,
    radius: 0,
    rotation: 0
  });

  // Cache images to prevent flickering
  const imagesRef = useRef<Map<string, HTMLImageElement>>(new Map());

  // Helper to load images
  useEffect(() => {
    countries.forEach(country => {
      const img = new Image();
      img.src = `https://flagcdn.com/w80/${country.code}.png`;
      imagesRef.current.set(country.id, img);
    });
  }, [countries]);

  // Audio Context Setup
  useEffect(() => {
    const AudioContext = window.AudioContext || (window as any).webkitAudioContext;
    if (AudioContext) {
      const ctx = new AudioContext();
      audioCtxRef.current = ctx;
      
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

  // Handle Pause State
  useEffect(() => {
    if (runnerRef.current) {
        runnerRef.current.enabled = !isPaused;
    }
  }, [isPaused]);

  const playCollisionSound = (impact: number) => {
    // 1. Safety Checks
    if (!audioCtxRef.current || isPaused || !soundEnabled) return;
    const ctx = audioCtxRef.current;
    
    // 2. Threshold: Ignore tiny rolling contacts to avoid noise spam
    // Must be a distinct hit
    if (impact < 1.5) return; 

    // 3. Volume Scaling: Soft sound, rarely getting too loud
    // Impact usually ranges 0-20. 
    const vol = Math.min(Math.max(impact / 60, 0.02), 0.2);
    
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.connect(gain);
    gain.connect(ctx.destination);

    // 4. Sound Character: Marble/Wood block pop
    // 600Hz - 900Hz base frequency
    const freq = 600 + Math.random() * 300; 
    
    osc.type = 'sine'; // Sine is best for glass/marble sounds
    osc.frequency.setValueAtTime(freq, ctx.currentTime);
    // Minimal pitch bend for "thud" feel
    osc.frequency.exponentialRampToValueAtTime(freq * 0.8, ctx.currentTime + 0.05);

    // 5. Envelope: Instant attack, short decay
    const now = ctx.currentTime;
    gain.gain.setValueAtTime(0, now);
    gain.gain.linearRampToValueAtTime(vol, now + 0.002);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.06); // 60ms total duration

    osc.start(now);
    osc.stop(now + 0.07);
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

    gain.gain.setValueAtTime(0.15, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.4);

    osc.start(ctx.currentTime);
    osc.stop(ctx.currentTime + 0.45);
  };

  useEffect(() => {
    if (!containerRef.current || !canvasRef.current) return;

    const engine = Matter.Engine.create();
    engine.gravity.y = 0.8; // Standard gravity
    engineRef.current = engine;

    const runner = Matter.Runner.create();
    runner.enabled = !isPaused;
    runnerRef.current = runner;

    // Enhanced Collision Handling
    Matter.Events.on(engine, 'collisionStart', (event) => {
        const pairs = event.pairs;
        pairs.forEach((pair) => {
            const bodyA = pair.bodyA;
            const bodyB = pair.bodyB;
            
            // Ball-to-Ball Collisions
            if (bodyA.label.startsWith('ball-') && bodyB.label.startsWith('ball-')) {
                const velocityA = bodyA.velocity;
                const velocityB = bodyB.velocity;
                const relativeVelocity = Matter.Vector.sub(velocityA, velocityB);
                const speed = Matter.Vector.magnitude(relativeVelocity);
                
                playCollisionSound(speed);

                // STRICT REQUIREMENT: Impulse on every collision to prevent sticking and ensure bounce
                const positionA = bodyA.position;
                const positionB = bodyB.position;

                // Vector from A to B
                const diff = Matter.Vector.sub(positionB, positionA);
                const normal = Matter.Vector.normalise(diff);

                // Apply a small force to push them apart
                // This ensures they always "jump" off each other
                const forceMagnitude = 0.012; 

                Matter.Body.applyForce(bodyA, positionA, Matter.Vector.mult(normal, -forceMagnitude));
                Matter.Body.applyForce(bodyB, positionB, Matter.Vector.mult(normal, forceMagnitude));
            }
        });
    });

    const createArena = (cx: number, cy: number, radius: number, angle: number) => {
      const wallThickness = 20;
      const segments = 60;
      const parts: Matter.Body[] = [];

      const gapSizeRad = (GAME_CONFIG.GAP_SIZE_DEGREES * Math.PI) / 180;
      const step = (2 * Math.PI) / segments;

      for (let a = 0; a < 2 * Math.PI; a += step) {
        const x = cx + radius * Math.cos(a);
        const y = cy + radius * Math.sin(a);
        const rot = a;

        const isGap = a < gapSizeRad;

        const wall = Matter.Bodies.rectangle(x, y, 40, wallThickness, {
          isStatic: false, 
          angle: rot + Math.PI / 2,
          render: { visible: !isGap },
          isSensor: isGap,
          collisionFilter: isGap ? { mask: 0 } : undefined,
          friction: 0,       // Zero friction for walls
          restitution: 1.2,  // Extra bouncy walls
          density: 1
        });
        parts.push(wall);
      }

      const arena = Matter.Body.create({
        parts: parts,
        isStatic: true,
        label: 'Arena',
        friction: 0,
        restitution: 1.2 // Extra bouncy arena
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

      // Center exactly
      const cx = width / 2;
      const cy = height / 2;

      const headerClearance = 160;
      const minDimension = Math.min(width, height - headerClearance * 0.5);
      const radius = Math.max(60, (minDimension / 2) - 20);

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
      
      // Background
      const grad = ctx.createRadialGradient(width/2, height/2, 100, width/2, height/2, Math.max(width, height));
      grad.addColorStop(0, '#1e293b');
      grad.addColorStop(1, '#0f172a');
      ctx.fillStyle = grad;
      ctx.fillRect(0,0, width, height);

      const bodies = Matter.Composite.allBodies(engine.world);

      bodies.forEach(body => {
        if (body.label === 'Arena') {
          ctx.fillStyle = '#64748b';
          body.parts.forEach(part => {
            if(part.id === body.id) return; 
            if(part.render.visible === false) return;
            ctx.save();
            ctx.translate(part.position.x, part.position.y);
            ctx.rotate(part.angle);
            ctx.fillRect(-20, -10, 40, 20);
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
               // Scale image to fit circle better
               const scale = (radius * 2.5) / img.width;
               const w = img.width * scale;
               const h = img.height * scale;
               ctx.drawImage(img, -w/2, -h/2, w, h);
            } else {
               ctx.fillStyle = '#fff';
               ctx.fill();
            }

            // Shine/Gloss
            ctx.beginPath();
            ctx.arc(-radius*0.3, -radius*0.3, radius*0.4, 0, Math.PI*2);
            ctx.fillStyle = 'rgba(255,255,255,0.2)';
            ctx.fill();

            // Border
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

        const bodies = Matter.Composite.allBodies(engine.world);
        const balls = bodies.filter(b => b.label.startsWith('ball-'));
        const activeBallIds: string[] = [];
        let eliminationHappened = false;

        const { width, height } = sceneState.current;
        const buffer = 150;
        const MAX_SPEED = 15; // Moderate speed cap to control the high energy

        balls.forEach(ball => {
            // Cap Velocity
            if (ball.speed > MAX_SPEED) {
                Matter.Body.setVelocity(ball, Matter.Vector.mult(Matter.Vector.normalise(ball.velocity), MAX_SPEED));
            }
            
            // Minimal speed check - if it's too slow, nudge it (failsafe)
            if (ball.speed < 0.5) {
                Matter.Body.applyForce(ball, ball.position, {
                    x: (Math.random() - 0.5) * 0.001,
                    y: -0.001 // Nudge up
                });
            }

            if (ball.position.y > height + buffer || 
                ball.position.x < -buffer || 
                ball.position.x > width + buffer) {
                
                playEliminationSound();
                Matter.World.remove(engine.world, ball);
                eliminationHappened = true;
            } else {
                activeBallIds.push(ball.label.replace('ball-', ''));
            }
        });

        if (eliminationHappened) {
            onEliminationRef.current(activeBallIds);
        }

        // STRICT ROUND WINNER LOGIC
        // 1. Check if round is already locked/completed to prevent duplicates
        if (!roundCompletedRef.current) {
            // 2. Winner triggered ONLY when exactly ONE ball remains active
            if (activeBallIds.length === 1) {
                const winnerId = activeBallIds[0];
                if (winnerId) {
                    roundCompletedRef.current = true; // Lock the round
                    onRoundWinRef.current(winnerId);
                }
            }
        }
    });

    return () => {
      window.removeEventListener('resize', handleResize);
      if (renderLoopRef.current) cancelAnimationFrame(renderLoopRef.current);
      if (engineRef.current) Matter.Events.off(engineRef.current, 'beforeUpdate', gameLogicEvents);
      if (engineRef.current) Matter.Events.off(engineRef.current, 'collisionStart', undefined);
      if (runnerRef.current) Matter.Runner.stop(runnerRef.current);
      if (engineRef.current) Matter.Engine.clear(engineRef.current);
    };
  }, [soundEnabled]); 

  // Handle Round Restarts
  useEffect(() => {
     if (!engineRef.current || !containerRef.current) return;

     // 1. Reset round completion flag for the new round
     roundCompletedRef.current = false;

     const allBodies = Matter.Composite.allBodies(engineRef.current.world);
     const balls = allBodies.filter(b => b.label.startsWith('ball-'));
     balls.forEach(b => Matter.World.remove(engineRef.current!.world, b));

     const newBalls: Matter.Body[] = [];
     
     const { cx, cy, radius } = sceneState.current;
     const spawnRadius = Math.max(20, radius * 0.6); 
     
     const eligibleCountries = countries.filter(c => !c.isChampion);

     eligibleCountries.forEach((country) => {
        const angle = Math.random() * Math.PI * 2;
        const r = Math.random() * spawnRadius;
        const x = cx + r * Math.cos(angle);
        const y = cy + r * Math.sin(angle);

        const ball = Matter.Bodies.circle(x, y, GAME_CONFIG.BALL_SIZE, {
            restitution: 1.2, // Very Bouncy
            friction: 0,      // Zero Friction
            frictionAir: 0.0005, // Minimal Air Resistance
            frictionStatic: 0,
            density: 0.04,
            slop: 0, // Prevent sticking overlap
            label: `ball-${country.id}`,
            // Ensure bodies don't sleep
            sleepThreshold: -1 
        });
        
        // Give initial random velocity
        Matter.Body.setVelocity(ball, {
            x: (Math.random() - 0.5) * 8,
            y: (Math.random() - 0.5) * 8
        });

        newBalls.push(ball);
     });

     Matter.World.add(engineRef.current.world, newBalls);
     onEliminationRef.current(eligibleCountries.map(c => c.id));

  }, [triggerRestart, countries]);


  return (
    <div ref={containerRef} className="absolute inset-0 w-full h-full overflow-hidden z-0">
      <canvas ref={canvasRef} className="block w-full h-full" />
    </div>
  );
};

export default GameCanvas;