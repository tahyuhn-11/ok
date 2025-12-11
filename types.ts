export enum GameState {
  MAP = 'MAP',
  TRANSITION = 'TRANSITION',
  CITY_EXPLORATION = 'CITY_EXPLORATION',
  ZIGGURAT_INSIDE = 'ZIGGURAT_INSIDE',
}

export interface Position {
  x: number;
  y: number;
}

export interface Entity {
  id: string;
  type: 'NPC' | 'BUILDING' | 'DECOR' | 'PLAYER' | 'BOAT' | 'ZIGGURAT' | 'STATUE' | 'BANNER';
  x: number;
  y: number;
  width: number;
  height: number;
  color?: string;
  sprite?: number[][]; // Simple 0/1 grid for pixel art
  animFrame?: number;
  speed?: number;
  direction?: number; // 1 or -1
  variant?: string; // e.g. "priest", "farmer", "dragon_flag"
}

export interface Particle {
  x: number;
  y: number;
  life: number;
  color: string;
  vx: number;
  vy: number;
}