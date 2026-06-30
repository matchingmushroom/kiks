"use client";

import { useRef, useState, useEffect, useCallback, Children, ReactNode } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";

interface CarouselProps {
  children: ReactNode[];
  autoPlay?: boolean;
  interval?: number;
  showDots?: boolean;
  showArrows?: boolean;
  className?: string;
}

export default function Carousel({
  children,
  autoPlay = true,
  interval = 4000,
  showDots = true,
  showArrows = true,
  className = "",
}: CarouselProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [current, setCurrent] = useState(0);
  const [isDragging, setIsDragging] = useState(false);
  const startX = useRef(0);
  const scrollLeft = useRef(0);
  const items = Children.toArray(children);
  const total = items.length;

  const scrollTo = useCallback((index: number) => {
    const container = containerRef.current;
    if (!container) return;
    container.scrollTo({ left: index * container.clientWidth, behavior: "smooth" });
    setCurrent(index);
  }, []);

  const next = useCallback(() => scrollTo((current + 1) % total), [current, total, scrollTo]);
  const prev = useCallback(() => scrollTo((current - 1 + total) % total), [current, total, scrollTo]);

  useEffect(() => {
    if (!autoPlay || total <= 1) return;
    const timer = setInterval(next, interval);
    return () => clearInterval(timer);
  }, [autoPlay, interval, next, total]);

  const handleScroll = useCallback(() => {
    const container = containerRef.current;
    if (!container || isDragging) return;
    const idx = Math.round(container.scrollLeft / container.clientWidth);
    if (idx !== current) setCurrent(idx);
  }, [current, isDragging]);

  const onTouchStart = (e: React.TouchEvent) => {
    startX.current = e.touches[0].pageX;
    scrollLeft.current = containerRef.current?.scrollLeft || 0;
    setIsDragging(true);
  };
  const onTouchMove = (e: React.TouchEvent) => {
    if (!isDragging) return;
    const x = e.touches[0].pageX;
    const walk = (startX.current - x) * 1.5;
    if (containerRef.current) {
      containerRef.current.scrollLeft = scrollLeft.current + walk;
    }
  };
  const onTouchEnd = () => {
    setIsDragging(false);
    handleScroll();
  };

  const onMouseDown = (e: React.MouseEvent) => {
    startX.current = e.pageX;
    scrollLeft.current = containerRef.current?.scrollLeft || 0;
    setIsDragging(true);
  };
  const onMouseMove = (e: React.MouseEvent) => {
    if (!isDragging) return;
    const walk = (startX.current - e.pageX) * 1.5;
    if (containerRef.current) {
      containerRef.current.scrollLeft = scrollLeft.current + walk;
    }
  };
  const onMouseUp = () => {
    setIsDragging(false);
    handleScroll();
  };

  if (total === 0) return null;

  return (
    <div className={`relative group w-full max-w-full overflow-hidden ${className}`}>
      <div
        ref={containerRef}
        onScroll={handleScroll}
        onTouchStart={onTouchStart}
        onTouchMove={onTouchMove}
        onTouchEnd={onTouchEnd}
        onMouseDown={onMouseDown}
        onMouseMove={onMouseMove}
        onMouseUp={onMouseUp}
        onMouseLeave={onMouseUp}
        className="flex overflow-x-auto snap-x snap-mandatory scroll-smooth no-scrollbar cursor-grab active:cursor-grabbing"
        style={{ scrollbarWidth: "none", msOverflowStyle: "none" }}
      >
        {items.map((child, i) => (
          <div key={i} className="min-w-full snap-start shrink-0">
            {child}
          </div>
        ))}
      </div>

      {showArrows && total > 1 && (
        <>
          <button
            onClick={(e) => { e.stopPropagation(); prev(); }}
            className="absolute left-2 top-1/2 -translate-y-1/2 z-10 bg-white/80 hover:bg-white text-secondary rounded-full p-2 shadow-md opacity-0 group-hover:opacity-100 transition-opacity hidden sm:block"
          >
            <ChevronLeft className="h-5 w-5" />
          </button>
          <button
            onClick={(e) => { e.stopPropagation(); next(); }}
            className="absolute right-2 top-1/2 -translate-y-1/2 z-10 bg-white/80 hover:bg-white text-secondary rounded-full p-2 shadow-md opacity-0 group-hover:opacity-100 transition-opacity hidden sm:block"
          >
            <ChevronRight className="h-5 w-5" />
          </button>
        </>
      )}

      {showDots && total > 1 && (
        <div className="absolute bottom-3 left-1/2 -translate-x-1/2 z-10 flex gap-1.5">
          {items.map((_, i) => (
            <button
              key={i}
              onClick={() => scrollTo(i)}
              className={`w-2 h-2 rounded-full transition-all ${
                i === current ? "bg-white w-4" : "bg-white/50 hover:bg-white/80"
              }`}
            />
          ))}
        </div>
      )}
    </div>
  );
}
