import { useMutation, useQueryClient } from "@tanstack/react-query"
import { Loader2, Trash2, Upload } from "lucide-react"
import { type ChangeEvent, useId, useRef, useState } from "react"

import { Button } from "@/components/ui/button"
import useCustomToast from "@/hooks/useCustomToast"
import { deleteItemPhoto, getPhotoUrl, uploadItemPhotos } from "@/lib/photo"
import { handleError } from "@/utils"

interface ImageUploaderProps {
  itemId: string
  currentImages: string[]
  onImagesChange?: (images: string[]) => void
}

const ACCEPT = "image/jpeg,image/png,image/webp"

export function ImageUploader({
  itemId,
  currentImages,
  onImagesChange,
}: ImageUploaderProps) {
  const queryClient = useQueryClient()
  const inputRef = useRef<HTMLInputElement>(null)
  const inputId = useId()
  const [dragActive, setDragActive] = useState(false)
  const { showSuccessToast, showErrorToast } = useCustomToast()

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ["items"] })
    queryClient.invalidateQueries({ queryKey: ["item", itemId] })
  }

  const upload = useMutation({
    mutationFn: (files: File[]) => uploadItemPhotos(itemId, files),
    onSuccess: (item) => {
      onImagesChange?.(item.images ?? [])
      showSuccessToast("Фото загружены")
      invalidate()
    },
    onError: handleError.bind(showErrorToast),
  })

  const remove = useMutation({
    mutationFn: (path: string) => deleteItemPhoto(itemId, path),
    onSuccess: (item) => {
      onImagesChange?.(item.images ?? [])
      showSuccessToast("Фото удалено")
      invalidate()
    },
    onError: handleError.bind(showErrorToast),
  })

  const handleFiles = (files: FileList | null) => {
    if (!files || files.length === 0) return
    upload.mutate(Array.from(files))
  }

  const onSelect = (e: ChangeEvent<HTMLInputElement>) => {
    handleFiles(e.target.files)
    e.target.value = ""
  }

  return (
    <div className="space-y-3">
      <label
        htmlFor={inputId}
        onDragOver={(e) => {
          e.preventDefault()
          setDragActive(true)
        }}
        onDragLeave={() => setDragActive(false)}
        onDrop={(e) => {
          e.preventDefault()
          setDragActive(false)
          handleFiles(e.dataTransfer.files)
        }}
        className={
          "text-muted-foreground hover:bg-muted/40 flex cursor-pointer flex-col items-center justify-center gap-2 rounded-lg border-2 border-dashed p-6 text-sm transition-colors " +
          (dragActive ? "border-primary bg-muted/40" : "border-input")
        }
      >
        {upload.isPending ? (
          <Loader2 className="size-6 animate-spin" />
        ) : (
          <Upload className="size-6" />
        )}
        <span>
          {upload.isPending
            ? "Загрузка..."
            : "Перетащите фото или нажмите для выбора"}
        </span>
        <span className="text-xs">JPEG, PNG, WebP — до 5 МБ каждое</span>
        <input
          id={inputId}
          ref={inputRef}
          type="file"
          accept={ACCEPT}
          multiple
          onChange={onSelect}
          className="hidden"
        />
      </label>

      {currentImages.length > 0 && (
        <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
          {currentImages.map((path) => (
            <div
              key={path}
              className="group bg-muted relative aspect-square overflow-hidden rounded-md border"
            >
              <img
                src={getPhotoUrl(path)}
                alt=""
                className="h-full w-full object-cover"
              />
              <Button
                type="button"
                variant="destructive"
                size="icon"
                onClick={() => remove.mutate(path)}
                disabled={remove.isPending}
                className="absolute top-1 right-1 size-7 opacity-0 transition-opacity group-hover:opacity-100"
                aria-label="Удалить фото"
              >
                <Trash2 className="size-3.5" />
              </Button>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
