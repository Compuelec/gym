import { useEffect, useState } from 'react';
import { Dumbbell } from 'lucide-react';
import type { Media } from '@gym/shared';

/** Start and end positions shown alternately, like a slow animation. */
export function ExerciseImages({ media, alt }: { media: Media[]; alt: string }) {
  const images = media.filter((m) => m.type === 'image');
  const [frame, setFrame] = useState(0);
  useEffect(() => {
    if (images.length < 2) return;
    const id = setInterval(() => setFrame((f) => (f + 1) % images.length), 1200);
    return () => clearInterval(id);
  }, [images.length]);
  if (images.length === 0) {
    return (
      <div className="flex aspect-[4/3] items-center justify-center rounded-lg bg-muted text-muted-foreground">
        <Dumbbell className="size-10" aria-hidden />
      </div>
    );
  }
  return (
    <div className="relative aspect-[4/3] overflow-hidden rounded-lg bg-muted">
      {images.map((img, i) => (
        <img
          key={img.url}
          src={img.url}
          alt={i === 0 ? alt : ''}
          className={`absolute inset-0 size-full object-contain transition-opacity duration-500 ${i === frame ? 'opacity-100' : 'opacity-0'}`}
        />
      ))}
    </div>
  );
}

export function Thumbnail({ media }: { media: Media[] }) {
  const first = media.find((m) => m.type === 'image');
  if (!first) {
    return (
      <div className="flex size-16 shrink-0 items-center justify-center rounded-md bg-muted text-muted-foreground">
        <Dumbbell className="size-6" aria-hidden />
      </div>
    );
  }
  return <img src={first.url} alt="" loading="lazy" className="size-16 shrink-0 rounded-md bg-muted object-cover" />;
}
