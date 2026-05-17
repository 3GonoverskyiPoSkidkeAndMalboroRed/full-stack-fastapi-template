# План: ProductCard как ссылка + фон/border у CardContent + фикс zoom в лайтбоксе

## Context

В каталоге (`/catalog`) карточка товара (`ProductCard`) сейчас имеет три отдельных кликабельных области (`<Link>` на картинке, на названии, на кнопке «Купить»), а остальное «мёртвое» пространство (бренд, цена) не реагирует на клик. Это снижает удобство навигации.

Параллельно карточка стилистически «плоская» — у `CardContent` нет ни границы, ни фона, из-за чего блок текстового описания визуально не отделён от страницы.

На странице товара (`ProductDetail`) лайтбокс с зумом (`ProductLightbox` на базе `react-zoom-pan-pinch` + `embla-carousel`) даёт некорректное смещение изображения вправо, из-за чего увеличенное фото перекрывает кнопку «×» в правом верхнем углу. Корень бага — взаимодействие `embla` (`CarouselContent` имеет дефолтный `-ml-4`, `CarouselItem` — `pl-4`) с принудительными `!w-screen / !h-screen` на `TransformComponent`: внутренний контейнер шире доступной области, поэтому центрирование `flex justify-center` происходит относительно сдвинутого вправо родителя.

Цель: сделать всю карточку единой ссылкой (кроме кнопок «В вишлист» и «В корзину»), оформить `CardContent` (border + `bg-card`) и устранить смещение в зуме.

## Изменения

### 1. `frontend/src/components/Catalog/ProductCard.tsx` — карточка-ссылка

- Удалить три внутренних `<Link>` (строки 33-58, 65-71, 77-82) и обернуть всю `Card` одним внешним `<Link to="/catalog/$id" params={{ id: item.id }} className="group block">`.
- Сохранить относительное позиционирование (`relative`) у обёртки картинки внутри `<Link>` — нужно для `absolute` бейджей и floating-кнопки вишлиста.
- Заменить блок кнопки «Купить» (`<Button asChild><Link>…</Link></Button>` на строках 77-82) на компонент `<AddToCartButton itemId={item.id} disabled={outOfStock} />` — пользователь подтвердил, что в карточке должен быть полноценный add-to-cart.
- `AddToWishlistButton` уже корректно гасит всплытие (`e.preventDefault()` + `e.stopPropagation()` в `AddToWishlistButton.tsx:34-42`) — менять не нужно.

### 2. `frontend/src/components/Catalog/AddToCartButton.tsx` — гасить всплытие

В `handleClick` (строки 35-41) сейчас нет `preventDefault/stopPropagation`. Когда кнопка окажется внутри `<Link>`-карточки, без этого клик уйдёт по ссылке. Меняем сигнатуру:

```tsx
const handleClick = (e: React.MouseEvent) => {
  e.preventDefault()
  e.stopPropagation()
  // …остальное без изменений
}
```

В `ProductDetail` (`frontend/src/components/Catalog/ProductDetail.tsx:106-110`) `AddToCartButton` используется вне ссылки — `preventDefault` там безвреден (Button is `type="button"`, формы вокруг нет).

### 3. `frontend/src/components/Catalog/ProductCard.tsx` — border + bg-card на CardContent

`CardContent` в shadcn (`frontend/src/components/ui/card.tsx:64-71`) по умолчанию имеет только `px-6` — границы и фона нет. У `Card` (строка 10) тоже нет ни `border`, ни `bg-card`, только `shadow-sm`. Поэтому добавляем нужные классы прямо на использование `CardContent` в `ProductCard.tsx`:

```tsx
<CardContent className="flex flex-1 flex-col gap-2 border bg-card px-4 py-3">
```

`CardFooter` оставляем как есть.

### 4. `frontend/src/components/Catalog/ProductLightbox.tsx` — фикс смещения зума

Три точечные правки внутри `ProductLightbox.tsx` (строки 54-91):

1. **Убрать сдвиг `embla`**: на `CarouselContent` добавить `ml-0`, на `CarouselItem` — `pl-0`. По умолчанию shadcn-обёртка применяет `-ml-4 / pl-4`, и именно это «съезжание на 16 px» нарушает центрирование внутри `TransformComponent`.

   ```tsx
   <CarouselContent className="ml-0 h-screen">
     {images.map((src, index) => (
       <CarouselItem
         key={src}
         className="flex h-screen items-center justify-center pl-0"
       >
   ```

2. **`TransformComponent` растягивать по родителю, а не по `screen`**: вместо `!h-screen !w-screen` использовать `!h-full !w-full`, чтобы трансформируемая область совпадала с `CarouselItem` (тот уже `h-screen w-full` по факту, т.к. лежит во flex-родителе на полный экран).

   ```tsx
   <TransformComponent
     wrapperClass="!h-full !w-full"
     contentClass="!h-full !w-full flex items-center justify-center"
   >
   ```

3. **Добавить `centerOnInit` к `TransformWrapper`** — даёт библиотеке явно центрировать содержимое при первом маунте каждой картинки карусели, страхует от остаточных смещений после смены слайда:

   ```tsx
   <TransformWrapper
     doubleClick={{ mode: "toggle" }}
     wheel={{ step: 0.2 }}
     panning={{ velocityDisabled: true }}
     centerOnInit
   >
   ```

Кнопку закрытия (`absolute top-4 right-4 z-50`, строки 46-53) трогать не нужно — после устранения горизонтального оверфлоу она перестанет перекрываться.

## Критические файлы

- `frontend/src/components/Catalog/ProductCard.tsx` — основная переработка
- `frontend/src/components/Catalog/AddToCartButton.tsx` — добавить stop/prevent в `handleClick`
- `frontend/src/components/Catalog/ProductLightbox.tsx` — фикс зума

Без правок:
- `frontend/src/components/Catalog/ProductGrid.tsx` — продолжает использовать `ProductCard` без изменений API
- `frontend/src/components/Catalog/AddToWishlistButton.tsx` — уже гасит события
- `frontend/src/components/ui/card.tsx` — общие классы трогать не будем, локально расширяем через `className`

## Verification

1. `cd frontend && npm run lint` — eslint + prettier должны пройти без ошибок.
2. `cd frontend && npm run build` — `tsc --build` + `vite build` без TS-ошибок (особенно проверка сигнатуры `handleClick(e: React.MouseEvent)` в `AddToCartButton`).
3. Поднять стек: `docker compose watch`, открыть `http://dashboard.localhost:8081/catalog`:
   - Клик в любую «пустую» зону карточки (бренд, цена, фон) → переход на `/catalog/$id`.
   - Клик по иконке «сердце» (вишлист) → добавление в вишлист, **без** перехода на товар (проверить тост и URL).
   - Клик по «В корзину» → добавление в корзину, **без** перехода на товар.
   - `CardContent` визуально с границей и фоном `bg-card`.
4. Открыть карточку товара → клик по фото открывает лайтбокс:
   - Изображение центрировано по экрану (не съезжает вправо).
   - Кнопка «×» в правом верхнем углу не перекрывается ни в стартовом состоянии, ни после двойного клика / зума колесом.
   - Переключение между фото через стрелки сохраняет центрирование.
5. Smoke: убедиться, что страница `/catalog/$id` (где `AddToCartButton` используется отдельно) по-прежнему добавляет в корзину после правки `handleClick`.
