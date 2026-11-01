/**
 * Lightweight, high-performance confetti animation engine.
 * Tailored for HoldMeToIt's Obsidian Dark palette.
 *
 * Characteristics:
 * - Zero external npm dependencies.
 * - Single dynamic fixed canvas overlay with pointer-events: none and high z-index.
 * - Automatically scales for high-DPI / Retina displays.
 * - Auto-cleanup: canvas and animation frames are fully destroyed once particles settle.
 * - Respects prefers-reduced-motion accessibility standards.
 * - Fail-soft in SSR and jsdom testing environments.
 */

export interface ConfettiOrigin {
   x?: number; // Screen X coordinate (pixels or 0..1 ratio)
   y?: number; // Screen Y coordinate (pixels or 0..1 ratio)
}

export interface ConfettiOptions {
   particleCount?: number;
   origin?: ConfettiOrigin;
   colors?: string[];
   spread?: number; // Cone spread angle in degrees (e.g. 75)
   angle?: number; // Launch direction in degrees (-90 = upward)
   startVelocity?: number;
   decay?: number;
   gravity?: number;
   shapes?: ("rectangle" | "circle")[];
   disableForReducedMotion?: boolean;
}

// Obsidian-tailored celebratory palette
export const OBSIDIAN_CONFETTI_COLORS: readonly string[] = [
   "#10b981", // Emerald green (Task completion primary)
   "#34d399", // Mint / Light emerald
   "#fbbf24", // Gold / Brand-1 light
   "#f59e0b", // Amber / Brand-1
   "#38bdf8", // Sky blue
   "#60a5fa", // Azure
   "#c084fc", // Purple / Violet accent
   "#f43f5e", // Rose / Brand-3
   "#ffffff", // Crisp silver highlight
];

interface Particle {
   x: number;
   y: number;
   vx: number;
   vy: number;
   width: number;
   height: number;
   radius: number;
   shape: "rectangle" | "circle";
   color: string;
   alpha: number;
   gravity: number;
   drag: number;
   rotationX: number;
   rotationY: number;
   rotationZ: number;
   drX: number;
   drY: number;
   drZ: number;
   wobble: number;
   wobbleSpeed: number;
   life: number;
   maxLife: number;
}

// Module-level simulation state for smooth concurrent bursts
let activeCanvas: HTMLCanvasElement | null = null;
let activeCtx: CanvasRenderingContext2D | null = null;
let activeParticles: Particle[] = [];
let animFrameId: number | null = null;

function cleanup() {
   if (animFrameId !== null) {
      cancelAnimationFrame(animFrameId);
      animFrameId = null;
   }
   if (activeCanvas && activeCanvas.parentNode) {
      activeCanvas.parentNode.removeChild(activeCanvas);
   }
   activeCanvas = null;
   activeCtx = null;
   activeParticles = [];
}

function ensureCanvas(): {
   canvas: HTMLCanvasElement;
   ctx: CanvasRenderingContext2D;
} | null {
   if (typeof window === "undefined" || typeof document === "undefined") {
      return null;
   }

   if (activeCanvas && activeCtx) {
      return { canvas: activeCanvas, ctx: activeCtx };
   }

   const canvas = document.createElement("canvas");
   canvas.setAttribute("aria-hidden", "true");
   canvas.style.position = "fixed";
   canvas.style.top = "0";
   canvas.style.left = "0";
   canvas.style.width = "100vw";
   canvas.style.height = "100vh";
   canvas.style.pointerEvents = "none";
   canvas.style.zIndex = "99999";
   canvas.style.overflow = "hidden";

   const dpr = Math.min(window.devicePixelRatio || 1, 2);
   canvas.width = Math.floor(window.innerWidth * dpr);
   canvas.height = Math.floor(window.innerHeight * dpr);

   const ctx = canvas.getContext("2d");
   if (!ctx) {
      return null;
   }

   ctx.scale(dpr, dpr);
   document.body.appendChild(canvas);

   activeCanvas = canvas;
   activeCtx = ctx;

   return { canvas, ctx };
}

function createParticles(options: ConfettiOptions = {}): Particle[] {
   const count = options.particleCount ?? 45;
   const colors = options.colors ?? OBSIDIAN_CONFETTI_COLORS;
   const spread = (options.spread ?? 75) * (Math.PI / 180);
   const baseAngle = ((options.angle ?? -90) * Math.PI) / 180;
   const baseVelocity = options.startVelocity ?? 16;
   const gravity = options.gravity ?? 0.45;
   const drag = options.decay ?? 0.95;
   const shapes = options.shapes ?? ["rectangle", "circle"];

   const winWidth = typeof window !== "undefined" ? window.innerWidth : 800;
   const winHeight = typeof window !== "undefined" ? window.innerHeight : 600;

   let originX = winWidth * 0.5;
   let originY = winHeight * 0.6;

   if (options.origin) {
      if (typeof options.origin.x === "number") {
         originX =
            options.origin.x <= 1 && options.origin.x >= 0
               ? options.origin.x * winWidth
               : options.origin.x;
      }
      if (typeof options.origin.y === "number") {
         originY =
            options.origin.y <= 1 && options.origin.y >= 0
               ? options.origin.y * winHeight
               : options.origin.y;
      }
   }

   const particles: Particle[] = [];

   for (let i = 0; i < count; i++) {
      const angle = baseAngle - spread / 2 + Math.random() * spread;
      const velocity = baseVelocity * (0.6 + Math.random() * 0.8);
      const shape =
         shapes[Math.floor(Math.random() * shapes.length)] || "rectangle";
      const color =
         colors[Math.floor(Math.random() * colors.length)] || "#10b981";

      particles.push({
         x: originX,
         y: originY,
         vx: Math.cos(angle) * velocity,
         vy: Math.sin(angle) * velocity,
         width: 7 + Math.random() * 5,
         height: 4 + Math.random() * 4,
         radius: 3 + Math.random() * 2,
         shape,
         color,
         alpha: 1,
         gravity: gravity * (0.8 + Math.random() * 0.4),
         drag: drag * (0.98 + Math.random() * 0.03),
         rotationX: Math.random() * Math.PI * 2,
         rotationY: Math.random() * Math.PI * 2,
         rotationZ: Math.random() * Math.PI * 2,
         drX: (Math.random() - 0.5) * 0.25,
         drY: (Math.random() - 0.5) * 0.25,
         drZ: (Math.random() - 0.5) * 0.2,
         wobble: Math.random() * 10,
         wobbleSpeed: 0.08 + Math.random() * 0.06,
         life: 0,
         maxLife: 100 + Math.floor(Math.random() * 45), // ~1.8 - 2.5s at 60fps
      });
   }

   return particles;
}

function runAnimationLoop() {
   if (animFrameId !== null) return;

   const loop = () => {
      if (!activeCanvas || !activeCtx || activeParticles.length === 0) {
         cleanup();
         return;
      }

      const winWidth = window.innerWidth;
      const winHeight = window.innerHeight;

      activeCtx.clearRect(0, 0, winWidth, winHeight);

      const surviving: Particle[] = [];

      for (let i = 0; i < activeParticles.length; i++) {
         const p = activeParticles[i];
         p.life++;

         p.vx *= p.drag;
         p.vy = p.vy * p.drag + p.gravity;
         p.wobble += p.wobbleSpeed;

         p.x += p.vx + Math.sin(p.wobble) * 0.6;
         p.y += p.vy;

         p.rotationX += p.drX;
         p.rotationY += p.drY;
         p.rotationZ += p.drZ;

         // Smooth opacity fadeout in the last 35% of particle life
         const fadeThreshold = p.maxLife * 0.65;
         if (p.life > fadeThreshold) {
            p.alpha = Math.max(
               0,
               1 - (p.life - fadeThreshold) / (p.maxLife - fadeThreshold)
            );
         }

         if (p.life < p.maxLife && p.y <= winHeight + 60 && p.alpha > 0) {
            surviving.push(p);

            activeCtx.save();
            activeCtx.translate(p.x, p.y);
            activeCtx.rotate(p.rotationZ);
            activeCtx.globalAlpha = p.alpha;
            activeCtx.fillStyle = p.color;

            // 3D tumbling perspective simulation
            const scaleX = Math.cos(p.rotationX);
            const scaleY = Math.cos(p.rotationY);
            activeCtx.scale(scaleX, scaleY);

            if (p.shape === "circle") {
               activeCtx.beginPath();
               activeCtx.arc(0, 0, p.radius, 0, Math.PI * 2);
               activeCtx.fill();
            } else {
               activeCtx.fillRect(
                  -p.width / 2,
                  -p.height / 2,
                  p.width,
                  p.height
               );
            }

            activeCtx.restore();
         }
      }

      activeParticles = surviving;

      if (activeParticles.length > 0) {
         animFrameId = requestAnimationFrame(loop);
      } else {
         cleanup();
      }
   };

   animFrameId = requestAnimationFrame(loop);
}

/**
 * Fires an Obsidian-themed confetti burst on the active window.
 */
export function triggerConfetti(options: ConfettiOptions = {}): void {
   if (typeof window === "undefined" || typeof document === "undefined") {
      return;
   }

   // Respect user preference for reduced motion
   if (
      options.disableForReducedMotion !== false &&
      window.matchMedia?.("(prefers-reduced-motion: reduce)").matches
   ) {
      return;
   }

   const instance = ensureCanvas();
   if (!instance) {
      return;
   }

   const newParticles = createParticles(options);
   activeParticles.push(...newParticles);

   runAnimationLoop();
}

/**
 * Convenience helper to launch a confetti burst positioned relative to
 * a clicked element, mouse/pointer event, or DOM element.
 */
export function triggerTaskConfetti(
   target?:
      | Element
      | React.MouseEvent
      | MouseEvent
      | { clientX: number; clientY: number }
      | null
): void {
   if (typeof window === "undefined" || typeof document === "undefined") {
      return;
   }

   let origin: ConfettiOrigin | undefined;

   if (target) {
      if (
         "clientX" in target &&
         "clientY" in target &&
         typeof target.clientX === "number"
      ) {
         origin = { x: target.clientX, y: target.clientY };
      } else if (
         "getBoundingClientRect" in target &&
         typeof (target as Element).getBoundingClientRect === "function"
      ) {
         const rect = (target as Element).getBoundingClientRect();
         // Check if element is positioned within the active viewport
         if (rect.width > 0 || rect.height > 0) {
            origin = {
               x: rect.left + Math.min(24, rect.width * 0.3), // Near the checkbox / start of task
               y: rect.top + rect.height * 0.5,
            };
         }
      }
   }

   // Fallback to center-viewport pop if target coordinate wasn't resolved
   if (
      !origin ||
      origin.x === undefined ||
      origin.y === undefined ||
      isNaN(origin.x) ||
      isNaN(origin.y)
   ) {
      origin = {
         x: window.innerWidth * 0.5,
         y: Math.min(window.innerHeight * 0.65, window.innerHeight - 80),
      };
   }

   triggerConfetti({
      origin,
      particleCount: 45,
      spread: 75,
      angle: -90,
      startVelocity: 16,
   });
}
