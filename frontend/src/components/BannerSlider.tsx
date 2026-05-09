import { useEffect, useState, useCallback, useRef } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';

interface Banner { id: number; image_url: string; caption: string | null; sort_order: number; }

interface Props {
  banners: Banner[];
  autoPlayMs?: number;
}

export default function BannerSlider({ banners, autoPlayMs = 4000 }: Props) {
  const [current, setCurrent] = useState(0);
  const [animating, setAnimating] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const go = useCallback((idx: number) => {
    if (animating || banners.length < 2) return;
    setAnimating(true);
    setTimeout(() => {
      setCurrent((idx + banners.length) % banners.length);
      setAnimating(false);
    }, 300);
  }, [animating, banners.length]);

  const next = useCallback(() => go(current + 1), [go, current]);
  const prev = useCallback(() => go(current - 1), [go, current]);

  // Auto-play
  useEffect(() => {
    if (banners.length < 2) return;
    timerRef.current = setTimeout(next, autoPlayMs);
    return () => { if (timerRef.current) clearTimeout(timerRef.current); };
  }, [current, next, autoPlayMs, banners.length]);

  if (banners.length === 0) return null;

  const slide = banners[current];

  return (
    <div className="relative w-full overflow-hidden bg-gray-900 select-none"
         style={{ height: 'clamp(260px, 45vw, 520px)' }}>

      {/* Slide image */}
      <img
        key={slide.id}
        src={slide.image_url}
        alt={slide.caption || 'Banner'}
        className={`absolute inset-0 w-full h-full object-cover transition-opacity duration-500 ${animating ? 'opacity-0' : 'opacity-100'}`}
      />

      {/* Dark gradient overlay */}
      <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-black/10 to-transparent" />

      {/* Caption */}
      {slide.caption && (
        <div className={`absolute bottom-14 left-0 right-0 text-center px-6 transition-all duration-500 ${animating ? 'opacity-0 translate-y-2' : 'opacity-100 translate-y-0'}`}>
          <p className="text-white text-lg sm:text-2xl font-semibold drop-shadow-lg">{slide.caption}</p>
        </div>
      )}

      {/* Prev / Next arrows */}
      {banners.length > 1 && (
        <>
          <button
            onClick={prev}
            className="absolute left-3 top-1/2 -translate-y-1/2 bg-black/40 hover:bg-black/70 text-white rounded-full p-2 transition-colors backdrop-blur-sm"
            aria-label="Previous"
          >
            <ChevronLeft size={24} />
          </button>
          <button
            onClick={next}
            className="absolute right-3 top-1/2 -translate-y-1/2 bg-black/40 hover:bg-black/70 text-white rounded-full p-2 transition-colors backdrop-blur-sm"
            aria-label="Next"
          >
            <ChevronRight size={24} />
          </button>
        </>
      )}

      {/* Dot indicators */}
      {banners.length > 1 && (
        <div className="absolute bottom-4 left-0 right-0 flex justify-center gap-2">
          {banners.map((_, i) => (
            <button
              key={i}
              onClick={() => go(i)}
              className={`rounded-full transition-all duration-300 ${i === current ? 'bg-white w-5 h-2' : 'bg-white/50 w-2 h-2 hover:bg-white/75'}`}
              aria-label={`Go to slide ${i + 1}`}
            />
          ))}
        </div>
      )}

      {/* Slide counter */}
      {banners.length > 1 && (
        <div className="absolute top-3 right-3 bg-black/40 text-white text-xs px-2 py-1 rounded-full backdrop-blur-sm">
          {current + 1} / {banners.length}
        </div>
      )}
    </div>
  );
}
