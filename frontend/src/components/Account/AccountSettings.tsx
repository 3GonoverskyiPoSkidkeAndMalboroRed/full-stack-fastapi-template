import { zodResolver } from "@hookform/resolvers/zod"
import { useMutation, useQueryClient } from "@tanstack/react-query"
import { useEffect } from "react"
import { useForm } from "react-hook-form"
import { z } from "zod"

import { type UserUpdateMe, usersUpdateUserMe } from "@/client"
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
import { LoadingButton } from "@/components/ui/loading-button"
import { MaskedInput } from "@/components/ui/masked-input"
import { Separator } from "@/components/ui/separator"
import { Textarea } from "@/components/ui/textarea"
import useAuth from "@/hooks/useAuth"
import useCustomToast from "@/hooks/useCustomToast"
import { handleError } from "@/utils"

const formSchema = z.object({
  email: z.email({ message: "Некорректный email" }),
  full_name: z
    .string()
    .trim()
    .max(255, "Не больше 255 символов")
    .optional()
    .or(z.literal("")),
  phone: z.string().trim().max(32).optional().or(z.literal("")),
  delivery_address: z
    .string()
    .trim()
    .max(500, "Не больше 500 символов")
    .optional()
    .or(z.literal("")),
})

type FormData = z.infer<typeof formSchema>

function toDefaults(user: {
  email?: string
  full_name?: string | null
  phone?: string | null
  delivery_address?: string | null
}): FormData {
  return {
    email: user.email ?? "",
    full_name: user.full_name ?? "",
    phone: user.phone ?? "",
    delivery_address: user.delivery_address ?? "",
  }
}

export function AccountSettings() {
  const queryClient = useQueryClient()
  const { showSuccessToast, showErrorToast } = useCustomToast()
  const { user } = useAuth()

  const form = useForm<FormData>({
    resolver: zodResolver(formSchema),
    mode: "onBlur",
    defaultValues: toDefaults(user ?? {}),
  })

  useEffect(() => {
    if (user) {
      form.reset(toDefaults(user))
    }
  }, [user, form])

  const mutation = useMutation({
    mutationFn: (data: UserUpdateMe) => usersUpdateUserMe({ body: data }),
    onSuccess: () => {
      showSuccessToast("Данные обновлены")
    },
    onError: handleError.bind(showErrorToast),
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ["currentUser"] })
    },
  })

  const onSubmit = (data: FormData) => {
    const payload: UserUpdateMe = {
      email: data.email,
      full_name: data.full_name?.trim() || null,
      phone: data.phone?.trim() || null,
      delivery_address: data.delivery_address?.trim() || null,
    }
    mutation.mutate(payload)
  }

  const onReset = () => {
    if (user) form.reset(toDefaults(user))
  }

  return (
    <Form {...form}>
      <form
        onSubmit={form.handleSubmit(onSubmit)}
        className="flex max-w-xl flex-col gap-6"
      >
        <section className="space-y-4">
          <div>
            <h2 className="text-lg font-semibold">Профиль</h2>
            <p className="text-muted-foreground text-sm">
              Основные данные аккаунта
            </p>
          </div>
          <FormField
            control={form.control}
            name="email"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Почта</FormLabel>
                <FormControl>
                  <Input
                    type="email"
                    placeholder="user@example.com"
                    {...field}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="full_name"
            render={({ field }) => (
              <FormItem>
                <FormLabel>ФИО</FormLabel>
                <FormControl>
                  <Input
                    type="text"
                    placeholder="Иванов Иван Иванович"
                    {...field}
                    value={field.value ?? ""}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </section>

        <Separator />

        <section className="space-y-4">
          <div>
            <h2 className="text-lg font-semibold">Данные для доставки</h2>
            <p className="text-muted-foreground text-sm">
              Подставятся в форму при оформлении заказа
            </p>
          </div>
          <FormField
            control={form.control}
            name="phone"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Номер телефона</FormLabel>
                <FormControl>
                  <MaskedInput
                    mask="+7 (000) 000-00-00"
                    placeholder="+7 (___) ___-__-__"
                    value={field.value ?? ""}
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
            name="delivery_address"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Адрес доставки</FormLabel>
                <FormControl>
                  <Textarea
                    placeholder="г. Москва, ул. Ленина, д. 1, кв. 1"
                    rows={3}
                    {...field}
                    value={field.value ?? ""}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </section>

        <div className="flex gap-3">
          <LoadingButton
            type="submit"
            loading={mutation.isPending}
            disabled={!form.formState.isDirty}
          >
            Сохранить
          </LoadingButton>
          <Button
            type="button"
            variant="outline"
            onClick={onReset}
            disabled={!form.formState.isDirty || mutation.isPending}
          >
            Отменить
          </Button>
        </div>
      </form>
    </Form>
  )
}
