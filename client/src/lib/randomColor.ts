const PALETTE = [
  "#e63946",
  "#f4a261",
  "#2a9d8f",
  "#264653",
  "#8338ec",
  "#3a86ff",
  "#fb5607",
  "#ff006e",
  "#06d6a0",
  "#ffbe0b",
];

export function randomColor(): string {
  return PALETTE[Math.floor(Math.random() * PALETTE.length)];
}
