import React, { useRef, useEffect, useState } from 'react';
import { GameState, Entity, Particle } from '../types';
import { PALETTE, GAME_WIDTH, GAME_HEIGHT, SPRITES } from '../constants';
import { audioService } from '../services/audioService';

interface GameEngineProps {
  gameState: GameState;
  setGameState: (state: GameState) => void;
  onExplore: () => void;
  scrollPercent: number; // 0 to 100
  onStatueClick: () => void; // New callback
}

const GameEngine: React.FC<GameEngineProps> = ({ gameState, setGameState, onExplore, scrollPercent, onStatueClick }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const requestRef = useRef<number>();
  const frameCountRef = useRef<number>(0);
  
  // Game State Refs
  const cameraY = useRef<number>(0);
  const particles = useRef<Particle[]>([]);
  const transitionAlpha = useRef<number>(0);
  const transitionTarget = useRef<GameState>(GameState.CITY_EXPLORATION); // Track where we are transitioning to
  const entities = useRef<Entity[]>([]);
  const hoveredEntityRef = useRef<string | null>(null); // Track hovered entity ID
  
  // Use a ref for scrollPercent to access it inside the animation loop without dependencies
  const scrollTargetRef = useRef<number>(0);

  useEffect(() => {
    scrollTargetRef.current = scrollPercent;
  }, [scrollPercent]);
  
  // Initialize City Data
  useEffect(() => {
    if (gameState === GameState.CITY_EXPLORATION) {
      initCity();
      // Initialize camera based on scrollPercent to prevent jump if returning from Ziggurat
      cameraY.current = (scrollPercent / 100) * -220;
    } else if (gameState === GameState.ZIGGURAT_INSIDE) {
      initZigguratInterior();
      cameraY.current = 0;
    }
  }, [gameState]); // Dependency on gameState ensures this runs only on state switch

  const initCity = () => {
    const newEntities: Entity[] = [];
    
    // City Dimensions (Fortress Box)
    // Adjusted slightly to align with 20px grid
    const wallNorthY = -200; 
    const wallSouthY = 50;   
    const wallWestX = 60;    
    const wallEastX = 260;   
    const riverGateY = -80;  

    // 1. Add Corner Towers (To hide wall joints and make it neat)
    const corners = [
        { x: wallWestX, y: wallNorthY }, // TL
        { x: wallEastX, y: wallNorthY }, // TR
        { x: wallWestX, y: wallSouthY }, // BL
        { x: wallEastX, y: wallSouthY }  // BR
    ];

    corners.forEach(corner => {
        newEntities.push({
            id: `tower-${corner.x}-${corner.y}`,
            type: 'BUILDING',
            x: corner.x,
            y: corner.y,
            width: 20,
            height: 35, // Taller than walls
            variant: 'TOWER'
        });
    });

    // 2. Add Ziggurat
    newEntities.push({
      id: 'ziggurat',
      type: 'ZIGGURAT',
      x: (wallWestX + wallEastX) / 2 - 30, 
      y: wallNorthY + 40,
      width: 60,
      height: 45,
    });

    // 3. Generate Connecting Walls
    // Walls now run *between* the towers, not overlapping past them.

    // Vertical Walls (West & East)
    // Start below North Tower, End above South Tower
    for (let y = wallSouthY - 20; y > wallNorthY; y -= 20) {
        // East Wall
        newEntities.push({
            id: `wall-east-${y}`,
            type: 'BUILDING',
            x: wallEastX + 2, // Shift slightly right to align center with tower
            y: y,
            width: 16,
            height: 25,
            variant: 'WALL_V'
        });

        // West Wall (Has River Gate)
        if (Math.abs(y - riverGateY) > 20) {
             newEntities.push({
                id: `wall-west-${y}`,
                type: 'BUILDING',
                x: wallWestX + 2,
                y: y,
                width: 16,
                height: 25,
                variant: 'WALL_V'
            });
        } 
        // Removed gate-path-river (the dock)
    }

    // Horizontal Walls (North & South)
    // Start right of West Tower, End left of East Tower
    for (let x = wallWestX + 20; x < wallEastX; x += 20) {
        // North Wall
        newEntities.push({
            id: `wall-north-${x}`,
            type: 'BUILDING',
            x: x,
            y: wallNorthY,
            width: 22,
            height: 25,
            variant: 'WALL_H'
        });

        // South Wall (Front wall with Main Gate)
        // Leave a big gap in the middle for the road (approx 130 to 190)
        if (x < 130 || x > 190) {
             newEntities.push({
                id: `wall-south-${x}`,
                type: 'BUILDING',
                x: x,
                y: wallSouthY,
                width: 22,
                height: 25,
                variant: 'WALL_H'
            });
        }
    }

    // 4. Add River Boats
    for(let i = 0; i < 3; i++) {
      newEntities.push({
        id: `boat-${i}`,
        type: 'BOAT',
        x: 10 + Math.random() * 25,
        y: -Math.random() * 200,
        width: 12,
        height: 6,
        speed: 0.1 + Math.random() * 0.2
      });
    }

    // 5. Add Buildings & Stalls
    for (let y = wallSouthY - 40; y > wallNorthY + 80; y -= 45) {
       // Left side houses
       if (Math.abs(y - riverGateY) > 25) {
           newEntities.push({
             id: `house-left-${y}`,
             type: 'BUILDING',
             x: wallWestX + 25,
             y: y,
             width: 30,
             height: 35,
             variant: Math.random() > 0.85 ? 'LEADER' : 'NORMAL'
           });
       } else {
           // Internal path to river gate
           newEntities.push({
               id: `path-gate-inner-${y}`,
               type: 'DECOR',
               x: wallWestX + 10,
               y: y - 15,
               width: 50,
               height: 10,
               variant: 'GATE_PATH'
           });
       }

       // Right side market
       newEntities.push({
         id: `market-right-${y}`,
         type: 'DECOR', 
         x: wallEastX - 35,
         y: y + 15,
         width: 20,
         height: 15,
       });

       // Merchants
       newEntities.push({
         id: `merchant-${y}`,
         type: 'NPC',
         x: wallEastX - 30,
         y: y + 20,
         width: 8,
         height: 8,
         variant: 'MERCHANT',
         color: PALETTE.RIVER_DEEP
       });
       
       // Decorative trees - Right Side (Market)
       if (Math.random() > 0.3) {
           newEntities.push({
               id: `tree-decor-right-${y}`,
               type: 'DECOR',
               x: wallEastX - 15,
               y: y - 10,
               width: 10,
               height: 10,
               variant: 'TREE'
           });
       }

       // Decorative trees - Left Side (Near Houses)
       if (Math.random() > 0.4) {
           newEntities.push({
               id: `tree-decor-left-${y}`,
               type: 'DECOR',
               x: wallWestX + 55, // Between houses and road
               y: y + 25,
               width: 10,
               height: 10,
               variant: 'TREE'
           });
       }
    }

    // NEW: Trees around Ziggurat Base (Plaza)
    for(let i=0; i<5; i++) {
        // Left of stairs
        newEntities.push({
            id: `tree-zig-l-${i}`,
            type: 'DECOR',
            x: wallWestX + 30 + Math.random() * 30,
            y: wallNorthY + 70 + Math.random() * 20,
            width: 10,
            height: 10,
            variant: 'TREE'
        });
        // Right of stairs
        newEntities.push({
            id: `tree-zig-r-${i}`,
            type: 'DECOR',
            x: wallEastX - 40 - Math.random() * 30,
            y: wallNorthY + 70 + Math.random() * 20,
            width: 10,
            height: 10,
            variant: 'TREE'
        });
    }

    // Priests
    for(let i=0; i<3; i++) {
        newEntities.push({
            id: `priest-${i}`,
            type: 'NPC',
            x: GAME_WIDTH/2 - 20 + i * 15,
            y: wallNorthY + 80,
            width: 8,
            height: 8,
            variant: 'PRIEST',
            speed: (Math.random() - 0.5) * 0.15
        });
    }

    entities.current = newEntities;
  };

  const initZigguratInterior = () => {
      const newEntities: Entity[] = [];
      const cx = GAME_WIDTH / 2;
      const cy = GAME_HEIGHT / 2;

      // The Dragon Statue (Horizontal)
      // Sprite is 24x24, scale 2 = 48x48.
      newEntities.push({
          id: 'dragon-statue',
          type: 'STATUE',
          x: cx - 24, // Centered
          y: cy - 20, 
          width: 48, 
          height: 48 
      });

      // Banners
      // Left
      newEntities.push({
          id: 'banner-left',
          type: 'BANNER',
          x: cx - 70,
          y: cy - 60,
          width: 24,
          height: 36,
          variant: 'DRAGON_FLAG'
      });
      // Right
      newEntities.push({
          id: 'banner-right',
          type: 'BANNER',
          x: cx + 46,
          y: cy - 60,
          width: 24,
          height: 36,
          variant: 'DRAGON_FLAG'
      });
      
      // Priests inside
      newEntities.push({
          id: 'priest-inside-1',
          type: 'NPC',
          x: cx - 40,
          y: cy + 40,
          width: 8, height: 8,
          variant: 'PRIEST'
      });
      newEntities.push({
          id: 'priest-inside-2',
          type: 'NPC',
          x: cx + 32,
          y: cy + 40,
          width: 8, height: 8,
          variant: 'PRIEST'
      });

      entities.current = newEntities;
  };

  // Generic Sprite Drawer
  const drawSprite = (ctx: CanvasRenderingContext2D, sprite: number[][], x: number, y: number, colorMap: Record<number, string>, scale: number = 1) => {
    sprite.forEach((row, rI) => {
        row.forEach((pixel, cI) => {
            if (pixel !== 0 && colorMap[pixel]) {
                ctx.fillStyle = colorMap[pixel];
                ctx.fillRect(Math.floor(x + cI * scale), Math.floor(y + rI * scale), scale, scale);
            }
        });
    });
  };

  // Draw ground noise/texture
  const drawGroundTexture = (ctx: CanvasRenderingContext2D, width: number, height: number, offsetX: number = 0, offsetY: number = 0) => {
      ctx.fillStyle = PALETTE.SAND_DARK;
      // Pseudo-random noise based on position
      for(let y = 0; y < height; y += 4) {
          for(let x = 0; x < width; x += 4) {
             // Simple deterministic noise
             if (((x + offsetX) * 123 + (y + offsetY) * 456) % 23 > 18) {
                 ctx.fillRect(x, y, 2, 2);
             }
          }
      }
  };

  const drawMap = (ctx: CanvasRenderingContext2D, time: number) => {
    // 1. Background
    ctx.fillStyle = PALETTE.SAND;
    ctx.fillRect(0, 0, GAME_WIDTH, GAME_HEIGHT);
    drawGroundTexture(ctx, GAME_WIDTH, GAME_HEIGHT);

    // 2. Mountains (Top Right) - Using Sprites
    const mountainPalette = { 1: PALETTE.MUD_BRICK_DARK, 2: PALETTE.MUD_BRICK };
    for(let i=0; i<6; i++) {
        const mx = 200 + i * 18;
        const my = 30 + (i%2)*8;
        drawSprite(ctx, SPRITES.MOUNTAIN, mx, my, mountainPalette, 2);
    }

    // 3. Rivers (Blocky Pixel Art style)
    ctx.fillStyle = PALETTE.RIVER_BLUE;
    const riverStep = 10;
    // Main River
    for(let y=0; y < GAME_HEIGHT; y+=riverStep) {
        // Meander slightly
        const x = 110 + Math.sin(y * 0.05) * 10;
        ctx.fillRect(Math.floor(x), y, 25, riverStep);
    }
    // Tributary
    for(let x=120; x < GAME_WIDTH; x+=riverStep) {
        const y = 100 + Math.sin(x * 0.05) * 10;
        ctx.fillRect(x, Math.floor(y), riverStep, 15);
    }

    // 4. Palm Trees scattered
    const treePalette = { 1: PALETTE.GREEN, 2: PALETTE.MUD_BRICK_DARK };
    const treePositions = [[40, 50], [80, 150], [160, 150], [250, 100], [20, 200]];
    treePositions.forEach(([tx, ty]) => {
        drawSprite(ctx, SPRITES.PALM_TREE, tx, ty, treePalette, 2);
    });

    // 5. City Marker: Enlathien - Using Sprite
    const cityX = 135;
    const cityY = 85;
    
    // Flashing selector box
    if (Math.floor(time / 500) % 2 === 0) {
        ctx.strokeStyle = PALETTE.RED_BANNER;
        ctx.lineWidth = 2;
        ctx.strokeRect(cityX - 5, cityY - 5, 28, 26);
    }

    drawSprite(ctx, SPRITES.CITY_ICON, cityX, cityY, {
        1: PALETTE.MUD_BRICK,
        2: PALETTE.ROOF,
        3: PALETTE.BLACK // windows
    }, 2);
    
    // Label
    ctx.fillStyle = PALETTE.TEXT_BG;
    ctx.fillRect(cityX + 25, cityY - 5, 90, 14);
    ctx.fillStyle = PALETTE.TEXT_FG;
    ctx.font = '10px monospace';
    ctx.fillText("Enlathien", cityX + 28, cityY + 5);

    // Cursor (Hand) - Simple rects for now, but animated
    const cursorYOffset = Math.sin(time / 200) * 3;
    const cursorX = cityX + 8;
    const cursorY = cityY - 20 + cursorYOffset;
    
    ctx.fillStyle = PALETTE.WHITE;
    // Finger pointing down shape
    ctx.fillRect(cursorX, cursorY, 6, 8); // palm
    ctx.fillRect(cursorX + 2, cursorY + 8, 2, 4); // finger
    ctx.fillStyle = PALETTE.RED_BANNER; // sleeve
    ctx.fillRect(cursorX - 1, cursorY - 4, 8, 4);
  };

  const drawCity = (ctx: CanvasRenderingContext2D, time: number) => {
    // Manual Scroll Logic
    // Map scroll percent (0-100) to camera range 
    // Target Y: -200 (North wall)
    const targetY = (scrollTargetRef.current / 100) * -220;
    
    // Smooth ease-to
    cameraY.current += (targetY - cameraY.current) * 0.1;

    const camY = Math.floor(cameraY.current);

    // 1. Background
    ctx.fillStyle = PALETTE.SAND;
    ctx.fillRect(0, 0, GAME_WIDTH, GAME_HEIGHT);
    drawGroundTexture(ctx, GAME_WIDTH, GAME_HEIGHT, 0, camY);

    // 2. River (Left Side - Wider)
    const riverWidth = 50; 
    ctx.fillStyle = PALETTE.RIVER_BLUE;
    ctx.fillRect(0, 0, riverWidth, GAME_HEIGHT);
    
    // Animated edge
    ctx.fillStyle = PALETTE.RIVER_DEEP;
    for(let y=0; y<GAME_HEIGHT; y+=5) {
        if ((y + Math.floor(time/100)) % 10 < 5) {
            ctx.fillRect(riverWidth - 5, y, 5, 5);
        }
    }
    
    // River sparkles
    ctx.fillStyle = PALETTE.WHITE;
    for(let i=0; i<8; i++) {
        const ry = ((time / 50) + i * 50) % GAME_HEIGHT;
        const rx = 10 + Math.sin(i * 132) * 50;
        if (rx < riverWidth - 5) {
             ctx.fillRect(rx, ry, 2, 2);
        }
    }

    // 3. Main Road (Centered between walls)
    const roadX = 75;
    const roadW = 185;
    ctx.fillStyle = PALETTE.SAND_DARK;
    // Dithering for road distinction
    for(let y=0; y<GAME_HEIGHT; y+=2) {
        if (y % 4 === 0) ctx.fillRect(roadX, y, roadW, 1);
    }
    
    // 4. Entities
    entities.current.sort((a, b) => a.y - b.y);

    entities.current.forEach(entity => {
        const screenY = Math.floor(entity.y - camY + GAME_HEIGHT / 2);
        
        // Culling
        if (screenY < -100 || screenY > GAME_HEIGHT + 100) return;

        // Animate NPCs
        let bounce = 0;
        let dirScale = 1;
        if (entity.type === 'NPC' && entity.speed) {
            entity.x += entity.speed;
            // Constrain NPCs within walls (approx 75 to 245)
            if (entity.x > 245 || entity.x < 75) entity.speed *= -1;
            bounce = Math.floor(Math.abs(Math.sin(time / 150)) * 2);
            dirScale = entity.speed > 0 ? -1 : 1; // Flip sprite if walking right
        }

        if (entity.type === 'BOAT') {
            entity.y += entity.speed || 0.1;
            if (entity.y - camY > GAME_HEIGHT/2 + 200) entity.y -= 300; 
        }

        // Draw Entity
        if (entity.type === 'ZIGGURAT') {
            const w = entity.width; 
            const h = entity.height; 
            const step = h / 3; 
            
            // Base (Level 1 - Bottom)
            ctx.fillStyle = PALETTE.MUD_BRICK_DARK;
            ctx.fillRect(entity.x, screenY - step, w, step);
            
            // Level 2 (Middle)
            ctx.fillStyle = PALETTE.MUD_BRICK;
            ctx.fillRect(entity.x + 8, screenY - step * 2, w - 16, step);
            
            // Level 3 (Top)
            ctx.fillStyle = PALETTE.MUD_BRICK_DARK;
            ctx.fillRect(entity.x + 16, screenY - step * 3, w - 32, step);
            
            // Stairs
            ctx.fillStyle = PALETTE.SAND; 
            // Draw stairs going up the center
            ctx.fillRect(entity.x + w/2 - 5, screenY - h, 10, h);
            
            // Interaction Feedback
            const isHovered = hoveredEntityRef.current === 'ziggurat';
            
            // Glowing Top
            if (Math.floor(time / 200) % 2 === 0 || isHovered) {
                 ctx.fillStyle = PALETTE.GOLD;
                 ctx.fillRect(entity.x + w/2 - 3, screenY - h - 5, 6, 6);
            }
            
            // Selection Highlight (Temple Body)
            if (isHovered) {
                ctx.strokeStyle = PALETTE.WHITE;
                ctx.lineWidth = 2;
                ctx.strokeRect(entity.x - 2, screenY - h - 2, w + 4, h + 4);
            }

            // Sign
             const signW = 100;
             const signH = 15;
             const signX = entity.x + w/2 - signW/2;
             const signY = screenY - h - 25;
             
             ctx.fillStyle = isHovered ? PALETTE.BLACK : PALETTE.TEXT_BG;
             ctx.fillRect(signX, signY, signW, signH);
             
             if (isHovered) {
                 ctx.strokeStyle = PALETTE.GOLD;
                 ctx.lineWidth = 1;
                 ctx.strokeRect(signX, signY, signW, signH);
             }

             ctx.fillStyle = isHovered ? PALETTE.GOLD : PALETTE.TEXT_FG;
             ctx.font = '10px monospace';
             ctx.textAlign = 'center';
             ctx.fillText("Great Ziggurat", signX + signW/2, signY + 11);
             ctx.textAlign = 'left';

             // Instructions
             if (isHovered || (scrollTargetRef.current > 90 && Math.floor(time / 800) % 2 === 0)) {
                 ctx.fillStyle = PALETTE.WHITE;
                 ctx.font = '10px monospace';
                 ctx.textAlign = 'center';
                 ctx.fillText(isHovered ? "▶ CLICK TO ENTER ◀" : "[ CLICK TO ENTER ]", entity.x + w/2, screenY - h - 35);
                 ctx.textAlign = 'left';
             }

        } else if (entity.type === 'BUILDING') {
            if (entity.variant === 'TOWER') {
                // Corner Tower - more distinct
                ctx.fillStyle = PALETTE.MUD_BRICK_DARK;
                // Main Block
                ctx.fillRect(entity.x, screenY - entity.height, entity.width, entity.height);
                
                // Top Detail (Battlement)
                ctx.fillStyle = PALETTE.MUD_BRICK;
                ctx.fillRect(entity.x - 2, screenY - entity.height, entity.width + 4, 8);
                
                // Crenellations on tower
                ctx.fillStyle = PALETTE.MUD_BRICK_DARK;
                ctx.fillRect(entity.x, screenY - entity.height, 4, 4);
                ctx.fillRect(entity.x + 8, screenY - entity.height, 4, 4);
                ctx.fillRect(entity.x + 16, screenY - entity.height, 4, 4);

                // Window slot
                ctx.fillStyle = PALETTE.BLACK;
                ctx.fillRect(entity.x + 8, screenY - entity.height + 15, 4, 8);

            } else if (entity.variant === 'WALL_V') {
                // Vertical Wall Segment
                ctx.fillStyle = PALETTE.MUD_BRICK_DARK;
                ctx.fillRect(entity.x, screenY - entity.height, entity.width, entity.height);
                
                // Crenellations
                ctx.fillStyle = PALETTE.MUD_BRICK;
                ctx.fillRect(entity.x, screenY - entity.height, 4, 4);
                ctx.fillRect(entity.x + 8, screenY - entity.height, 4, 4);
                
                // Highlight
                ctx.fillStyle = PALETTE.MUD_BRICK;
                ctx.fillRect(entity.x + 2, screenY - entity.height + 4, entity.width - 4, entity.height - 4);

            } else if (entity.variant === 'WALL_H') {
                // Horizontal Wall Segment
                ctx.fillStyle = PALETTE.MUD_BRICK_DARK;
                ctx.fillRect(entity.x, screenY - entity.height, entity.width, entity.height);
                
                // Flat top with occasional darker spots for texture
                ctx.fillStyle = PALETTE.MUD_BRICK;
                ctx.fillRect(entity.x, screenY - entity.height, entity.width, 4); // Top edge
                
                // Main body
                ctx.fillRect(entity.x + 1, screenY - entity.height + 4, entity.width - 2, entity.height - 4);
                
            } else {
                // Normal House
                ctx.fillStyle = PALETTE.MUD_BRICK;
                ctx.fillRect(entity.x, screenY - entity.height, entity.width, entity.height);
                // Texture bricks
                ctx.fillStyle = PALETTE.MUD_BRICK_DARK;
                ctx.fillRect(entity.x, screenY - entity.height, 2, entity.height); // Outline left
                ctx.fillRect(entity.x + entity.width - 2, screenY - entity.height, 2, entity.height); // Outline right
                
                // Door
                ctx.fillStyle = PALETTE.BLACK;
                ctx.fillRect(entity.x + entity.width/2 - 6, screenY - 18, 12, 18);
                
                // Awning or roof
                if (entity.variant === 'LEADER') {
                    // Banners
                    ctx.fillStyle = PALETTE.RED_BANNER;
                    ctx.fillRect(entity.x + 2, screenY - entity.height + 4, 6, 12);
                    ctx.fillStyle = PALETTE.YELLOW_BANNER;
                    ctx.fillRect(entity.x + entity.width - 8, screenY - entity.height + 4, 6, 12);
                } else {
                     ctx.fillStyle = PALETTE.ROOF;
                     ctx.fillRect(entity.x - 2, screenY - entity.height - 2, entity.width + 4, 6);
                }
            }

        } else if (entity.type === 'DECOR') {
             if (entity.variant === 'TREE') {
                 drawSprite(ctx, SPRITES.PALM_TREE, entity.x, screenY - 10, {1: PALETTE.GREEN, 2: PALETTE.MUD_BRICK_DARK}, 1);
             } else if (entity.variant === 'GATE_PATH') {
                 // Path leading to river
                 ctx.fillStyle = PALETTE.SAND_DARK;
                 ctx.fillRect(entity.x, screenY, entity.width, 2);
                 ctx.fillRect(entity.x, screenY + 4, entity.width, 2);
             } else {
                 // Market stall
                 drawSprite(ctx, SPRITES.MARKET_STALL, entity.x, screenY - 10, {
                     1: PALETTE.MUD_BRICK_DARK,
                     2: PALETTE.RED_BANNER,
                     3: PALETTE.SAND
                 }, 2);
             }
        } else if (entity.type === 'BOAT') {
             drawSprite(ctx, SPRITES.BOAT, entity.x, screenY, {
                 1: PALETTE.MUD_BRICK_DARK,
                 2: PALETTE.RIVER_DEEP
             }, 1.5);
        } else if (entity.type === 'NPC') {
            const sprite = entity.variant === 'PRIEST' ? SPRITES.NPC_PRIEST : (entity.variant === 'MERCHANT' ? SPRITES.NPC_FARMER : SPRITES.PLAYER);
            const palette = {
                1: entity.variant === 'PRIEST' ? PALETTE.WHITE : (entity.variant === 'MERCHANT' ? PALETTE.RIVER_DEEP : PALETTE.GREEN),
                2: PALETTE.MUD_BRICK, // Skin
                3: PALETTE.MUD_BRICK_DARK, // Hair
            };
            
            // Flip context if needed
            ctx.save();
            if (dirScale === -1) {
                ctx.translate(entity.x + 8, 0);
                ctx.scale(-1, 1);
                drawSprite(ctx, sprite, 0, screenY - 12 - bounce, palette, 1.5);
            } else {
                drawSprite(ctx, sprite, entity.x, screenY - 12 - bounce, palette, 1.5);
            }
            ctx.restore();
        }
    });

    // Foreground Particles (Sparkles near Ziggurat)
    if (cameraY.current < -100) { // Adjusted trigger point
        if (Math.random() > 0.85) {
            particles.current.push({
                x: GAME_WIDTH / 2 - 30 + Math.random() * 60,
                y: -180 - camY + GAME_HEIGHT/2 - 40 + Math.random() * 30, // Adjusted Y source
                life: 1.0,
                color: Math.random() > 0.5 ? PALETTE.GOLD : PALETTE.WHITE,
                vx: (Math.random() - 0.5) * 0.5,
                vy: -Math.random() * 1.0
            });
        }
    }
  };

  const drawZigguratInterior = (ctx: CanvasRenderingContext2D, time: number) => {
      // 1. Background (Indoor Stone)
      ctx.fillStyle = '#2c2520'; // Dark interior
      ctx.fillRect(0,0, GAME_WIDTH, GAME_HEIGHT);
      
      // Floor (Checkerboard perspective)
      for(let y = 120; y < GAME_HEIGHT; y+=10) {
          for (let x = 0; x < GAME_WIDTH; x+=20) {
              if ((x+y)%40 === 0) {
                  ctx.fillStyle = '#3d342b';
                  ctx.fillRect(x, y, 20, 10);
              }
          }
      }

      // Helper for stone texture
      const drawStoneTexture = (px: number, py: number, w: number, h: number) => {
          for(let i=0; i < 40; i++) {
              const tx = Math.floor(Math.random() * w);
              const ty = Math.floor(Math.random() * h);
              // Use lighter stone specs for contrast
              ctx.fillStyle = Math.random() > 0.5 ? PALETTE.STONE_LIGHT : PALETTE.STONE_DARK;
              ctx.fillRect(px + tx, py + ty, 2, 2);
          }
      };

      // 2. Two Large Pillars (Gray Stone)
      const pillarColor = PALETTE.STONE_MID; // Mid gray stone (Lighter than background)
      const pillarHighlight = PALETTE.STONE_LIGHT; // Lightest stone for highlights
      const pillarWidth = 55; // Wider
      
      // Left Pillar
      ctx.fillStyle = pillarColor;
      ctx.fillRect(10, 10, pillarWidth, GAME_HEIGHT - 10);
      drawStoneTexture(10, 10, pillarWidth, GAME_HEIGHT - 10);
      
      // Detail/Highlight lines
      ctx.fillStyle = pillarHighlight;
      ctx.fillRect(15, 10, 8, GAME_HEIGHT - 10);
      ctx.fillRect(50, 10, 4, GAME_HEIGHT - 10);
      // Capital/Base
      ctx.fillStyle = PALETTE.BLACK;
      ctx.fillRect(5, 10, pillarWidth + 10, 25); // Top
      ctx.fillRect(5, GAME_HEIGHT - 35, pillarWidth + 10, 35); // Bottom

      // Right Pillar
      const rightX = GAME_WIDTH - 10 - pillarWidth;
      ctx.fillStyle = pillarColor;
      ctx.fillRect(rightX, 10, pillarWidth, GAME_HEIGHT - 10);
      drawStoneTexture(rightX, 10, pillarWidth, GAME_HEIGHT - 10);

      // Detail
      ctx.fillStyle = pillarHighlight;
      ctx.fillRect(rightX + 10, 10, 8, GAME_HEIGHT - 10);
      ctx.fillRect(rightX + 40, 10, 4, GAME_HEIGHT - 10);
      // Capital/Base
      ctx.fillStyle = PALETTE.BLACK;
      ctx.fillRect(rightX - 5, 10, pillarWidth + 10, 25); // Top
      ctx.fillRect(rightX - 5, GAME_HEIGHT - 35, pillarWidth + 10, 35); // Bottom

      // 3. Render Entities (Statue & Flags)
      entities.current.forEach(entity => {
          if (entity.type === 'STATUE') {
              // Draw Dragon Sprite with Stone Palette (Gray Scale)
              const isHovered = hoveredEntityRef.current === 'dragon-statue';
              
              drawSprite(ctx, SPRITES.DRAGON_STATUE, entity.x, entity.y, {
                  1: PALETTE.STONE_MID,    // Main Stone Gray
                  2: PALETTE.STONE_DARK,   // Shadow
                  3: PALETTE.STONE_LIGHT   // Highlight
              }, 2); // 2x Scale for massiveness
              
              // Interaction Glow
              if (isHovered) {
                  ctx.strokeStyle = PALETTE.GOLD;
                  ctx.lineWidth = 2;
                  ctx.strokeRect(entity.x - 2, entity.y - 2, entity.width + 4, entity.height + 4);
                  
                  // "Look" hint
                  if (Math.floor(time / 500) % 2 === 0) {
                      ctx.fillStyle = PALETTE.GOLD;
                      ctx.font = '10px monospace';
                      ctx.textAlign = 'center';
                      ctx.fillText("READ", entity.x + entity.width/2, entity.y - 10);
                      ctx.textAlign = 'left';
                  }
              }

          } else if (entity.type === 'BANNER') {
              const bx = entity.x;
              const by = entity.y;
              const bw = entity.width;
              const bh = entity.height;

              // Hanging Pole
              ctx.fillStyle = PALETTE.BLACK;
              ctx.fillRect(bx - 2, by - 2, bw + 4, 2);

              // The Flag: Split Red/Yellow with Black Dragon & Star
              
              // Left Half: Red
              ctx.fillStyle = PALETTE.RED_BANNER;
              ctx.fillRect(bx, by, bw/2, bh);
              
              // Right Half: Yellow
              ctx.fillStyle = PALETTE.YELLOW_BANNER;
              ctx.fillRect(bx + bw/2, by, bw/2, bh);
              
              // Center Symbol: Black Dragon surrounding Black Star
              // We'll use the DRAGON_LOGO sprite, centered.
              // Center of flag:
              const cx = bx + bw/2 - 8; // Sprite is 8x8, scale 2 = 16px wide. 
              const cy = by + bh/2 - 8; 
              
              drawSprite(ctx, SPRITES.DRAGON_LOGO, cx, cy, {
                  1: PALETTE.BLACK
              }, 2);
              
              // Add a small star in the very center pixel (manual override)
              ctx.fillStyle = PALETTE.BLACK;
              // Star shape manually inside the sprite area - Fits in the new "ring" hole
              // Cross shape for star
              const scx = bx + bw/2;
              const scy = by + bh/2;
              // Center dot
              ctx.fillRect(scx, scy, 2, 2);
              // Arms
              ctx.fillRect(scx - 2, scy, 6, 2); // horizontal
              ctx.fillRect(scx, scy - 2, 2, 6); // vertical

          } else if (entity.type === 'NPC') {
              // Priests
              const palette = {
                1: PALETTE.WHITE,
                2: PALETTE.MUD_BRICK, 
                3: PALETTE.MUD_BRICK_DARK
             };
             drawSprite(ctx, SPRITES.NPC_PRIEST, entity.x, entity.y, palette, 1.5);
          }
      });
      
      // Dramatic Lighting overlay
      const gradient = ctx.createRadialGradient(GAME_WIDTH/2, GAME_HEIGHT/2 - 20, 20, GAME_WIDTH/2, GAME_HEIGHT/2, 150);
      gradient.addColorStop(0, 'rgba(214, 214, 214, 0.1)'); // White/Gray Glow from statue
      gradient.addColorStop(1, 'rgba(0,0,0,0.6)'); // Dark corners
      ctx.fillStyle = gradient;
      ctx.fillRect(0,0, GAME_WIDTH, GAME_HEIGHT);

  };

  const drawParticles = (ctx: CanvasRenderingContext2D) => {
    particles.current.forEach((p, index) => {
        ctx.fillStyle = p.color;
        ctx.globalAlpha = p.life;
        ctx.fillRect(Math.floor(p.x), Math.floor(p.y), 2, 2);
        ctx.globalAlpha = 1.0;

        p.x += p.vx;
        p.y += p.vy;
        p.life -= 0.04;

        if (p.life <= 0) particles.current.splice(index, 1);
    });
  };

  const render = (time: number) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Clear
    ctx.clearRect(0, 0, GAME_WIDTH, GAME_HEIGHT);

    if (gameState === GameState.MAP) {
        drawMap(ctx, time);
    } else if (gameState === GameState.TRANSITION) {
        // Contextual background drawing based on where we are going
        if (transitionTarget.current === GameState.CITY_EXPLORATION) {
            drawMap(ctx, time);
        } else if (transitionTarget.current === GameState.ZIGGURAT_INSIDE) {
            drawCity(ctx, time);
        }
        
        transitionAlpha.current += 0.04;
        ctx.fillStyle = `rgba(0,0,0,${transitionAlpha.current})`;
        ctx.fillRect(0, 0, GAME_WIDTH, GAME_HEIGHT);
        
        if (transitionAlpha.current >= 1.2) {
            setGameState(transitionTarget.current);
            transitionAlpha.current = 0;
            if (transitionTarget.current === GameState.CITY_EXPLORATION) onExplore();
        }
    } else if (gameState === GameState.CITY_EXPLORATION) {
        drawCity(ctx, time);
        drawParticles(ctx);
    } else if (gameState === GameState.ZIGGURAT_INSIDE) {
        drawZigguratInterior(ctx, time);
    }

    frameCountRef.current++;
    requestRef.current = requestAnimationFrame(render);
  };

  useEffect(() => {
    requestRef.current = requestAnimationFrame(render);
    return () => {
        if (requestRef.current) cancelAnimationFrame(requestRef.current);
    };
  }, [gameState]);
  
  // Helper to check if mouse is over Ziggurat with dynamic scrolling
  const isMouseOverZiggurat = (mouseX: number, mouseY: number) => {
      const ziggurat = entities.current.find(e => e.id === 'ziggurat');
      if (!ziggurat) return false;
      
      const camY = Math.floor(cameraY.current);
      const screenY = Math.floor(ziggurat.y - camY + GAME_HEIGHT / 2);
      
      const boxX = ziggurat.x - 20; 
      const boxW = 100; 
      const boxTop = screenY - ziggurat.height - 40;
      const boxBottom = screenY;
      
      return (
          mouseX >= boxX && 
          mouseX <= boxX + boxW && 
          mouseY >= boxTop && 
          mouseY <= boxBottom
      );
  };

  const isMouseOverStatue = (mouseX: number, mouseY: number) => {
      const statue = entities.current.find(e => e.id === 'dragon-statue');
      if (!statue) return false;
      
      return (
          mouseX >= statue.x && 
          mouseX <= statue.x + statue.width &&
          mouseY >= statue.y &&
          mouseY <= statue.y + statue.height
      );
  };

  // Handle Mouse Move for Hover Effects (Button feel)
  const handleMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
      const canvas = canvasRef.current;
      if (!canvas) return;
      const rect = canvas.getBoundingClientRect();
      const scaleX = GAME_WIDTH / rect.width;
      const scaleY = GAME_HEIGHT / rect.height;
      const x = (e.clientX - rect.left) * scaleX;
      const y = (e.clientY - rect.top) * scaleY;

      let isHovering = false;

      if (gameState === GameState.MAP) {
         if (x > 120 && x < 200 && y > 70 && y < 120) {
             isHovering = true;
         }
      } else if (gameState === GameState.CITY_EXPLORATION) {
         // Check if we are near the Ziggurat using dynamic check
         if (scrollTargetRef.current > 50) { 
             if (isMouseOverZiggurat(x, y)) {
                 isHovering = true;
                 hoveredEntityRef.current = 'ziggurat';
             } else {
                 hoveredEntityRef.current = null;
             }
         } else {
             hoveredEntityRef.current = null;
         }
      } else if (gameState === GameState.ZIGGURAT_INSIDE) {
          if (isMouseOverStatue(x, y)) {
              isHovering = true;
              hoveredEntityRef.current = 'dragon-statue';
          } else {
              hoveredEntityRef.current = null;
          }
      }

      if (isHovering) {
          canvas.style.cursor = 'pointer';
      } else {
          canvas.style.cursor = 'default';
      }
  };

  const handleClick = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const scaleX = GAME_WIDTH / rect.width;
    const scaleY = GAME_HEIGHT / rect.height;
    const x = (e.clientX - rect.left) * scaleX;
    const y = (e.clientY - rect.top) * scaleY;

    if (gameState === GameState.MAP) {
        if (x > 120 && x < 200 && y > 70 && y < 120) {
            audioService.playSelectSound();
            transitionTarget.current = GameState.CITY_EXPLORATION; // Target City
            setGameState(GameState.TRANSITION);
            transitionAlpha.current = 0;
        }
    } else if (gameState === GameState.CITY_EXPLORATION) {
        if (scrollTargetRef.current > 50) {
             if (isMouseOverZiggurat(x, y)) {
                 audioService.playSelectSound();
                 transitionTarget.current = GameState.ZIGGURAT_INSIDE; // Target Ziggurat
                 setGameState(GameState.TRANSITION);
                 transitionAlpha.current = 0;
                 hoveredEntityRef.current = null; // Reset hover
             }
        }
    } else if (gameState === GameState.ZIGGURAT_INSIDE) {
        if (isMouseOverStatue(x, y)) {
            audioService.playSelectSound();
            onStatueClick();
        }
    }
  };

  return (
    <canvas
      ref={canvasRef}
      width={GAME_WIDTH}
      height={GAME_HEIGHT}
      onClick={handleClick}
      onMouseMove={handleMouseMove}
      className="w-full h-full object-contain"
      style={{ imageRendering: 'pixelated' }}
    />
  );
};

export default GameEngine;