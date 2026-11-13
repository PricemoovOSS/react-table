import { inflateSync } from "zlib";
import { Page } from "@playwright/test";

export interface IImage {
  width: number;
  height: number;
  /** Mean of the red, green and blue channels: 255 is white, 0 is black */
  luminance: (x: number, y: number) => number;
}

/** Decodes the 8-bit, non-interlaced PNG produced by a screenshot. */
function decodePng(png: Buffer): IImage {
  let offset = 8;
  let width = 0;
  let height = 0;
  let colorType = 0;
  const data: Buffer[] = [];
  while (offset < png.length) {
    const length = png.readUInt32BE(offset);
    const type = png.toString("ascii", offset + 4, offset + 8);
    const chunk = png.subarray(offset + 8, offset + 8 + length);
    if (type === "IHDR") {
      width = chunk.readUInt32BE(0);
      height = chunk.readUInt32BE(4);
      colorType = chunk[9];
    } else if (type === "IDAT") {
      data.push(chunk);
    }
    offset += 12 + length;
  }
  const channels = colorType === 6 ? 4 : 3;
  const stride = width * channels;
  const raw = inflateSync(Buffer.concat(data));
  const pixels = Buffer.alloc(height * stride);
  for (let y = 0; y < height; y++) {
    const filter = raw[y * (stride + 1)];
    const line = y * (stride + 1) + 1;
    for (let x = 0; x < stride; x++) {
      const left = x >= channels ? pixels[y * stride + x - channels] : 0;
      const up = y > 0 ? pixels[(y - 1) * stride + x] : 0;
      const upLeft = y > 0 && x >= channels ? pixels[(y - 1) * stride + x - channels] : 0;
      let value = raw[line + x];
      if (filter === 1) value += left;
      else if (filter === 2) value += up;
      else if (filter === 3) value += (left + up) >> 1;
      else if (filter === 4) {
        const estimate = left + up - upLeft;
        const [distanceLeft, distanceUp, distanceUpLeft] = [left, up, upLeft].map((v) => Math.abs(estimate - v));
        if (distanceLeft <= distanceUp && distanceLeft <= distanceUpLeft) value += left;
        else value += distanceUp <= distanceUpLeft ? up : upLeft;
      }
      pixels[y * stride + x] = value & 255;
    }
  }
  return {
    width,
    height,
    luminance: (x, y) => {
      const index = Math.round(y) * stride + Math.round(x) * channels;
      return Math.round((pixels[index] + pixels[index + 1] + pixels[index + 2]) / 3);
    },
  };
}

export async function capture(page: Page): Promise<IImage> {
  return decodePng(await page.screenshot());
}

const SPAN = 14;

/** Darkest pixel of a horizontal segment centred on `x`: what a vertical relief leaves there. */
export function darkestAcross(image: IImage, x: number, y: number): number {
  let darkest = 255;
  for (let dx = -SPAN; dx <= SPAN; dx++) darkest = Math.min(darkest, image.luminance(x + dx, y));
  return darkest;
}

/** Darkest pixel of a vertical segment centred on `y`: what a horizontal relief leaves there. */
export function darkestAlong(image: IImage, x: number, y: number): number {
  let darkest = 255;
  for (let dy = -SPAN; dy <= SPAN; dy++) darkest = Math.min(darkest, image.luminance(x, y + dy));
  return darkest;
}
