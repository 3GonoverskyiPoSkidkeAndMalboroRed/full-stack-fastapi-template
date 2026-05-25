import { zodResolver } from "@hookform/resolvers/zod"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { CreditCard, Plus, Trash2 } from "lucide-react"
import { useState } from "react"
import { useForm } from "react-hook-form"
import { z } from "zod"

import {
  type PaymentCardCreate,
  type PaymentCardPublic,
  paymentCardsCreatePaymentCard,
  paymentCardsDeletePaymentCard,
  paymentCardsReadPaymentCards,
} from "@/client"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form"
import { Input } from "@/components/ui/input"
import { LoadingButton } from "@/components/ui/loading-button"
import { MaskedInput } from "@/components/ui/masked-input"
import useCustomToast from "@/hooks/useCustomToast"
import { handleError } from "@/utils"

const cardSchema = z.object({
  card_number: z.string().min(1, "Введите номер карты"),
  expiry: z.string().regex(/^\d{2}\/\d{2}$/, "Формат ММ/ГГ"),
  cvc: z.string().min(1, "Введите CVC"),
  cardholder_name: z
    .string()
    .regex(/^[A-Za-z][A-Za-z .'-]*$/, "Имя и фамилия — латиницей"),
})

type CardForm = z.infer<typeof cardSchema>

function cardLabel(card: PaymentCardPublic): string {
  const mm = String(card.exp_month).padStart(2, "0")
  const yy = String(card.exp_year).slice(-2)
  return `•••• ${card.last4} · ${mm}/${yy}`
}

function AddCardDialog() {
  const [open, setOpen] = useState(false)
  const queryClient = useQueryClient()
  const { showSuccessToast, showErrorToast } = useCustomToast()

  const form = useForm<CardForm>({
    resolver: zodResolver(cardSchema),
    mode: "onBlur",
    defaultValues: {
      card_number: "",
      expiry: "",
      cvc: "",
      cardholder_name: "",
    },
  })

  const mutation = useMutation({
    mutationFn: (body: PaymentCardCreate) =>
      paymentCardsCreatePaymentCard({ body }),
    onSuccess: () => {
      showSuccessToast("Карта сохранена")
      form.reset()
      setOpen(false)
    },
    onError: handleError.bind(showErrorToast),
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ["payment-cards"] })
    },
  })

  const onSubmit = (data: CardForm) => {
    const [mm, yy] = data.expiry.split("/")
    mutation.mutate({
      card_number: data.card_number.replace(/\s/g, ""),
      exp_month: Number(mm),
      exp_year: 2000 + Number(yy),
      cvc: data.cvc,
      cardholder_name: data.cardholder_name,
    })
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button>
          <Plus className="mr-2" />
          Добавить карту
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Добавить карту</DialogTitle>
          <DialogDescription>
            Сохраняются только маскированные данные (бренд, последние 4 цифры,
            срок, имя). Полный номер и CVC не хранятся.
          </DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="card_number"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Номер карты</FormLabel>
                  <FormControl>
                    <MaskedInput
                      mask="0000 0000 0000 0000"
                      placeholder="0000 0000 0000 0000"
                      inputMode="numeric"
                      value={field.value}
                      onAccept={field.onChange}
                      onBlur={field.onBlur}
                      name={field.name}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <div className="grid grid-cols-2 gap-3">
              <FormField
                control={form.control}
                name="expiry"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Срок (ММ/ГГ)</FormLabel>
                    <FormControl>
                      <MaskedInput
                        mask="00/00"
                        placeholder="ММ/ГГ"
                        inputMode="numeric"
                        value={field.value}
                        onAccept={field.onChange}
                        onBlur={field.onBlur}
                        name={field.name}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="cvc"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>CVC</FormLabel>
                    <FormControl>
                      <Input
                        placeholder="123"
                        inputMode="numeric"
                        maxLength={4}
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>
            <FormField
              control={form.control}
              name="cardholder_name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Имя на карте (латиницей)</FormLabel>
                  <FormControl>
                    <Input placeholder="IVAN IVANOV" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <DialogFooter>
              <DialogClose asChild>
                <Button variant="outline" disabled={mutation.isPending}>
                  Отмена
                </Button>
              </DialogClose>
              <LoadingButton type="submit" loading={mutation.isPending}>
                Сохранить
              </LoadingButton>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  )
}

function DeleteCardButton({ card }: { card: PaymentCardPublic }) {
  const [open, setOpen] = useState(false)
  const queryClient = useQueryClient()
  const { showSuccessToast, showErrorToast } = useCustomToast()

  const mutation = useMutation({
    mutationFn: () => paymentCardsDeletePaymentCard({ path: { id: card.id } }),
    onSuccess: () => {
      showSuccessToast("Карта удалена")
      setOpen(false)
    },
    onError: handleError.bind(showErrorToast),
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ["payment-cards"] })
    },
  })

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="size-8"
          aria-label="Удалить карту"
        >
          <Trash2 className="size-4" />
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Удалить карту</DialogTitle>
          <DialogDescription>
            Карта {cardLabel(card)} будет удалена. Продолжить?
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <DialogClose asChild>
            <Button variant="outline" disabled={mutation.isPending}>
              Отмена
            </Button>
          </DialogClose>
          <LoadingButton
            variant="destructive"
            loading={mutation.isPending}
            onClick={() => mutation.mutate()}
          >
            Удалить
          </LoadingButton>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

const UserCards = () => {
  const { data: cards = [] } = useQuery({
    queryKey: ["payment-cards"],
    queryFn: async () =>
      (await paymentCardsReadPaymentCards()).data?.data ?? [],
  })

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold">Мои карты</h3>
        <AddCardDialog />
      </div>
      {cards.length === 0 ? (
        <p className="text-muted-foreground text-sm">
          Сохранённых карт пока нет.
        </p>
      ) : (
        <div className="space-y-2">
          {cards.map((card) => (
            <div
              key={card.id}
              className="flex items-center justify-between gap-3 rounded-md border p-3"
            >
              <span className="flex items-center gap-3">
                <CreditCard className="text-muted-foreground size-5" />
                <span>{cardLabel(card)}</span>
              </span>
              <DeleteCardButton card={card} />
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

export default UserCards
