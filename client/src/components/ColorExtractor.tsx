import { useState, useEffect, useCallback } from 'react';
import { X, Copy, Check, Download } from 'lucide-react';
import { BoardImage, API_BASE_URL } from '../api';

interface ColorExtractorProps {
  image: BoardImage;
  onClose: () => void;
}

interface ColorSwatch {
  hex: string;
  count: number;
}

export const ColorExtractor = ({ image, onClose }: ColorExtractorProps) => {
  const [colors, setColors] = useState<ColorSwatch[]>([]);
  const [copiedIndex, setCopiedIndex] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);

  const extractColors = useCallback(async () => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.src = `${API_BASE_URL}${image.url}`;

    img.onload = () => {
      const canvas = document.createElement('canvas');
      const size = 100;
      canvas.width = size;
      canvas.height = size;
      const ctx = canvas.getContext('2d')!;
      ctx.drawImage(img, 0, 0, size, size);

      const imageData = ctx.getImageData(0, 0, size, size);
      const pixels: [number, number, number][] = [];

      for (let i = 0; i < imageData.data.length; i += 4) {
        pixels.push([imageData.data[i], imageData.data[i + 1], imageData.data[i + 2]]);
      }

      const palette = medianCut(pixels, 6);
      setColors(palette);
      setLoading(false);
    };

    img.onerror = () => setLoading(false);
  }, [image.url]);

  useEffect(() => {
    extractColors();
  }, [extractColors]);

  const copyHex = (hex: string, index: number) => {
    navigator.clipboard.writeText(hex);
    setCopiedIndex(index);
    setTimeout(() => setCopiedIndex(null), 1500);
  };

  const exportPalette = () => {
    const data = {
      imageUrl: image.url,
      tags: image.tags.map(t => t.term),
      colors: colors.map(c => c.hex),
    };
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `palette-${image.id}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="fixed bottom-24 right-24 z-[60] bg-white dark:bg-neutral-800 rounded-sm shadow-2xl border border-neutral-200 dark:border-neutral-700 w-64 overflow-hidden">
      <div className="flex items-center justify-between px-3 py-2 border-b border-neutral-100 dark:border-neutral-700">
        <span className="text-xs font-semibold text-neutral-700 dark:text-stone-300 uppercase tracking-wide">
          Color Palette
        </span>
        <button onClick={onClose} className="text-neutral-400 hover:text-neutral-600 dark:hover:text-stone-200">
          <X className="w-4 h-4" />
        </button>
      </div>

      <div className="p-3">
        {loading ? (
          <div className="flex items-center justify-center py-4">
            <div className="w-5 h-5 border-2 border-neutral-300 border-t-neutral-600 rounded-full animate-spin" />
          </div>
        ) : (
          <div className="grid grid-cols-3 gap-2">
            {colors.map((color, i) => (
              <button
                key={i}
                onClick={() => copyHex(color.hex, i)}
                className="flex flex-col items-center gap-1 group"
                title={`Copy ${color.hex}`}
              >
                <div
                  className="w-full aspect-square rounded-sm shadow-sm border border-neutral-200 dark:border-neutral-600 group-hover:scale-110 transition-transform"
                  style={{ backgroundColor: color.hex }}
                />
                <span className="text-[9px] font-mono text-neutral-500 dark:text-stone-400 flex items-center gap-0.5">
                  {copiedIndex === i ? (
                    <><Check className="w-2.5 h-2.5 text-green-500" /> Copied</>
                  ) : (
                    <><Copy className="w-2.5 h-2.5 opacity-0 group-hover:opacity-100" /> {color.hex}</>
                  )}
                </span>
              </button>
            ))}
          </div>
        )}
      </div>

      {!loading && colors.length > 0 && (
        <div className="px-3 pb-3">
          <button
            onClick={exportPalette}
            className="w-full flex items-center justify-center gap-1.5 px-3 py-1.5 text-xs font-medium bg-neutral-100 dark:bg-neutral-700 text-neutral-700 dark:text-stone-300 hover:bg-neutral-200 dark:hover:bg-neutral-600 rounded-sm transition-colors"
          >
            <Download className="w-3.5 h-3.5" />
            Export Palette
          </button>
        </div>
      )}
    </div>
  );
};

// Median-cut color quantization
function medianCut(pixels: [number, number, number][], maxColors: number): ColorSwatch[] {
  if (pixels.length === 0) return [];

  type Bucket = [number, number, number][];

  function getRange(bucket: Bucket): [number, number, number] {
    let rMin = 255, rMax = 0, gMin = 255, gMax = 0, bMin = 255, bMax = 0;
    for (const [r, g, b] of bucket) {
      if (r < rMin) rMin = r; if (r > rMax) rMax = r;
      if (g < gMin) gMin = g; if (g > gMax) gMax = g;
      if (b < bMin) bMin = b; if (b > bMax) bMax = b;
    }
    return [rMax - rMin, gMax - gMin, bMax - bMin];
  }

  function splitBucket(bucket: Bucket): [Bucket, Bucket] {
    const [rRange, gRange, bRange] = getRange(bucket);
    let channel: 0 | 1 | 2 = 0;
    if (gRange >= rRange && gRange >= bRange) channel = 1;
    else if (bRange >= rRange && bRange >= gRange) channel = 2;

    bucket.sort((a, b) => a[channel] - b[channel]);
    const mid = Math.floor(bucket.length / 2);
    return [bucket.slice(0, mid), bucket.slice(mid)];
  }

  function average(bucket: Bucket): ColorSwatch {
    let r = 0, g = 0, b = 0;
    for (const [pr, pg, pb] of bucket) { r += pr; g += pg; b += pb; }
    const n = bucket.length;
    const hex = '#' + [Math.round(r / n), Math.round(g / n), Math.round(b / n)]
      .map(v => v.toString(16).padStart(2, '0')).join('');
    return { hex, count: n };
  }

  let buckets: Bucket[] = [pixels];

  while (buckets.length < maxColors) {
    // Split the bucket with the largest range
    let maxRange = 0;
    let maxIndex = 0;
    for (let i = 0; i < buckets.length; i++) {
      const range = getRange(buckets[i]);
      const total = Math.max(...range);
      if (total > maxRange) { maxRange = total; maxIndex = i; }
    }
    if (maxRange === 0) break;
    const [a, b] = splitBucket(buckets[maxIndex]);
    buckets.splice(maxIndex, 1, a, b);
  }

  return buckets
    .filter(b => b.length > 0)
    .map(average)
    .sort((a, b) => b.count - a.count);
}
