import { zodResolver } from "@hookform/resolvers/zod"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { Plus } from "lucide-react"
import { useState } from "react"
import { useForm } from "react-hook-form"
import { z } from "zod"

import {
  categoriesReadCategories,
  type ItemCreate,
  itemsCreateItem,
} from "@/client"
import { SizeCombobox } from "@/components/Common/SizeCombobox"
import { ImageUploader } from "@/components/Items/ImageUploader"
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import useCustomToast from "@/hooks/useCustomToast"
import { handleError } from "@/utils"

const formSchema = z.object({
  title: z.string().min(1, { message: "Введите название" }),
  description: z.string().optional(),
  size_id: z.string().optional(),
  brand: z.string().optional(),
  cost: z.string().optional(),
  category_id: z.string().optional(),
})

type FormData = z.infer<typeof formSchema>

const AddItem = () => {
  const [isOpen, setIsOpen] = useState(false)
  const [createdItemId, setCreatedItemId] = useState<string | null>(null)
  const [createdImages, setCreatedImages] = useState<string[]>([])
  const queryClient = useQueryClient()
  const { showSuccessToast, showErrorToast } = useCustomToast()

  const { data: categoriesData } = useQuery({
    queryKey: ["categories"],
    queryFn: () => categoriesReadCategories(),
    select: (res) => res.data?.data ?? [],
  })

  const form = useForm<FormData>({
    resolver: zodResolver(formSchema),
    mode: "onBlur",
    criteriaMode: "all",
    defaultValues: {
      title: "",
      description: "",
      size_id: "",
      brand: "",
      cost: "",
      category_id: "",
    },
  })

  const closeAndReset = () => {
    form.reset()
    setCreatedItemId(null)
    setCreatedImages([])
    setIsOpen(false)
  }

  const mutation = useMutation({
    mutationFn: (data: ItemCreate) => itemsCreateItem({ body: data }),
    onSuccess: (res) => {
      showSuccessToast("Товар создан")
      const newId = res.data?.id
      if (newId) {
        setCreatedItemId(newId)
        setCreatedImages(res.data?.images ?? [])
      } else {
        closeAndReset()
      }
    },
    onError: handleError.bind(showErrorToast),
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ["items"] })
    },
  })

  const onSubmit = (data: FormData) => {
    mutation.mutate(data)
  }

  return (
    <Dialog
      open={isOpen}
      onOpenChange={(open) => {
        if (!open) closeAndReset()
        else setIsOpen(true)
      }}
    >
      <DialogTrigger asChild>
        <Button className="my-4">
          <Plus className="mr-2" />
          Добавить товар
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>
            {createdItemId ? "Загрузите фото" : "Добавить товар"}
          </DialogTitle>
          <DialogDescription>
            {createdItemId
              ? "Товар создан. Добавьте изображения или закройте окно."
              : "Заполните данные для добавления нового товара."}
          </DialogDescription>
        </DialogHeader>
        {createdItemId ? (
          <div className="space-y-4 py-2">
            <ImageUploader
              itemId={createdItemId}
              currentImages={createdImages}
              onImagesChange={setCreatedImages}
            />
            <DialogFooter>
              <Button onClick={closeAndReset}>Готово</Button>
            </DialogFooter>
          </div>
        ) : (
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)}>
              <div className="grid gap-4 py-4">
                <FormField
                  control={form.control}
                  name="title"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>
                        Название <span className="text-destructive">*</span>
                      </FormLabel>
                      <FormControl>
                        <Input
                          placeholder="Название товара"
                          type="text"
                          {...field}
                          required
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="description"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Описание</FormLabel>
                      <FormControl>
                        <Input placeholder="Описание" type="text" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="size_id"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Размер</FormLabel>
                      <FormControl>
                        <SizeCombobox
                          value={field.value}
                          onChange={(id) => field.onChange(id ?? "")}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="brand"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Бренд</FormLabel>
                      <FormControl>
                        <Input placeholder="Бренд" type="text" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="cost"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Цена</FormLabel>
                      <FormControl>
                        <Input
                          placeholder="0.00"
                          type="number"
                          step="0.01"
                          {...field}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="category_id"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Категория</FormLabel>
                      <Select
                        onValueChange={field.onChange}
                        value={field.value}
                      >
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Выберите категорию" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {categoriesData?.map((cat) => (
                            <SelectItem key={cat.id} value={cat.id}>
                              {cat.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

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
        )}
      </DialogContent>
    </Dialog>
  )
}

export default AddItem
