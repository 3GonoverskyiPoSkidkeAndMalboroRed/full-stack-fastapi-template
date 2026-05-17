import { zodResolver } from "@hookform/resolvers/zod"
import { useMutation, useQueryClient } from "@tanstack/react-query"
import { useNavigate } from "@tanstack/react-router"
import { useForm } from "react-hook-form"
import { z } from "zod"

import { ordersCreateOrder } from "@/client"
import { Button } from "@/components/ui/button"
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form"
import { Input } from "@/components/ui/input"
import useCustomToast from "@/hooks/useCustomToast"
import { handleError } from "@/utils"

const formSchema = z.object({
  recipient_name: z.string().min(2, "Минимум 2 символа").max(255),
  phone: z
    .string()
    .min(6, "Минимум 6 символов")
    .max(32)
    .regex(/^\+?[\d\s\-()]{6,32}$/, "Неверный формат телефона"),
  address: z.string().min(5, "Минимум 5 символов").max(1024),
  comment: z.string().max(2000).optional(),
})

type FormValues = z.infer<typeof formSchema>

export function CheckoutForm() {
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const { showSuccessToast, showErrorToast } = useCustomToast()

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    mode: "onBlur",
    defaultValues: {
      recipient_name: "",
      phone: "",
      address: "",
      comment: "",
    },
  })

  const mutation = useMutation({
    mutationFn: (data: FormValues) =>
      ordersCreateOrder({
        body: {
          recipient_name: data.recipient_name,
          phone: data.phone,
          address: data.address,
          comment: data.comment ? data.comment : null,
        },
      }),
    onSuccess: () => {
      showSuccessToast("Заказ оформлен")
      queryClient.invalidateQueries({ queryKey: ["cart"] })
      queryClient.invalidateQueries({ queryKey: ["orders"] })
      navigate({ to: "/account" })
    },
    onError: handleError.bind(showErrorToast),
  })

  const onSubmit = (data: FormValues) => mutation.mutate(data)

  return (
    <Form {...form}>
      <form
        onSubmit={form.handleSubmit(onSubmit)}
        className="space-y-4 rounded-md border p-4"
      >
        <h2 className="text-lg font-semibold">Данные доставки</h2>
        <FormField
          control={form.control}
          name="recipient_name"
          render={({ field }) => (
            <FormItem>
              <FormLabel>ФИО получателя</FormLabel>
              <FormControl>
                <Input placeholder="Иван Иванов" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="phone"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Телефон</FormLabel>
              <FormControl>
                <Input placeholder="+7 (___) ___-__-__" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="address"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Адрес доставки</FormLabel>
              <FormControl>
                <Input placeholder="г. Москва, ул., д., кв." {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="comment"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Комментарий (опц.)</FormLabel>
              <FormControl>
                <Input placeholder="Удобное время и пр." {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <Button
          type="submit"
          className="w-full"
          size="lg"
          disabled={mutation.isPending}
        >
          Оформить заказ
        </Button>
      </form>
    </Form>
  )
}
