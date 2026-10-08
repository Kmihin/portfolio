// Scenes the particle cloud can form, drawn with plain canvas primitives on a square canvas.
// Each drawing is sampled into points by particles.ts. Keep them bold and simple: thin detail
// disappears once it is made of dots. `size` is the canvas side in pixels; shapes fill about 70% of it.

type Draw = (ctx: CanvasRenderingContext2D, size: number) => void;

// Helpers so every scene reads the same way.
function stroke(ctx: CanvasRenderingContext2D, size: number) {
  ctx.lineWidth = size * 0.07;
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  ctx.strokeStyle = "#fff";
}
function hole(ctx: CanvasRenderingContext2D, fn: () => void) {
  // Cut a hole into what was already drawn.
  ctx.globalCompositeOperation = "destination-out";
  fn();
  ctx.globalCompositeOperation = "source-over";
}

export const scenes: Record<string, Draw> = {
  // A cloud: overlapping circles on a flat base.
  cloud(ctx, s) {
    ctx.beginPath();
    ctx.arc(s * 0.36, s * 0.52, s * 0.17, 0, Math.PI * 2);
    ctx.arc(s * 0.52, s * 0.42, s * 0.21, 0, Math.PI * 2);
    ctx.arc(s * 0.68, s * 0.54, s * 0.15, 0, Math.PI * 2);
    ctx.rect(s * 0.3, s * 0.54, s * 0.46, s * 0.15);
    ctx.fill();
  },

  // A server rack: three units with a status light each.
  server(ctx, s) {
    for (let i = 0; i < 3; i++) {
      const y = s * (0.22 + i * 0.2);
      ctx.fillRect(s * 0.25, y, s * 0.5, s * 0.15);
      hole(ctx, () => {
        ctx.beginPath();
        ctx.arc(s * 0.67, y + s * 0.075, s * 0.03, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillRect(s * 0.3, y + s * 0.06, s * 0.22, s * 0.03);
      });
    }
  },

  // A sheet of paper with a folded corner and text lines.
  document(ctx, s) {
    ctx.beginPath();
    ctx.moveTo(s * 0.3, s * 0.15);
    ctx.lineTo(s * 0.6, s * 0.15);
    ctx.lineTo(s * 0.72, s * 0.27);
    ctx.lineTo(s * 0.72, s * 0.85);
    ctx.lineTo(s * 0.3, s * 0.85);
    ctx.closePath();
    ctx.fill();
    hole(ctx, () => {
      for (let i = 0; i < 4; i++) ctx.fillRect(s * 0.37, s * (0.4 + i * 0.1), s * (i === 3 ? 0.18 : 0.28), s * 0.035);
    });
  },

  // A signed document: the same sheet with a big check mark.
  signed(ctx, s) {
    scenes.document(ctx, s);
    hole(ctx, () => {
      stroke(ctx, s);
      ctx.lineWidth = s * 0.09;
      ctx.beginPath();
      ctx.moveTo(s * 0.38, s * 0.58);
      ctx.lineTo(s * 0.48, s * 0.7);
      ctx.lineTo(s * 0.66, s * 0.44);
      ctx.stroke();
    });
  },

  // A padlock.
  lock(ctx, s) {
    stroke(ctx, s);
    ctx.beginPath();
    ctx.arc(s * 0.5, s * 0.4, s * 0.15, Math.PI, 0);
    ctx.stroke();
    ctx.fillRect(s * 0.27, s * 0.42, s * 0.46, s * 0.36);
    hole(ctx, () => {
      ctx.beginPath();
      ctx.arc(s * 0.5, s * 0.58, s * 0.045, 0, Math.PI * 2);
      ctx.fill();
    });
  },

  // A key, lying horizontally.
  key(ctx, s) {
    stroke(ctx, s);
    ctx.lineWidth = s * 0.08;
    ctx.beginPath();
    ctx.arc(s * 0.3, s * 0.5, s * 0.11, 0, Math.PI * 2);
    ctx.stroke();
    ctx.fillRect(s * 0.41, s * 0.46, s * 0.4, s * 0.08);
    ctx.fillRect(s * 0.68, s * 0.52, s * 0.05, s * 0.1);
    ctx.fillRect(s * 0.77, s * 0.52, s * 0.05, s * 0.13);
  },

  // Rows of a data file.
  rows(ctx, s) {
    const widths = [0.5, 0.36, 0.44, 0.3, 0.46];
    widths.forEach((w, i) => ctx.fillRect(s * 0.25, s * (0.26 + i * 0.12), s * w, s * 0.055));
  },

  // A database cylinder.
  database(ctx, s) {
    ctx.beginPath();
    ctx.ellipse(s * 0.5, s * 0.28, s * 0.24, s * 0.09, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillRect(s * 0.26, s * 0.28, s * 0.48, s * 0.42);
    ctx.beginPath();
    ctx.ellipse(s * 0.5, s * 0.7, s * 0.24, s * 0.09, 0, 0, Math.PI * 2);
    ctx.fill();
    hole(ctx, () => {
      stroke(ctx, s);
      ctx.lineWidth = s * 0.03;
      for (const y of [0.45, 0.6]) {
        ctx.beginPath();
        ctx.ellipse(s * 0.5, s * y, s * 0.24, s * 0.09, 0, 0, Math.PI);
        ctx.stroke();
      }
    });
  },

  // A lorry seen from the side.
  truck(ctx, s) {
    ctx.fillRect(s * 0.14, s * 0.36, s * 0.46, s * 0.3);
    ctx.fillRect(s * 0.6, s * 0.45, s * 0.26, s * 0.21);
    hole(ctx, () => ctx.fillRect(s * 0.65, s * 0.49, s * 0.12, s * 0.09));
    for (const x of [0.28, 0.7]) {
      ctx.beginPath();
      ctx.arc(s * x, s * 0.7, s * 0.07, 0, Math.PI * 2);
      ctx.fill();
    }
  },

  // A volleyball: circle with three curved seams.
  ball(ctx, s) {
    stroke(ctx, s);
    ctx.lineWidth = s * 0.06;
    ctx.beginPath();
    ctx.arc(s * 0.5, s * 0.5, s * 0.3, 0, Math.PI * 2);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(s * 0.5, s * 0.2);
    ctx.quadraticCurveTo(s * 0.3, s * 0.5, s * 0.5, s * 0.8);
    ctx.moveTo(s * 0.24, s * 0.4);
    ctx.quadraticCurveTo(s * 0.55, s * 0.45, s * 0.78, s * 0.38);
    ctx.moveTo(s * 0.28, s * 0.66);
    ctx.quadraticCurveTo(s * 0.55, s * 0.6, s * 0.76, s * 0.66);
    ctx.stroke();
  },

  // A month view calendar.
  calendar(ctx, s) {
    ctx.fillRect(s * 0.22, s * 0.22, s * 0.56, s * 0.56);
    hole(ctx, () => {
      for (let r = 0; r < 3; r++) for (let c = 0; c < 4; c++) ctx.fillRect(s * (0.27 + c * 0.125), s * (0.4 + r * 0.115), s * 0.08, s * 0.07);
    });
    ctx.fillRect(s * 0.3, s * 0.16, s * 0.05, s * 0.1);
    ctx.fillRect(s * 0.65, s * 0.16, s * 0.05, s * 0.1);
  },

  // A dumbbell.
  dumbbell(ctx, s) {
    ctx.fillRect(s * 0.3, s * 0.46, s * 0.4, s * 0.08);
    for (const x of [0.16, 0.24, 0.7, 0.78]) ctx.fillRect(s * x, s * 0.34, s * 0.06, s * 0.32);
  },

  // A phone.
  phone(ctx, s) {
    stroke(ctx, s);
    ctx.lineWidth = s * 0.05;
    ctx.beginPath();
    ctx.roundRect(s * 0.33, s * 0.14, s * 0.34, s * 0.72, s * 0.05);
    ctx.stroke();
    ctx.fillRect(s * 0.43, s * 0.78, s * 0.14, s * 0.025);
    ctx.fillRect(s * 0.39, s * 0.24, s * 0.22, s * 0.04);
    ctx.fillRect(s * 0.39, s * 0.32, s * 0.16, s * 0.04);
  },

  // A browser window.
  browser(ctx, s) {
    stroke(ctx, s);
    ctx.lineWidth = s * 0.045;
    ctx.strokeRect(s * 0.16, s * 0.22, s * 0.68, s * 0.56);
    ctx.fillRect(s * 0.16, s * 0.22, s * 0.68, s * 0.1);
    ctx.fillRect(s * 0.24, s * 0.4, s * 0.3, s * 0.045);
    ctx.fillRect(s * 0.24, s * 0.5, s * 0.5, s * 0.045);
    ctx.fillRect(s * 0.24, s * 0.6, s * 0.4, s * 0.045);
  },

  // Three systems connected to each other.
  nodes(ctx, s) {
    stroke(ctx, s);
    ctx.lineWidth = s * 0.035;
    const pts = [
      [0.25, 0.3],
      [0.75, 0.3],
      [0.5, 0.72],
    ];
    ctx.beginPath();
    ctx.moveTo(s * pts[0][0], s * pts[0][1]);
    ctx.lineTo(s * pts[1][0], s * pts[1][1]);
    ctx.lineTo(s * pts[2][0], s * pts[2][1]);
    ctx.closePath();
    ctx.stroke();
    for (const [x, y] of pts) {
      ctx.beginPath();
      ctx.arc(s * x, s * y, s * 0.1, 0, Math.PI * 2);
      ctx.fill();
    }
  },

  // A delivery pipeline: stages joined by a line, last one filled.
  pipeline(ctx, s) {
    stroke(ctx, s);
    ctx.lineWidth = s * 0.035;
    ctx.beginPath();
    ctx.moveTo(s * 0.18, s * 0.5);
    ctx.lineTo(s * 0.82, s * 0.5);
    ctx.stroke();
    [0.2, 0.4, 0.6, 0.8].forEach((x, i) => {
      ctx.beginPath();
      ctx.arc(s * x, s * 0.5, s * 0.08, 0, Math.PI * 2);
      i === 3 ? ctx.fill() : ctx.stroke();
    });
  },

  // A gear.
  gear(ctx, s) {
    const teeth = 9;
    ctx.beginPath();
    for (let i = 0; i < teeth * 2; i++) {
      const r = i % 2 === 0 ? s * 0.32 : s * 0.24;
      const a = (i / (teeth * 2)) * Math.PI * 2;
      ctx.lineTo(s * 0.5 + Math.cos(a) * r, s * 0.5 + Math.sin(a) * r);
    }
    ctx.closePath();
    ctx.fill();
    hole(ctx, () => {
      ctx.beginPath();
      ctx.arc(s * 0.5, s * 0.5, s * 0.1, 0, Math.PI * 2);
      ctx.fill();
    });
  },

  // A house.
  house(ctx, s) {
    ctx.beginPath();
    ctx.moveTo(s * 0.5, s * 0.16);
    ctx.lineTo(s * 0.84, s * 0.46);
    ctx.lineTo(s * 0.74, s * 0.46);
    ctx.lineTo(s * 0.74, s * 0.82);
    ctx.lineTo(s * 0.26, s * 0.82);
    ctx.lineTo(s * 0.26, s * 0.46);
    ctx.lineTo(s * 0.16, s * 0.46);
    ctx.closePath();
    ctx.fill();
    hole(ctx, () => ctx.fillRect(s * 0.44, s * 0.58, s * 0.12, s * 0.24));
  },

  // A person: head and shoulders.
  person(ctx, s) {
    ctx.beginPath();
    ctx.arc(s * 0.5, s * 0.34, s * 0.13, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.arc(s * 0.5, s * 0.85, s * 0.3, Math.PI, 0);
    ctx.fill();
  },
};
