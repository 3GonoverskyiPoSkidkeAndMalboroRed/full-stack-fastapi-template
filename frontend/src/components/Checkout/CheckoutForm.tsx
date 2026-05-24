import { zodResolver } from "@hookform/resolvers/zod"
import { useMutation, useQueryClient } from "@tanstack/react-query"
import { useNavigate } from "@tanstack/react-router"
import { useEffect } from "react"
import { useForm } from "react-hook-form"
import { z } from "zod"

import {
  ordersCreateOrder,
  type UserUpdateMe,
  usersUpdateUserMe,
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
import { LoadingButton } from "@/components/ui/loading-button"
import { MaskedInput } from "@/components/ui/masked-input"
import useAuth from "@/hooks/useAuth"
import useCustomToast from "@/hooks/useCustomToast"
import { handleError } from "@/utils"

const PHONE_MASK_RE = /^\+7 \(\d{3}\) \d{3}-\d{2}-\d{2}$/

const formSchema = z.object({
  recipient_name: z.string().min(2, "Минимум 2 символа").max(255),
  phone: z
    .string()
    .regex(PHONE_MASK_RE, "Введите телефон в формате +7 (XXX) XXX-XX-XX"),
  address: z.string().min(5, "Минимум 5 символов").max(1024),
  comment: z.string().max(2000).optional(),
})

type FormValues = z.infer<typeof formSchema>

export function CheckoutForm() {
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const { showErrorToast } = useCustomToast()
  const { user } = useAuth()

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    mode: "onBlur",
    defaultValues: {
      recipient_name: user?.full_name ?? "",
      phone: user?.phone ?? "",
      address: user?.delivery_address ?? "",
      comment: "",
    },
  })

  useEffect(() => {
    if (!user) return
    const isPristine = !form.formState.isDirty
    if (!isPristine) return
    form.reset({
      recipient_name: user.full_name ?? "",
      phone: user.phone ?? "",
      address: user.delivery_address ?? "",
      comment: "",
    })
  }, [user, form])

  const syncUserProfile = async (data: FormValues) => {
    if (!user) return
    const patch: UserUpdateMe = {}
    if ((user.full_name ?? "") !== data.recipient_name) {
      patch.full_name = data.recipient_name
    }
    if ((user.phone ?? "") !== data.phone) {
      patch.phone = data.phone
    }
    if ((user.delivery_address ?? "") !== data.address) {
      patch.delivery_address = data.address
    }
    if (Object.keys(patch).length === 0) return
    try {
      await usersUpdateUserMe({ body: patch })
      queryClient.invalidateQueries({ queryKey: ["currentUser"] })
    } catch (error) {
      console.error("Не удалось сохранить данные доставки в профиль", error)
    }
  }

  const mutation = useMutation({
    mutationFn: async (data: FormValues) => {
      const response = await ordersCreateOrder({
        body: {
          recipient_name: data.recipient_name,
          phone: data.phone,
          address: data.address,
          comment: data.comment ? data.comment : null,
        },
      })
      await syncUserProfile(data)
      return response
    },
    onSuccess: (response) => {
      queryClient.invalidateQueries({ queryKey: ["cart"] })
      queryClient.invalidateQueries({ queryKey: ["orders"] })
      const orderId = response.data?.id
      if (orderId) {
        navigate({ to: "/pay/$orderId", params: { orderId } })
      } else {
        navigate({ to: "/account" })
      }
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
                <MaskedInput
                  mask="+7 (000) 000-00-00"
                  placeholder="+7 (___) ___-__-__"
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
              <FormLabel>Комментарий</FormLabel>
              <FormControl>
                <Input placeholder="Удобное время и пр." {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <LoadingButton
          type="submit"
          className="w-full"
          size="lg"
          loading={mutation.isPending}
        >
          Перейти к оплате
        </LoadingButton>
      </form>
    </Form>
  )
}
