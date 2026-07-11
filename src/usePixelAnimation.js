import { useRef, useCallback } from 'react';

export function usePixelAnimation() {
  const canvasRef = useRef(null);
  const animationsRef = useRef([]);
  const animationFrameRef = useRef(null);
  const effectIndexRef = useRef(0);

  const triggerCaptureAnimation = useCallback((square, onComplete, customType = null) => {
    if (!canvasRef.current) {
      if (onComplete) onComplete();
      return;
    }
    const canvas = canvasRef.current;
    const boardEl = canvas.parentElement;
    if (!boardEl) {
      if (onComplete) onComplete();
      return;
    }

    const squareEl = boardEl.querySelector(`[data-square="${square}"]`);
    if (!squareEl) {
      if (onComplete) onComplete();
      return;
    }

    const boardRect = boardEl.getBoundingClientRect();
    const squareRect = squareEl.getBoundingClientRect();

    const x = squareRect.left - boardRect.left + squareRect.width / 2;
    const y = squareRect.top - boardRect.top + squareRect.height / 2;
    const size = squareRect.width;

    // Tinanggal ang 'cage' sa listahan ng mga random/cycle effect
    const effectTypes = [
      'thunder', 'sandworm', 'frozen_eyes', 'fire', 'missile', 
      'blackhole', 'bubble', 'ufo', 'sniper', 
      'swordslash', 'hand_grab', 'arrow_rain',
      'anvil', 'bat_swarm', 'nuclear_bomb', 'plasma_surge'
    ];
    
    let chosenEffect = customType;
    if (!chosenEffect) {
      chosenEffect = effectTypes[effectIndexRef.current];
      effectIndexRef.current = (effectIndexRef.current + 1) % effectTypes.length;
    }

    createEffect(chosenEffect, x, y, size, onComplete);
    return chosenEffect;
  }, []);

  // Hiwalay na function para sa kulungan ng hari para madaling ma-trigger nang pambukod
  const triggerKingCageAnimation = useCallback((square, onComplete) => {
    if (!canvasRef.current) {
      if (onComplete) onComplete();
      return;
    }
    const canvas = canvasRef.current;
    const boardEl = canvas.parentElement;
    if (!boardEl) {
      if (onComplete) onComplete();
      return;
    }

    const squareEl = boardEl.querySelector(`[data-square="${square}"]`);
    if (!squareEl) {
      if (onComplete) onComplete();
      return;
    }

    const boardRect = boardEl.getBoundingClientRect();
    const squareRect = squareEl.getBoundingClientRect();

    const x = squareRect.left - boardRect.left + squareRect.width / 2;
    const y = squareRect.top - boardRect.top + squareRect.height / 2;
    const size = squareRect.width;

    createEffect('cage', x, y, size, onComplete);
    return 'cage';
  }, []);

  function createEffect(type, x, y, size, onComplete) {
    const particles = [];
    let duration = 50; 

    if (type === 'fire') {
      duration = 60;
      for (let i = 0; i < 90; i++) {
        const angle = Math.random() * Math.PI * 2;
        const speed = Math.random() * 4 + 2;
        particles.push({
          x: x + (Math.random() * size - size / 2) * 0.8,
          y: y + size / 2,
          vx: Math.cos(angle) * speed * 0.4,
          vy: -(Math.random() * 4 + 2),
          size: Math.random() * 8 + 4,
          color: Math.random() > 0.4 ? '#ff3333' : (Math.random() > 0.5 ? '#ffcc00' : '#ff6600'),
          isAsh: false,
          life: 30 + Math.random() * 25
        });
      }
    } else if (type === 'thunder') {
      duration = 45;
      for (let i = 0; i < 70; i++) {
        particles.push({
          x: x + (Math.random() * size - size / 2) * 0.7,
          y: y + (Math.random() * size - size / 2) * 0.7,
          vx: Math.random() * 4 - 2,
          vy: Math.random() * 4 - 2,
          size: Math.random() * 5 + 3,
          color: Math.random() > 0.5 ? '#00ffff' : '#ffffff',
          life: 20 + Math.random() * 20,
          delay: 10
        });
      }
    } else if (type === 'frozen_eyes') {
      duration = 65; 
      for (let i = 0; i < 60; i++) {
        const angle = Math.random() * Math.PI * 2;
        const speed = Math.random() * 5 + 2;
        particles.push({
          x: x + (Math.random() * size - size / 2) * 0.5,
          y: y + (Math.random() * size - size / 2) * 0.5,
          vx: Math.cos(angle) * speed,
          vy: Math.sin(angle) * speed,
          size: Math.random() * 6 + 2,
          color: Math.random() > 0.4 ? '#a5f3fc' : '#38bdf8',
          life: 25 + Math.random() * 20
        });
      }
    } else if (type === 'blackhole') {
      duration = 70;
      for (let i = 0; i < 90; i++) {
        const angle = Math.random() * Math.PI * 2;
        const distance = Math.random() * (size * 1.5) + size * 0.3;
        particles.push({
          angle: angle,
          distance: distance,
          speed: Math.random() * 0.07 + 0.04,
          radialSpeed: Math.random() * 2 + 1.5,
          size: Math.random() * 5 + 2,
          color: Math.random() > 0.6 ? '#a855f7' : (Math.random() > 0.3 ? '#6366f1' : '#000000'),
          life: 45 + Math.random() * 20
        });
      }
    } else if (type === 'sandworm') {
      duration = 50;
      for (let i = 0; i < 50; i++) {
        particles.push({
          x: x,
          y: y + size / 2,
          vx: Math.random() * 6 - 3,
          vy: -(Math.random() * 6 + 3),
          size: Math.random() * 5 + 2,
          color: Math.random() > 0.5 ? '#d2b48c' : '#c2a278',
          life: 25 + Math.random() * 20
        });
      }
    } else if (type === 'missile') {
      duration = 50;
      particles.push({
        type: 'projectile',
        x: x,
        y: 0,
        targetY: y,
        vy: 16,
        size: 10,
        color: '#9ca3af',
        life: Math.floor(y / 16)
      });
    } else if (type === 'bubble') {
      duration = 75;
      particles.push({
        type: 'main_bubble',
        x: x,
        y: y,
        radius: size * 0.4,
        vy: -2,
        color: 'rgba(56, 189, 248, 0.6)',
        life: 55
      });
      for (let i = 0; i < 15; i++) {
        particles.push({
          type: 'ambient_sparkle',
          x: x + (Math.random() * 20 - 10),
          y: y + (Math.random() * 20 - 10),
          vx: Math.random() * 1 - 0.5,
          vy: -(Math.random() * 1.5 + 1),
          size: Math.random() * 4 + 2,
          color: '#bae6fd',
          life: 30 + Math.random() * 25
        });
      }
    } else if (type === 'ufo') {
      duration = 85; 
      particles.push({
        type: 'spaceship',
        x: x,
        y: -40,
        targetY: y - size * 0.9,
        speedY: 4,
        scale: 1.0,
        ufoState: 'descending', 
        pieceScale: 1.0,
        pieceY: y,
        life: 85
      });
    } else if (type === 'sniper') {
      duration = 75; 
      particles.push({
        type: 'reticle',
        x: x,
        y: y,
        currentRadius: size * 2,
        targetRadius: size * 0.25,
        isLocked: false,
        flashFrame: 0,
        pieceY: y,
        pieceX: x,
        pieceJumpY: 0,
        pieceRotation: 0,
        pieceState: 'idle', 
        life: 75
      });
    } else if (type === 'cage') {
      // Ginawang mas matagal ang duration (o permanenteng naka-display habang active) para permanenteng makulong ang hari
      duration = 999999;
      particles.push({
        type: 'cage_iron',
        x: x,
        y: y - size * 3,
        targetY: y,
        vy: 14,
        size: size,
        life: 999999,
        landed: false
      });
    } else if (type === 'swordslash') {
      duration = 45;
      particles.push({
        type: 'slash_line',
        x: x,
        y: y,
        life: 15
      });
    } else if (type === 'hand_grab') {
      duration = 60;
      particles.push({
        type: 'giant_hand',
        x: x,
        y: y + size * 2, 
        targetY: y,
        pieceY: y,
        state: 'rising', 
        size: size,
        life: 60
      });
    } else if (type === 'arrow_rain') {
      duration = 80;
      for (let i = 0; i < 30; i++) {
        particles.push({
          type: 'arrow',
          x: x + (Math.random() * size * 1.5 - size * 0.75),
          y: -Math.random() * 150 - 20,
          targetY: y + (Math.random() * size * 0.5 - size * 0.25),
          vy: 12 + Math.random() * 4,
          vx: 2, 
          size: Math.random() * 4 + 2,
          life: 40,
          landed: false
        });
      }
    } else if (type === 'anvil') {
      duration = 70;
      particles.push({
        type: 'falling_anvil',
        x: x,
        y: -50,
        targetY: y,
        vy: 15,
        size: size,
        landed: false,
        life: 70
      });
    } else if (type === 'bat_swarm') {
      duration = 75;
      for (let i = 0; i < 18; i++) {
        particles.push({
          type: 'bat',
          x: x + (Math.random() * size - size / 2),
          y: y + size / 2,
          vx: Math.random() * 6 - 3,
          vy: -(Math.random() * 4 + 3),
          wingWave: Math.random() * Math.PI,
          size: Math.random() * 6 + 6,
          life: 45 + Math.random() * 30
        });
      }
    } else if (type === 'nuclear_bomb') {
      duration = 90;
      particles.push({
        type: 'nuke_core',
        x: x,
        y: y,
        radius: 2,
        maxRadius: size * 2.5,
        opacity: 1.0,
        stage: 'expansion',
        life: 90
      });
    } else if (type === 'plasma_surge') {
      duration = 60;
      for (let i = 0; i < 40; i++) {
        const angle = Math.random() * Math.PI * 2;
        particles.push({
          type: 'plasma_orb',
          angle: angle,
          orbitRadius: size * 1.2,
          speed: 0.1 + Math.random() * 0.05,
          size: Math.random() * 5 + 4,
          color: Math.random() > 0.5 ? '#d946ef' : '#a855f7',
          life: 60
        });
      }
    }

    animationsRef.current.push({ type, x, y, size, particles, currentFrame: 0, maxFrames: duration, onComplete });

    if (!animationFrameRef.current) {
      animationFrameRef.current = requestAnimationFrame(updateAndRender);
    }
  }

  function updateAndRender() {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    let activeAnimations = [];

    animationsRef.current.forEach((anim) => {
      anim.currentFrame++;

      if (anim.type === 'fire') {
        anim.particles.forEach((p) => {
          p.x += p.vx;
          p.y += p.vy;
          p.life--;

          if (p.life < 22 && !p.isAsh) {
            p.isAsh = true;
            p.color = Math.random() > 0.5 ? '#262626' : '#404040';
            p.vy = Math.random() * 0.8 - 0.2;
            p.vx = Math.random() * 1 - 0.5;
          }

          ctx.fillStyle = p.color;
          ctx.fillRect(Math.floor(p.x - p.size / 2), Math.floor(p.y - p.size / 2), p.size, p.size);
        });
        anim.particles = anim.particles.filter(p => p.life > 0);

      } else if (anim.type === 'thunder') {
        if (anim.currentFrame <= 14) {
          ctx.strokeStyle = anim.currentFrame % 3 === 0 ? '#ffffff' : (anim.currentFrame % 3 === 1 ? '#00ffff' : '#38bdf8');
          ctx.lineWidth = 10;
          
          for (let strike = 0; strike < 2; strike++) {
            ctx.beginPath();
            let curX = anim.x + (strike * 16 - 8) + (Math.random() * 20 - 10);
            let curY = 0;
            ctx.moveTo(curX, curY);

            while (curY < anim.y) {
              curX += (Math.random() * 60 - 30);
              curY += (Math.random() * 30 + 20);
              ctx.lineTo(curX, curY);
            }
            ctx.lineTo(anim.x, anim.y);
            ctx.stroke();
          }

          ctx.fillStyle = '#ffffff';
          ctx.fillRect(anim.x - anim.size, anim.y - 6, anim.size * 2, 12);
        }

        anim.particles.forEach((p) => {
          if (anim.currentFrame > p.delay) {
            p.x += p.vx;
            p.y += p.vy;
            p.life--;
            ctx.fillStyle = p.color;
            ctx.fillRect(Math.floor(p.x), Math.floor(p.y), p.size, p.size);
          }
        });
        anim.particles = anim.particles.filter(p => p.life > 0 || anim.currentFrame <= p.delay);

      } else if (anim.type === 'frozen_eyes') {
        const freezeTimeline = anim.currentFrame;
        
        if (freezeTimeline < 35) {
          ctx.fillStyle = 'rgba(165, 243, 252, 0.75)';
          ctx.strokeStyle = '#0284c7';
          ctx.lineWidth = 4;
          const iceBoxSize = anim.size * 0.85;
          ctx.fillRect(anim.x - iceBoxSize/2, anim.y - iceBoxSize/2, iceBoxSize, iceBoxSize);
          ctx.strokeRect(anim.x - iceBoxSize/2, anim.y - iceBoxSize/2, iceBoxSize, iceBoxSize);

          ctx.fillStyle = '#06b6d4';
          ctx.fillRect(Math.floor(anim.x - 18), Math.floor(anim.y - 6), 10, 6);
          ctx.fillRect(Math.floor(anim.x + 8), Math.floor(anim.y - 6), 10, 6);
        } else if (freezeTimeline >= 35 && freezeTimeline < 45) {
          const iceBoxSize = anim.size * 0.85;
          ctx.fillStyle = 'rgba(165, 243, 252, 0.75)';
          ctx.fillRect(anim.x - iceBoxSize/2, anim.y - iceBoxSize/2, iceBoxSize, iceBoxSize);
          
          ctx.strokeStyle = '#ffffff';
          ctx.lineWidth = 3;
          ctx.beginPath();
          ctx.moveTo(anim.x - iceBoxSize/2, anim.y - iceBoxSize/2);
          ctx.lineTo(anim.x + 5, anim.y + 2);
          ctx.lineTo(anim.x - 10, anim.y + iceBoxSize/2);
          ctx.moveTo(anim.x + iceBoxSize/2, anim.y - 10);
          ctx.lineTo(anim.x - 5, anim.y + 2);
          ctx.stroke();
        } else if (freezeTimeline === 45) {
          for (let k = 0; k < 50; k++) {
            const angle = Math.random() * Math.PI * 2;
            const speed = Math.random() * 6 + 3;
            anim.particles.push({
              x: anim.x,
              y: anim.y,
              vx: Math.cos(angle) * speed,
              vy: Math.sin(angle) * speed - 1,
              size: Math.random() * 6 + 3,
              color: Math.random() > 0.5 ? '#e0f2fe' : '#7dd3fc',
              life: 20 + Math.random() * 15
            });
          }
        }

        anim.particles.forEach((p) => {
          p.x += p.vx;
          p.y += p.vy;
          p.vy += 0.1;
          p.life--;
          ctx.fillStyle = p.color;
          ctx.fillRect(Math.floor(p.x - p.size/2), Math.floor(p.y - p.size/2), p.size, p.size);
        });
        anim.particles = anim.particles.filter(p => p.life > 0);

      } else if (anim.type === 'blackhole') {
        const expansionProgress = anim.currentFrame / anim.maxFrames;
        let coreRadius = anim.size * 0.65;
        if (expansionProgress > 0.7) {
          coreRadius = anim.size * 0.65 * (1 - (expansionProgress - 0.7) / 0.3);
        }

        ctx.fillStyle = '#000000';
        ctx.strokeStyle = '#4f46e5';
        ctx.lineWidth = 6;
        ctx.beginPath();
        ctx.arc(anim.x, anim.y, Math.max(2, coreRadius), 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();

        anim.particles.forEach((p) => {
          p.angle += p.speed * 1.5;
          p.distance -= p.radialSpeed * 1.2;

          const pX = anim.x + Math.cos(p.angle) * p.distance;
          const pY = anim.y + Math.sin(p.angle) * p.distance;
          p.life--;

          ctx.fillStyle = p.color;
          ctx.fillRect(Math.floor(pX - p.size / 2), Math.floor(pY - p.size / 2), p.size, p.size);
        });
        anim.particles = anim.particles.filter(p => p.life > 0 && p.distance > 1);

      } else if (anim.type === 'sandworm') {
        const frame = anim.currentFrame;
        let wormYOffset = 0;
        if (frame < 20) wormYOffset = (20 - frame) * 2.5;
        else if (frame >= 20 && frame < 35) wormYOffset = 0;
        else wormYOffset = (frame - 35) * 3.5;

        const wormY = anim.y + wormYOffset;
        if (frame < 42) {
          ctx.fillStyle = '#5c4033';
          ctx.fillRect(Math.floor(anim.x - 28), Math.floor(wormY - 12), 56, 45);
          ctx.fillStyle = '#ff3333';
          ctx.fillRect(Math.floor(anim.x - 14), Math.floor(wormY - 12), 28, 6);
        }

        anim.particles.forEach((p) => {
          p.x += p.vx;
          p.y += p.vy;
          p.vy += 0.2;
          p.life--;
          ctx.fillStyle = p.color;
          ctx.fillRect(Math.floor(p.x), Math.floor(p.y), p.size, p.size);
        });
        anim.particles = anim.particles.filter(p => p.life > 0);

      } else if (anim.type === 'missile') {
        anim.particles.forEach((p) => {
          if (p.type === 'projectile') {
            p.y += p.vy;
            ctx.fillStyle = p.color;
            ctx.fillRect(p.x - p.size/2, p.y - p.size, p.size, p.size * 1.5);

            if (p.y >= p.targetY) {
              p.life = 0;
              for(let k=0; k<55; k++) {
                const a = Math.random() * Math.PI * 2;
                const s = Math.random() * 7 + 3;
                anim.particles.push({
                  x: p.x,
                  y: p.targetY,
                  vx: Math.cos(a) * s,
                  vy: Math.sin(a) * s,
                  size: Math.random() * 7 + 3,
                  color: Math.random() > 0.4 ? '#ef4444' : '#f97316',
                  life: 20 + Math.random() * 15
                });
              }
            }
          } else {
            p.x += p.vx;
            p.y += p.vy;
            p.life--;
            ctx.fillStyle = p.color;
            ctx.fillRect(Math.floor(p.x), Math.floor(p.y), p.size, p.size);
          }
        });
        anim.particles = anim.particles.filter(p => p.life > 0);

      } else if (anim.type === 'bubble') {
        anim.particles.forEach((p) => {
          if (p.type === 'main_bubble') {
            p.y += p.vy;
            p.life--;

            if (p.life > 10) {
              ctx.fillStyle = p.color;
              ctx.strokeStyle = '#0ea5e9';
              ctx.lineWidth = 3;
              ctx.beginPath();
              ctx.arc(p.x, p.y, p.radius, 0, Math.PI * 2);
              ctx.fill();
              ctx.stroke();

              ctx.fillStyle = '#ffffff';
              ctx.fillRect(p.x - p.radius * 0.4, p.y - p.radius * 0.4, 6, 6);
            } else if (p.life === 10) {
              for (let b = 0; b < 30; b++) {
                const angle = Math.random() * Math.PI * 2;
                const speed = Math.random() * 4 + 1;
                anim.particles.push({
                  type: 'burst_shard',
                  x: p.x,
                  y: p.y,
                  vx: Math.cos(angle) * speed,
                  vy: Math.sin(angle) * speed,
                  size: Math.random() * 4 + 2,
                  color: '#e0f2fe',
                  life: 12 + Math.random() * 8
                });
              }
            }
          } else {
            p.x += p.vx;
            p.y += p.vy;
            p.life--;
            ctx.fillStyle = p.color;
            ctx.fillRect(Math.floor(p.x), Math.floor(p.y), p.size, p.size);
          }
        });
        anim.particles = anim.particles.filter(p => p.life > 0);

      } else if (anim.type === 'ufo') {
        let ship = anim.particles.find(p => p.type === 'spaceship');
        if (ship) {
          const frame = anim.currentFrame;
          ship.life--;

          if (ship.ufoState === 'descending') {
            if (ship.y < ship.targetY) {
              ship.y += ship.speedY;
            } else {
              ship.ufoState = 'abducting';
            }
          } else if (ship.ufoState === 'abducting') {
            if (ship.pieceScale > 0.05) {
              ship.pieceScale -= 0.045; 
              ship.pieceY -= (ship.pieceY - (ship.y + 12)) * 0.15; 
            } else {
              ship.ufoState = 'escaping';
            }
          } else if (ship.ufoState === 'escaping') {
            ship.y -= 10;
            ship.x += 2;
            if (ship.scale > 0.1) ship.scale -= 0.04;
          }

          if (ship.ufoState === 'descending' || ship.ufoState === 'abducting') {
            ctx.fillStyle = 'rgba(34, 197, 94, 0.35)';
            ctx.beginPath();
            ctx.moveTo(ship.x - 12 * ship.scale, ship.y + 10 * ship.scale);
            ctx.lineTo(ship.x + 12 * ship.scale, ship.y + 10 * ship.scale);
            ctx.lineTo(anim.x + anim.size * 0.55, anim.y + anim.size / 2);
            ctx.lineTo(anim.x - anim.size * 0.55, anim.y + anim.size / 2);
            ctx.fill();

            if (frame % 6 < 3) {
              ctx.strokeStyle = '#4ade80';
              ctx.lineWidth = 2;
              ctx.strokeRect(anim.x - (anim.size * 0.35) * ship.pieceScale, ship.pieceY - 4, (anim.size * 0.7) * ship.pieceScale, 3);
            }
          }

          if (ship.ufoState !== 'escaping' && ship.pieceScale > 0.08) {
            ctx.save();
            ctx.translate(anim.x, ship.pieceY);
            ctx.scale(ship.pieceScale, ship.pieceScale);
            ctx.fillStyle = frame % 4 === 0 ? '#4ade80' : 'rgba(224, 242, 254, 0.8)';
            ctx.fillRect(-anim.size * 0.35, -anim.size * 0.4, anim.size * 0.7, anim.size * 0.8);
            ctx.restore();
          }

          ctx.save();
          ctx.translate(ship.x, ship.y);
          ctx.scale(ship.scale, ship.scale);

          ctx.fillStyle = '#9ca3af';
          ctx.fillRect(-24, 0, 48, 10);
          ctx.fillStyle = '#374151';
          ctx.fillRect(-14, -6, 28, 6);

          ctx.fillStyle = frame % 6 < 3 ? '#ef4444' : '#eab308';
          ctx.fillRect(-18, 6, 4, 4);
          ctx.fillRect(0, 6, 4, 4);
          ctx.fillRect(14, 6, 4, 4);

          ctx.restore();

          if (ship.life <= 0) {
            anim.particles = [];
          }
        }

      } else if (anim.type === 'sniper') {
        let reticle = anim.particles.find(p => p.type === 'reticle');
        if (reticle) {
          reticle.life--;
          const frame = anim.currentFrame;

          if (reticle.currentRadius > reticle.targetRadius) {
            reticle.currentRadius -= (reticle.currentRadius - reticle.targetRadius) * 0.15;
          } else {
            reticle.isLocked = true;
          }

          if (!reticle.isLocked) {
            ctx.strokeStyle = '#ef4444';
            ctx.lineWidth = 3;
            ctx.beginPath();
            ctx.arc(reticle.x, reticle.y, reticle.currentRadius, 0, Math.PI * 2);
            ctx.stroke();
          } else {
            reticle.flashFrame++;

            if (reticle.flashFrame < 18) {
              ctx.strokeStyle = Math.floor(reticle.flashFrame / 3) % 2 === 0 ? '#ff0000' : 'transparent';
              ctx.lineWidth = 3;
              
              ctx.beginPath();
              ctx.arc(reticle.x, reticle.y, reticle.targetRadius, 0, Math.PI * 2);
              ctx.moveTo(reticle.x - reticle.targetRadius - 12, reticle.y);
              ctx.lineTo(reticle.x + reticle.targetRadius + 12, reticle.y);
              ctx.moveTo(reticle.x, reticle.y - reticle.targetRadius - 12);
              ctx.lineTo(reticle.x, reticle.y + reticle.targetRadius + 12);
              ctx.stroke();

            } else if (reticle.flashFrame === 18) {
              reticle.pieceState = 'shot';
              ctx.fillStyle = '#ffffff';
              ctx.fillRect(0, 0, canvas.width, canvas.height); 

              for (let s = 0; s < 50; s++) {
                const a = Math.random() * Math.PI * 2;
                const sp = Math.random() * 8 + 3;
                anim.particles.push({
                  type: 'bullet_smoke',
                  x: reticle.x,
                  y: reticle.y,
                  vx: Math.cos(a) * sp,
                  vy: Math.sin(a) * sp - (Math.random() * 2), 
                  size: Math.random() * 7 + 4,
                  color: Math.random() > 0.4 ? '#6b7280' : '#4b5563',
                  life: 18 + Math.random() * 15
                });
              }
            }
          }

          if (reticle.pieceState === 'idle') {
            ctx.fillStyle = 'rgba(239, 68, 68, 0.15)';
            ctx.fillRect(reticle.pieceX - anim.size / 2, reticle.pieceY - anim.size / 2, anim.size, anim.size);
          } else if (reticle.pieceState === 'shot') {
            const shotProgress = reticle.flashFrame - 18; 
            const jumpVelocity = -5; 
            const gravity = 0.6;
            reticle.pieceJumpY = (jumpVelocity * shotProgress) + (0.5 * gravity * shotProgress * shotProgress);
            reticle.pieceRotation = Math.min(Math.PI / 2, shotProgress * 0.22);
            reticle.pieceX += 3.5; 

            if (reticle.pieceY + reticle.pieceJumpY < canvas.height + 40) {
              ctx.save();
              ctx.translate(reticle.pieceX, reticle.pieceY + reticle.pieceJumpY);
              ctx.rotate(reticle.pieceRotation);
              ctx.fillStyle = '#ef4444'; 
              ctx.strokeStyle = '#ffffff';
              ctx.lineWidth = 2;
              ctx.fillRect(-anim.size * 0.4, -anim.size * 0.4, anim.size * 0.8, anim.size * 0.8);
              ctx.strokeRect(-anim.size * 0.4, -anim.size * 0.4, anim.size * 0.8, anim.size * 0.8);
              ctx.restore();
            }
          }

          anim.particles.forEach((p) => {
            if (p.type === 'bullet_smoke') {
              p.x += p.vx;
              p.y += p.vy;
              p.life--;
              ctx.fillStyle = p.color;
              ctx.fillRect(Math.floor(p.x - p.size/2), Math.floor(p.y - p.size/2), p.size, p.size);
            }
          });
          anim.particles = anim.particles.filter(p => p.type !== 'bullet_smoke' || p.life > 0);

          if (reticle.life <= 0) anim.particles = [];
        }

      } else if (anim.type === 'cage') {
        let cage = anim.particles.find(p => p.type === 'cage_iron');
        if (cage) {
          cage.life--;
          
          if (!cage.landed) {
            cage.y += cage.vy;
            if (cage.y >= cage.targetY) {
              cage.y = cage.targetY;
              cage.landed = true;
              
              for (let d = 0; d < 25; d++) {
                anim.particles.push({
                  type: 'cage_dust',
                  x: cage.x + (Math.random() * cage.size - cage.size / 2),
                  y: cage.targetY + cage.size / 2,
                  vx: Math.random() * 6 - 3,
                  vy: -(Math.random() * 4 + 1),
                  size: Math.random() * 4 + 2,
                  color: Math.random() > 0.5 ? '#94a3b8' : '#64748b',
                  life: 15 + Math.random() * 12
                });
              }
            }
          }

          ctx.strokeStyle = '#475569';
          ctx.lineWidth = 4;
          const halfSize = cage.size / 2;
          
          ctx.strokeRect(cage.x - halfSize, cage.y - halfSize, cage.size, cage.size);
          
          const columnsCount = 5;
          for (let c = 1; c < columnsCount; c++) {
            const barX = cage.x - halfSize + (cage.size / columnsCount) * c;
            ctx.beginPath();
            ctx.moveTo(barX, cage.y - halfSize);
            ctx.lineTo(barX, cage.y + halfSize);
            ctx.stroke();
          }

          ctx.fillStyle = '#94a3b8';
          ctx.fillRect(cage.x - 10, cage.y - halfSize - 6, 20, 6);
        }

        anim.particles.forEach((p) => {
          if (p.type === 'cage_dust') {
            p.x += p.vx;
            p.y += p.vy;
            p.life--;
            ctx.fillStyle = p.color;
            ctx.fillRect(Math.floor(p.x), Math.floor(p.y), p.size, p.size);
          }
        });
        // Ginawang permanenteng active habang naglalaro sa pamamagitan ng hindi pag-filter base sa life kung ito ay cage
        anim.particles = anim.particles.filter(p => p.type !== 'cage_dust' || p.life > 0);

      } else if (anim.type === 'swordslash') {
        let slash = anim.particles.find(p => p.type === 'slash_line');
        if (anim.currentFrame === 2) {
          for (let b = 0; b < 45; b++) {
            const angle = Math.random() * Math.PI * 2;
            const speed = Math.random() * 6 + 2;
            anim.particles.push({
              type: 'blood_splatter',
              x: anim.x,
              y: anim.y,
              vx: Math.cos(angle) * speed,
              vy: Math.sin(angle) * speed + 1,
              size: Math.random() * 5 + 2,
              color: Math.random() > 0.2 ? '#be123c' : '#9f1239',
              life: 20 + Math.random() * 15
            });
          }
        }

        if (slash && slash.life > 0) {
          slash.life--;
          ctx.strokeStyle = '#ffffff';
          ctx.shadowColor = '#f43f5e';
          ctx.shadowBlur = 10;
          ctx.lineWidth = 6;
          ctx.beginPath();
          ctx.moveTo(anim.x - anim.size, anim.y - anim.size * 0.5);
          ctx.lineTo(anim.x + anim.size, anim.y + anim.size * 0.5);
          ctx.stroke();
          ctx.shadowBlur = 0; 
        }

        anim.particles.forEach((p) => {
          if (p.type === 'blood_splatter') {
            p.x += p.vx;
            p.y += p.vy;
            p.vy += 0.15; 
            p.life--;
            ctx.fillStyle = p.color;
            ctx.fillRect(Math.floor(p.x), Math.floor(p.y), p.size, p.size);
          }
        });
        anim.particles = anim.particles.filter(p => p.life > 0);

      } else if (anim.type === 'hand_grab') {
        let hand = anim.particles.find(p => p.type === 'giant_hand');
        if (hand) {
          hand.life--;
          
          if (hand.state === 'rising') {
            hand.y -= 8;
            if (hand.y <= hand.targetY) {
              hand.y = hand.targetY;
              hand.state = 'grabbing';
            }
          } else if (hand.state === 'grabbing') {
            if (anim.currentFrame > 35) {
              hand.state = 'retreating';
            }
          } else if (hand.state === 'retreating') {
            hand.y += 10;
            hand.pieceY += 10; 
          }

          if (hand.state !== 'retreating' || hand.y < canvas.height) {
            ctx.fillStyle = 'rgba(239, 68, 68, 0.7)';
            ctx.fillRect(anim.x - anim.size * 0.35, hand.pieceY - anim.size * 0.4, anim.size * 0.7, anim.size * 0.8);
          }

          ctx.fillStyle = '#15803d'; 
          ctx.strokeStyle = '#14532d';
          ctx.lineWidth = 2;
          ctx.fillRect(hand.x - 16, hand.y, 32, 40);
          ctx.strokeRect(hand.x - 16, hand.y, 32, 40);

          ctx.fillStyle = '#22c55e';
          ctx.fillRect(hand.x - 14, hand.y - 12, 6, 12); 
          ctx.fillRect(hand.x - 5, hand.y - 16, 6, 16);  
          ctx.fillRect(hand.x + 4, hand.y - 12, 6, 12);  
        }

      } else if (anim.type === 'arrow_rain') {
        anim.particles.forEach((p) => {
          if (p.type === 'arrow') {
            if (!p.landed) {
              p.x += p.vx;
              p.y += p.vy;
              
              if (p.y >= p.targetY) {
                p.y = p.targetY;
                p.landed = true;
                p.life = 25; 
              }
            } else {
              p.life--;
            }

            ctx.strokeStyle = p.landed ? '#94a3b8' : '#e2e8f0';
            ctx.lineWidth = 2;
            ctx.beginPath();
            ctx.moveTo(p.x, p.y);
            ctx.lineTo(p.x - 6, p.y - 12);
            ctx.stroke();

            ctx.fillStyle = '#64748b';
            ctx.fillRect(p.x - 2, p.y - 2, 4, 4);
          }
        });
        anim.particles = anim.particles.filter(p => p.life > 0);
      } else if (anim.type === 'anvil') {
        let anvil = anim.particles.find(p => p.type === 'falling_anvil');
        if (anvil) {
          anvil.life--;
          if (!anvil.landed) {
            anvil.y += anvil.vy;
            if (anvil.y >= anvil.targetY) {
              anvil.y = anvil.targetY;
              anvil.landed = true;
              for (let d = 0; d < 30; d++) {
                anim.particles.push({
                  type: 'anvil_spark',
                  x: anvil.x,
                  y: anvil.targetY + 8,
                  vx: Math.random() * 8 - 4,
                  vy: -(Math.random() * 5 + 2),
                  size: Math.random() * 4 + 2,
                  color: Math.random() > 0.4 ? '#e2e8f0' : '#f59e0b',
                  life: 15 + Math.random() * 15
                });
              }
            }
          }

          ctx.save();
          ctx.translate(anvil.x, anvil.y);
          ctx.fillStyle = '#334155';
          ctx.strokeStyle = '#1e293b';
          ctx.lineWidth = 2;
          
          ctx.fillRect(-22, -14, 44, 8);
          ctx.fillRect(-14, -6, 28, 12);
          ctx.fillRect(-26, 6, 52, 10);
          ctx.beginPath();
          ctx.moveTo(-22, -14);
          ctx.lineTo(-34, -14);
          ctx.lineTo(-22, -6);
          ctx.fill();

          ctx.restore();
        }

        anim.particles.forEach((p) => {
          if (p.type === 'anvil_spark') {
            p.x += p.vx;
            p.y += p.vy;
            p.vy += 0.2; 
            p.life--;
            ctx.fillStyle = p.color;
            ctx.fillRect(Math.floor(p.x), Math.floor(p.y), p.size, p.size);
          }
        });
        anim.particles = anim.particles.filter(p => p.type !== 'anvil_spark' || p.life > 0);

      } else if (anim.type === 'bat_swarm') {
        anim.particles.forEach((p) => {
          if (p.type === 'bat') {
            p.x += p.vx;
            p.y += p.vy;
            p.wingWave += 0.35;
            p.life--;

            ctx.fillStyle = '#1e1b4b';
            const wingY = Math.sin(p.wingWave) * p.size * 0.6;
            
            ctx.beginPath();
            ctx.fillRect(p.x - 3, p.y - 3, 6, 6);
            ctx.moveTo(p.x - 3, p.y);
            ctx.lineTo(p.x - p.size, p.y - wingY);
            ctx.lineTo(p.x - 2, p.y + 2);
            ctx.moveTo(p.x + 3, p.y);
            ctx.lineTo(p.x + p.size, p.y - wingY);
            ctx.lineTo(p.x + 2, p.y + 2);
            ctx.fill();
          }
        });
        anim.particles = anim.particles.filter(p => p.life > 0);

      } else if (anim.type === 'nuclear_bomb') {
        let nuke = anim.particles.find(p => p.type === 'nuke_core');
        if (nuke) {
          nuke.life--;
          
          if (nuke.stage === 'expansion') {
            nuke.radius += (nuke.maxRadius - nuke.radius) * 0.12;
            if (nuke.radius >= nuke.maxRadius * 0.95) {
              nuke.stage = 'shockwave';
            }
            ctx.fillStyle = `rgba(253, 224, 71, ${nuke.opacity})`;
            ctx.beginPath();
            ctx.arc(nuke.x, nuke.y, nuke.radius, 0, Math.PI * 2);
            ctx.fill();
          } else {
            nuke.opacity -= 0.025;
            ctx.strokeStyle = `rgba(239, 68, 68, ${nuke.opacity})`;
            ctx.lineWidth = 6;
            ctx.beginPath();
            ctx.arc(nuke.x, nuke.y, nuke.radius * 1.2, 0, Math.PI * 2);
            ctx.stroke();
          }
          
          if (anim.currentFrame % 2 === 0 && nuke.opacity > 0.1) {
            for(let i=0; i<3; i++) {
              const a = Math.random() * Math.PI * 2;
              const d = Math.random() * nuke.radius;
              ctx.fillStyle = '#ffffff';
              ctx.fillRect(nuke.x + Math.cos(a)*d, nuke.y + Math.sin(a)*d, 4, 4);
            }
          }
        }
        if (anim.currentFrame >= anim.maxFrames) anim.particles = [];

      } else if (anim.type === 'plasma_surge') {
        ctx.strokeStyle = 'rgba(192, 38, 211, 0.4)';
        ctx.lineWidth = 4;
        ctx.beginPath();
        ctx.arc(anim.x, anim.y, anim.size * 0.6, 0, Math.PI * 2);
        ctx.stroke();

        anim.particles.forEach((p) => {
          if (p.type === 'plasma_orb') {
            p.angle += p.speed;
            p.orbitRadius -= 0.6;
            if (p.orbitRadius < 2) p.orbitRadius = 2;
            p.life--;

            const pX = anim.x + Math.cos(p.angle) * p.orbitRadius;
            const pY = anim.y + Math.sin(p.angle) * p.orbitRadius;

            ctx.fillStyle = p.color;
            ctx.fillRect(Math.floor(pX - p.size / 2), Math.floor(pY - p.size / 2), p.size, p.size);
            
            if (Math.random() > 0.88) {
              ctx.strokeStyle = '#ffffff';
              ctx.lineWidth = 1;
              ctx.beginPath();
              ctx.moveTo(pX, pY);
              ctx.lineTo(anim.x + (Math.random() * 10 - 5), anim.y + (Math.random() * 10 - 5));
              ctx.stroke();
            }
          }
        });
        anim.particles = anim.particles.filter(p => p.life > 0);
      }

      // Para sa kulungan, hahayaan nating mag-stay ang animation nang tuloy-tuloy habang hindi pa natatapos ang lifecycle ng cage
      if (anim.type === 'cage' || anim.currentFrame < anim.maxFrames) {
        activeAnimations.push(anim);
      } else {
        anim.particles = []; 
        if (anim.onComplete) {
          anim.onComplete();
        }
      }
    });

    animationsRef.current = activeAnimations;

    if (animationsRef.current.length > 0) {
      animationFrameRef.current = requestAnimationFrame(updateAndRender);
    } else {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      animationFrameRef.current = null;
    }
  }

  // I-expose din ang triggerKingCageAnimation kasama ng canvasRef at triggerCaptureAnimation
  return { canvasRef, triggerCaptureAnimation, triggerKingCageAnimation };
}