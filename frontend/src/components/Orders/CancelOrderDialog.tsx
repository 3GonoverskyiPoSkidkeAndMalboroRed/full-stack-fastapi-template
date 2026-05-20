import { useMutation, useQueryClient } from "@tanstack/react-query"
import { useState } from "react"

import { ordersCancelOrder } from "@/client"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Label } from "@/components/ui/label"
import { LoadingButton } from "@/components/ui/loading-button"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import { Textarea } from "@/components/ui/textarea"
import useCustomToast from "@/hooks/useCustomToast"
import { handleError } from "@/utils"

interface CancelOrderDialogProps {
  orderId: string
  open: boolean
  onOpenChange: (open: boolean) => void
}

const PRESET_REASONS = [
  "Передумал(а) покупать",
  "Нашёл(ла) дешевле в другом магазине",
  "Не подошёл размер/модель",
  "Слишком долгая доставка",
] as const

const OTHER = "__other__"

export function CancelOrderDialog({
  orderId,
  open,
  onOpenChange,
}: CancelOrderDialogProps) {
  const queryClient = useQueryClient()
  const { showSuccessToast, showErrorToast } = useCustomToast()
  const [selected, setSelected] = useState<string>(PRESET_REASONS[0])
  const [otherText, setOtherText] = useState("")

  const mutation = useMutation({
    mutationFn: (reason: string) =>
      ordersCancelOrder({ path: { id: orderId }, body: { reason } }),
    onSuccess: () => {
      showSuccessToast("Заказ отменён")
      queryClient.invalidateQueries({ queryKey: ["orders"] })
      onOpenChange(false)
    },
    onError: handleError.bind(showErrorToast),
  })

  const reset = () => {
    setSelected(PRESET_REASONS[0])
    setOtherText("")
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    const reason = selected === OTHER ? otherText.trim() : selected
    if (!reason) return
    mutation.mutate(reason)
  }

  const isOther = selected === OTHER
  const submitDisabled =
    mutation.isPending || (isOther && otherText.trim().length === 0)

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        if (!o) reset()
        onOpenChange(o)
      }}
    >
      <DialogContent>
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle>Отмена заказа</DialogTitle>
            <DialogDescription>
              Выберите причину отмены — это поможет нам улучшить сервис.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <RadioGroup value={selected} onValueChange={setSelected}>
              {PRESET_REASONS.map((reason) => (
                <div key={reason} className="flex items-center gap-3">
                  <RadioGroupItem value={reason} id={`reason-${reason}`} />
                  <Label htmlFor={`reason-${reason}`} className="font-normal">
                    {reason}
                  </Label>
                </div>
              ))}
              <div className="flex items-center gap-3">
                <RadioGroupItem value={OTHER} id="reason-other" />
                <Label htmlFor="reason-other" className="font-normal">
                  Другое
                </Label>
              </div>
            </RadioGroup>

            {isOther && (
              <Textarea
                placeholder="Опишите причину"
                rows={3}
                value={otherText}
                onChange={(e) => setOtherText(e.target.value)}
                maxLength={500}
                autoFocus
              />
            )}
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={mutation.isPending}
            >
              Назад
            </Button>
            <LoadingButton
              type="submit"
              variant="destructive"
              loading={mutation.isPending}
              disabled={submitDisabled}
            >
              Отменить заказ
            </LoadingButton>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
