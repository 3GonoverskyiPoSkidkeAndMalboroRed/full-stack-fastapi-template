import { useEffect, useState } from "react"

import { ProductLightbox } from "@/components/Catalog/ProductLightbox"
import {
  Carousel,
  type CarouselApi,
  CarouselContent,
  CarouselItem,
  CarouselNext,
  CarouselPrevious,
} from "@/components/ui/carousel"
import { getPhotoUrl, PLACEHOLDER_IMAGE } from "@/lib/photo"
import { cn } from "@/lib/utils"

interface ProductGalleryProps {
  images: string[]
  title: string
}

export function ProductGallery({ images, title }: ProductGalleryProps) {
  const [api, setApi] = useState<CarouselApi | undefined>(undefined)
  const [current, setCurrent] = useState(0)
  const [lightboxOpen, setLightboxOpen] = useState(false)

  useEffect(() => {
    if (!api) return
    const update = () => setCurrent(api.selectedScrollSnap())
    update()
    api.on("select", update)
    return () => {
      api.off("select", update)
    }
  }, [api])

  if (images.length === 0) {
    return (
      <div className="bg-soft aspect-square overflow-hidden">
        <img
          src={PLACEHOLDER_IMAGE}
          alt={title}
          className="h-full w-full object-contain"
        />
      </div>
    )
  }

  return (
    <div className="space-y-3">
      <Carousel setApi={setApi} className="relative">
        <CarouselContent>
          {images.map((src, index) => (
            <CarouselItem key={src}>
              <button
                type="button"
                onClick={() => setLightboxOpen(true)}
                className="bg-soft block aspect-square w-full overflow-hidden"
              >
                <img
                  src={getPhotoUrl(src)}
                  alt={`${title} — ${index + 1}`}
                  className="h-full w-full cursor-zoom-in object-contain"
                />
              </button>
            </CarouselItem>
          ))}
        </CarouselContent>
        {images.length > 1 && (
          <>
            <CarouselPrevious className="left-2" />
            <CarouselNext className="right-2" />
          </>
        )}
      </Carousel>
      {images.length > 1 && (
        <div className="flex flex-wrap gap-2">
          {images.map((src, index) => (
            <button
              key={src}
              type="button"
              onClick={() => api?.scrollTo(index)}
              aria-label={`Фото ${index + 1}`}
              className={cn(
                "bg-soft size-16 overflow-hidden border-2 transition-colors",
                index === current
                  ? "border-ink"
                  : "border-transparent opacity-70 hover:opacity-100",
              )}
            >
              <img
                src={getPhotoUrl(src)}
                alt=""
                className="h-full w-full object-contain"
              />
            </button>
          ))}
        </div>
      )}
      <ProductLightbox
        images={images}
        title={title}
        open={lightboxOpen}
        onOpenChange={setLightboxOpen}
        initialIndex={current}
      />
    </div>
  )
}
