/**
 * Yüklenen logoyu tarayıcıda hazırlar (yalnızca istemci tarafı — canvas kullanır):
 *   1. maxWidth'e küçültür,
 *   2. köşelerden ulaşılan düz beyaz/açık zemini şeffaflaştırır (beyaz kutulu JPG logolar),
 *   3. boş kenarları kırpar — logo kadar,
 *   4. logonun açık renkli (beyaz) olup olmadığını söyler: beyaz zeminde görünmez, koyu arka plan ister.
 */

const WHITE_TOL = 28; // 255'e bu kadar yakın kanallar "beyaz zemin" sayılır
const LIGHT_LUMA = 0.82; // görünür piksellerin ortalama parlaklığı bunun üstündeyse logo "açık"

async function loadImage(src: string): Promise<HTMLImageElement> {
  const img = new Image();
  img.src = src;
  await img.decode();
  return img;
}

export function readFileAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(String(r.result));
    r.onerror = reject;
    r.readAsDataURL(file);
  });
}

/** Görünür (opak) piksellerin ortalama parlaklığına göre açık renkli mi. */
export function isLightPixels(data: Uint8ClampedArray): boolean {
  let sum = 0;
  let n = 0;
  for (let i = 0; i < data.length; i += 4) {
    if (data[i + 3] < 128) continue;
    sum += (0.2126 * data[i] + 0.7152 * data[i + 1] + 0.0722 * data[i + 2]) / 255;
    n++;
  }
  return n > 0 && sum / n > LIGHT_LUMA;
}

export async function isLightLogo(dataUrl: string): Promise<boolean> {
  const img = await loadImage(dataUrl);
  const scale = Math.min(1, 120 / img.width);
  const c = document.createElement("canvas");
  c.width = Math.max(1, Math.round(img.width * scale));
  c.height = Math.max(1, Math.round(img.height * scale));
  const ctx = c.getContext("2d")!;
  ctx.drawImage(img, 0, 0, c.width, c.height);
  return isLightPixels(ctx.getImageData(0, 0, c.width, c.height).data);
}

export async function prepareLogo(src: string, maxWidth: number): Promise<{ dataUrl: string; light: boolean }> {
  const img = await loadImage(src);
  const scale = Math.min(1, maxWidth / img.width);
  const w = Math.max(1, Math.round(img.width * scale));
  const h = Math.max(1, Math.round(img.height * scale));
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d")!;
  ctx.drawImage(img, 0, 0, w, h);
  const imgData = ctx.getImageData(0, 0, w, h);
  const d = imgData.data;

  // 2) Köşeler opak beyazsa: köşelerden taşan (flood fill) beyaz zemin şeffaf yapılır. Logonun
  //    içindeki beyaz alanlar (zemine bağlı değilse) korunur.
  const isBgWhite = (p: number) => d[p * 4 + 3] > 200 && d[p * 4] > 255 - WHITE_TOL && d[p * 4 + 1] > 255 - WHITE_TOL && d[p * 4 + 2] > 255 - WHITE_TOL;
  const corners = [0, w - 1, (h - 1) * w, h * w - 1];
  if (corners.filter(isBgWhite).length >= 3) {
    const seen = new Uint8Array(w * h);
    const stack = corners.filter(isBgWhite);
    while (stack.length) {
      const p = stack.pop()!;
      if (seen[p]) continue;
      seen[p] = 1;
      if (!isBgWhite(p)) continue;
      d[p * 4 + 3] = 0;
      const x = p % w;
      if (x > 0) stack.push(p - 1);
      if (x < w - 1) stack.push(p + 1);
      if (p >= w) stack.push(p - w);
      if (p < w * (h - 1)) stack.push(p + w);
    }
  }

  // 3) Görünür piksellerin sınırına kırp (2 px pay)
  let minX = w, minY = h, maxX = -1, maxY = -1;
  for (let y = 0; y < h; y++)
    for (let x = 0; x < w; x++)
      if (d[(y * w + x) * 4 + 3] > 16) {
        if (x < minX) minX = x;
        if (x > maxX) maxX = x;
        if (y < minY) minY = y;
        if (y > maxY) maxY = y;
      }
  ctx.putImageData(imgData, 0, 0);
  const light = isLightPixels(d);
  if (maxX < 0) return { dataUrl: canvas.toDataURL("image/png"), light };
  minX = Math.max(0, minX - 2);
  minY = Math.max(0, minY - 2);
  maxX = Math.min(w - 1, maxX + 2);
  maxY = Math.min(h - 1, maxY + 2);
  const out = document.createElement("canvas");
  out.width = maxX - minX + 1;
  out.height = maxY - minY + 1;
  out.getContext("2d")!.drawImage(canvas, minX, minY, out.width, out.height, 0, 0, out.width, out.height);
  return { dataUrl: out.toDataURL("image/png"), light };
}

/** Firma tema renginin koyu tonu (brand-800) — yoksa antrasit. */
function themeBackground(): string {
  const v = getComputedStyle(document.documentElement).getPropertyValue("--brand-800").trim();
  return v ? `rgb(${v.split(/\s+/).join(",")})` : "#111827";
}

/**
 * Açık renkli logoyu koyu, yuvarlatılmış bir zemine (logo kadar + pay) oturtur — Excel gibi
 * arka planı kontrol edemediğimiz beyaz sayfalar için.
 */
export async function withDarkBackground(dataUrl: string, bg = themeBackground()): Promise<string> {
  const img = await loadImage(dataUrl);
  const pad = Math.round(Math.max(8, img.height * 0.18));
  const c = document.createElement("canvas");
  c.width = img.width + pad * 2;
  c.height = img.height + pad * 2;
  const ctx = c.getContext("2d")!;
  const r = Math.round(Math.min(c.height, c.width) * 0.18);
  ctx.fillStyle = bg;
  ctx.beginPath();
  ctx.moveTo(r, 0);
  ctx.arcTo(c.width, 0, c.width, c.height, r);
  ctx.arcTo(c.width, c.height, 0, c.height, r);
  ctx.arcTo(0, c.height, 0, 0, r);
  ctx.arcTo(0, 0, c.width, 0, r);
  ctx.closePath();
  ctx.fill();
  ctx.drawImage(img, pad, pad);
  return c.toDataURL("image/png");
}
