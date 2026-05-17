import { X } from "lucide-react"
import { useEffect, useState } from "react"
import { TransformComponent, TransformWrapper } from "react-zoom-pan-pinch"

import {
  Carousel,
  type CarouselApi,
  CarouselContent,
  CarouselItem,
  CarouselNext,
  CarouselPrevious,
} from "@/components/ui/carousel"
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog"
import { getPhotoUrl } from "@/lib/photo"

interface ProductLightboxProps {
  images: string[]
  title: string
  open: boolean
  onOpenChange: (open: boolean) => void
  initialIndex?: number
}

export function ProductLightbox({
  images,
  title,
  open,
  onOpenChange,
  initialIndex = 0,
}: ProductLightboxProps) {
  const [api, setApi] = useState<CarouselApi | undefined>(undefined)

  useEffect(() => {
    if (open && api) {
      api.scrollTo(initialIndex, true)
    }
  }, [open, api, initialIndex])

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        showCloseButton={false}
        className="h-screen w-screen max-w-none rounded-none border-0 bg-black/95 p-0 sm:max-w-none"
      >
        <DialogTitle className="sr-only">{title}</DialogTitle>
        <button
          type="button"
          onClick={() => onOpenChange(false)}
          aria-label="Закрыть"
          className="absolute top-4 right-4 z-50 rounded-full bg-white/10 p-2 text-white transition-colors hover:bg-white/20"
        >
          <X className="size-6" />
        </button>
        <Carousel
          opts={{ startIndex: initialIndex, loop: true }}
          setApi={setApi}
          className="flex h-full w-full items-center"
        >
          <CarouselContent className="h-screen">
            {images.map((src, index) => (
              <CarouselItem
                key={src}
                className="flex h-screen items-center justify-center"
              >
                <TransformWrapper
                  doubleClick={{ mode: "toggle" }}
                  wheel={{ step: 0.2 }}
                  panning={{ velocityDisabled: true }}
                >
                  <TransformComponent
                    wrapperClass="!h-screen !w-screen"
                    contentClass="!h-screen !w-screen flex items-center justify-center"
                  >
                    <img
                      src={getPhotoUrl(src)}
                      alt={`${title} — ${index + 1}`}
                      className="max-h-screen max-w-screen object-contain"
                      draggable={false}
                    />
                  </TransformComponent>
                </TransformWrapper>
              </CarouselItem>
            ))}
          </CarouselContent>
          {images.length > 1 && (
            <>
              <CarouselPrevious className="left-4 size-10 border-white/20 bg-white/10 text-white hover:bg-white/20 hover:text-white" />
              <CarouselNext className="right-4 size-10 border-white/20 bg-white/10 text-white hover:bg-white/20 hover:text-white" />
            </>
          )}
        </Carousel>
      </DialogContent>
    </Dialog>
  )
}
