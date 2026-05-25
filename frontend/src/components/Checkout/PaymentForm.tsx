import { zodResolver } from "@hookform/resolvers/zod"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { useNavigate } from "@tanstack/react-router"
import { useState } from "react"
import { useForm } from "react-hook-form"
import { z } from "zod"

import {
  type OrderPay,
  ordersPayOrder,
  paymentCardsReadPaymentCards,
} from "@/client"
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { LoadingButton } from "@/components/ui/loading-button"
import { MaskedInput } from "@/components/ui/masked-input"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
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

const NEW_CARD = "new"

function cardLabel(last4: string, m: number, y: number): string {
  const mm = String(m).padStart(2, "0")
  const yy = String(y).slice(-2)
  return `•••• ${last4} · ${mm}/${yy}`
}

export function PaymentForm({ orderId }: { orderId: string }) {
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const { showSuccessToast, showErrorToast } = useCustomToast()
  const [selected, setSelected] = useState<string>(NEW_CARD)
  const [saveCard, setSaveCard] = useState(true)

  const { data: cards = [] } = useQuery({
    queryKey: ["payment-cards"],
    queryFn: async () =>
      (await paymentCardsReadPaymentCards()).data?.data ?? [],
  })

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
    mutationFn: (body: OrderPay) =>
      ordersPayOrder({ path: { id: orderId }, body }),
    onSuccess: () => {
      showSuccessToast("Оплата прошла успешно")
      queryClient.invalidateQueries({ queryKey: ["orders"] })
      queryClient.invalidateQueries({ queryKey: ["payment-cards"] })
      navigate({ to: "/account" })
    },
    onError: handleError.bind(showErrorToast),
  })

  const paySaved = () => mutation.mutate({ card_id: selected })

  const payNew = (data: CardForm) => {
    const [mm, yy] = data.expiry.split("/")
    mutation.mutate({
      card: {
        card_number: data.card_number.replace(/\s/g, ""),
        exp_month: Number(mm),
        exp_year: 2000 + Number(yy),
        cvc: data.cvc,
        cardholder_name: data.cardholder_name,
      },
      save_card: saveCard,
    })
  }

  return (
    <div className="space-y-4 rounded-md border p-4">
      <h2 className="text-lg font-semibold">Оплата картой</h2>

      {cards.length > 0 && (
        <RadioGroup
          value={selected}
          onValueChange={setSelected}
          className="space-y-2"
        >
          {cards.map((c) => (
            <Label
              key={c.id}
              className="flex cursor-pointer items-center gap-3 rounded-md border p-3"
            >
              <RadioGroupItem value={c.id} />
              <span>{cardLabel(c.last4, c.exp_month, c.exp_year)}</span>
            </Label>
          ))}
          <Label className="flex cursor-pointer items-center gap-3 rounded-md border p-3">
            <RadioGroupItem value={NEW_CARD} />
            <span>Новая карта</span>
          </Label>
        </RadioGroup>
      )}

      {selected === NEW_CARD ? (
        <Form {...form}>
          <form onSubmit={form.handleSubmit(payNew)} className="space-y-4">
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
                        autoComplete="cc-csc"
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
                    <Input
                      placeholder="IVAN IVANOV"
                      autoComplete="cc-name"
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <Label className="flex cursor-pointer items-center gap-2">
              <input
                type="checkbox"
                checked={saveCard}
                onChange={(e) => setSaveCard(e.target.checked)}
                className="size-4 accent-[color:var(--accent)]"
              />
              <span>Сохранить карту</span>
            </Label>
            <LoadingButton
              type="submit"
              className="w-full"
              size="lg"
              loading={mutation.isPending}
            >
              Оплатить
            </LoadingButton>
          </form>
        </Form>
      ) : (
        <LoadingButton
          type="button"
          className="w-full"
          size="lg"
          loading={mutation.isPending}
          onClick={paySaved}
        >
          Оплатить
        </LoadingButton>
      )}
    </div>
  )
}
