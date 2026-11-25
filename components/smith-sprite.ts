/**
 * Pixel-art blacksmith, two frames: hammer raised and hammer striking.
 * Each string is one row; each character one pixel (see PALETTE).
 */

export const PALETTE: Record<string, string> = {
  k: "#0b0806", // outline
  h: "#c0622f", // hair
  b: "#a9542a", // beard
  s: "#e2a979", // skin
  e: "#0b0806", // eye
  c: "#3f5a73", // shirt
  a: "#5e3a22", // leather apron
  A: "#7a4c2c", // apron highlight
  d: "#4a4038", // trousers
  w: "#a87a45", // hammer handle
  m: "#9aa3ad", // hammer head
  M: "#c9d0d6", // hammer highlight
  i: "#454b53", // anvil
  I: "#6b737c", // anvil top
  o: "#f08a3c", // hot metal
  y: "#ffd36b", // white-hot
};

const RAISED = [
  "........kkkkk.........",
  "........kMmmk.........",
  "........kmmmk.........",
  "........kkwkk.........",
  "...kkkkk..w...........",
  "..khhhhhk.s...........",
  "..khssssk.s...........",
  "..khssesk.c...........",
  "..khsssssk.c..........",
  "..kbbbbbk.c...........",
  "..kcbbbckcc...........",
  ".kcAaaaacck...........",
  ".kcaAaaack............",
  ".kckaaaaak............",
  "..kaaaaaak.....kyook..",
  "..kaaaaaak..kkIIIIIIk.",
  "...kaaaak..kIIIIIIIIk.",
  "...kd..dk.....kiiik...",
  "...kd..dk.....kiiik...",
  "...kd..dk....kiiiiik..",
  "..kkk..kkk..kkkkkkkkk.",
];

const STRIKE = [
  "......................",
  "......................",
  "......................",
  "......................",
  "...kkkkk..............",
  "..khhhhhk.............",
  "..khssssk.............",
  "..khssesk.............",
  "..khsssssk............",
  "..kbbbbbk.......kkk...",
  "..kcbbbckc......kMk...",
  ".kcAaaaacccsswwwkmk...",
  ".kcaAaaackk.....kmk...",
  ".kckaaaaak......kkk...",
  "..kaaaaaak.....kyook..",
  "..kaaaaaak..kkIIIIIIk.",
  "...kaaaak..kIIIIIIIIk.",
  "...kd..dk.....kiiik...",
  "...kd..dk.....kiiik...",
  "...kd..dk....kiiiiik..",
  "..kkk..kkk..kkkkkkkkk.",
];

export const FRAMES = { raised: RAISED, strike: STRIKE };
export const SPRITE_W = 22;
export const SPRITE_H = 21;

/** Run-length rects for one frame, so the SVG stays small. */
export function frameRects(rows: string[]): Array<{ x: number; y: number; w: number; fill: string }> {
  const rects: Array<{ x: number; y: number; w: number; fill: string }> = [];
  rows.forEach((row, y) => {
    let x = 0;
    while (x < row.length) {
      const ch = row[x];
      if (ch === "." || !PALETTE[ch]) {
        x++;
        continue;
      }
      let w = 1;
      while (row[x + w] === ch) w++;
      rects.push({ x, y, w, fill: PALETTE[ch] });
      x += w;
    }
  });
  return rects;
}
