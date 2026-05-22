# План: favicon-гифка, фото по пропорциям, карусель на главной

## Context

Три связанные правки фронтенда:

1. **Favicon в формате GIF.** Пользователь положил `favi.gif` в корень репо (`/full-stack-fastapi-template/favi.gif`, 118 KB) и хочет, чтобы он использовался как иконка вкладки. Сейчас в `frontend/index.html` подключены два устаревших favicon: `/vite.svg` (файл отсутствует) и `/assets/images/favicon.png`. Также: анимация GIF-favicon работает только в Firefox; в Chrome/Safari/Edge будет показан первый кадр — пользователь об этом предупреждён.

2. **Серое поле вокруг фото товаров.** В карточках каталога и галерее товара контейнер с фото — это `bg-soft aspect-square`, а сама `<img>` имеет `object-contain`. У большинства фото пропорции ≠ 1:1, поэтому остаток квадрата заполняется фоном `--soft: #ececea`. Решение пользователя — отказаться от квадратного контейнера, чтобы контейнер подстраивался под пропорции фото. Сетку каталога (`ProductGrid` с рамками-«решёткой») сохраняем — карточки в одном ряду будут выровнены по самой высокой.

3. **Карусель на главной.** Сейчас во второй колонке hero (`frontend/src/routes/_public/index.tsx:54-57`) пустой placeholder `<div className="ph relative min-h-[420px] lg:min-h-[520px]">`. Туда нужно вставить автоматически прокручивающуюся карусель из всех товаров (`itemsReadItemsPublic`, лимит 10), показывая первое фото каждого; клик по слайду ведёт на страницу товара. shadcn `Carousel` и `embla-carousel-react` уже стоят, не хватает плагина `embla-carousel-autoplay` — нужно добавить.

---

## Часть 1. Favicon → `favi.gif`

### Шаги

1. **Перенести файл** из корня репо во `frontend/public/`:
   ```bash
   mv /mnt/d/РАБОТА/CODE/full-stack-fastapi-template/favi.gif \
      /mnt/d/РАБОТА/CODE/full-stack-fastapi-template/frontend/public/favi.gif
   ```
   Vite читает статику только из `frontend/public/`, оттуда файл будет доступен по `/favi.gif`.

2. **`frontend/index.html`**: заменить две `<link rel="icon">` строки (5 и 8) на одну:
   ```html
   <link rel="icon" type="image/gif" href="/favi.gif" />
   ```

### Опционально (не блокирующее)

- `frontend/public/assets/images/favicon.png` (старый) можно оставить — он перестанет грузиться, мусор минимальный. Удалять не обязательно.

---

## Часть 2. Фото товаров — контейнер по пропорциям

### Принцип

- **Большие фото (карточка каталога, основное фото товара, слайды карусели галереи)** — убрать `aspect-square` и `bg-soft` с контейнера; убрать `absolute inset-0` и `object-contain` с `<img>`. Картинка задаёт высоту контейнера сама (`block w-full h-auto`).
- **Миниатюры внизу галереи (`size-16`)** — оставить квадрат, но `object-contain` → `object-cover`, чтобы серый фон не торчал.
- **Плейсхолдер для товаров без фото** (`ProductCard.tsx:33-37`, `ProductGallery.tsx:35-44`) — оставить квадрат, потому что это иконка-заглушка, и пропорции взять неоткуда.

### Файлы и точки правки

**`frontend/src/components/Catalog/ProductCard.tsx:21-38`** — обёртка `<Link>` с фото:

- Класс ссылки `bg-soft relative block aspect-square` → `relative block w-full`
- Класс `<img>` `absolute inset-0 h-full w-full object-contain p-3` → `block w-full h-auto`
- Плейсхолдер `<span className="ph absolute inset-0 block">` оборачиваем в обёртку с `aspect-square` (чтобы заглушка осталась квадратной).

**`frontend/src/components/Catalog/ProductGallery.tsx`**:

- Строки `35-44` (плейсхолдер, когда `images.length === 0`) — без изменений, квадратная заглушка корректна.
- Строки `52-64` (основной слайд карусели) — у `<button>` убрать `aspect-square`, оставить `bg-soft block w-full overflow-hidden` → `block w-full`; у `<img>` `h-full w-full cursor-zoom-in object-contain` → `block h-auto w-full cursor-zoom-in`.
- Строки `74-96` (миниатюры) — оставить `bg-soft size-16 ...` как есть; у `<img>` `h-full w-full object-contain` → `h-full w-full object-cover`.

### Замечание про `ProductGrid`

Файл `frontend/src/components/Catalog/ProductGrid.tsx:25-32` — НЕ ТРОГАЕМ. Сетка с рамками-«решёткой» сохраняется. Карточки в одном ряду выровняются по самой высокой (под коротким фото будет пустое поле перед ценой). Это сознательный компромисс — выбран пользователем в развилке.

---

## Часть 3. Карусель в hero на главной

### Шаги

1. **Установить плагин autoplay** для embla:
   ```bash
   cd frontend && npm install embla-carousel-autoplay
   ```

2. **`frontend/src/routes/_public/index.tsx`**:

   - Добавить импорты:
     ```ts
     import Autoplay from "embla-carousel-autoplay"
     import { useRef } from "react"
     import {
       Carousel,
       CarouselContent,
       CarouselItem,
       CarouselNext,
       CarouselPrevious,
     } from "@/components/ui/carousel"
     import { firstPhotoOrPlaceholder, getPhotoUrl } from "@/lib/photo"
     ```
     Уже есть импорты `itemsReadItemsPublic`, `useSuspenseQuery`, `Link` и `Suspense` — переиспользуем.

   - Создать новый компонент в этом же файле:
     ```tsx
     function HeroCarousel() {
       const { data } = useSuspenseQuery(getHomeItemsQueryOptions())
       const autoplay = useRef(Autoplay({ delay: 4000, stopOnInteraction: false }))
       return (
         <Carousel
           plugins={[autoplay.current]}
           opts={{ loop: true }}
           className="h-full w-full"
         >
           <CarouselContent className="h-full">
             {data.data.map((item) => {
               const photo = firstPhotoOrPlaceholder(item.images)
               const hasPhoto = (item.images?.length ?? 0) > 0
               return (
                 <CarouselItem key={item.id} className="h-full">
                   <Link
                     to="/catalog/$id"
                     params={{ id: item.id }}
                     className="block h-full w-full"
                   >
                     {hasPhoto ? (
                       <img
                         src={photo}
                         alt={item.title}
                         className="h-full w-full object-cover"
                       />
                     ) : (
                       <span className="ph block h-full w-full" />
                     )}
                   </Link>
                 </CarouselItem>
               )
             })}
           </CarouselContent>
           <CarouselPrevious className="left-3" />
           <CarouselNext className="right-3" />
         </Carousel>
       )
     }
     ```
     Здесь сознательно используется `object-cover` (а НЕ «контейнер по пропорциям»), потому что hero — это фиксированный по высоте блок (`min-h-[420px] lg:min-h-[520px]`); если оставить «по пропорциям», карусель будет прыгать по высоте между слайдами. Это согласуется с интентом пользователя (правило «контейнер по пропорциям» относится к карточкам/галерее, не к hero).

   - Заменить пустой placeholder. Было:
     ```tsx
     <div className="ph relative min-h-[420px] lg:min-h-[520px]">
       <span className="label">cover · 01</span>
       <span className="corner">2400 × 1600</span>
     </div>
     ```
     Стало:
     ```tsx
     <div className="relative min-h-[420px] overflow-hidden lg:min-h-[520px]">
       <Suspense fallback={<div className="ph h-full w-full" />}>
         <HeroCarousel />
       </Suspense>
     </div>
     ```

### Переиспользование

- `getHomeItemsQueryOptions()` (`_public/index.tsx:125-131`) — тот же queryKey `["home-items"]`, кэш делится с `HomeProducts`/`ShopMeta`/`SeeAllHint`. Дополнительной сетевой нагрузки не появится.
- `firstPhotoOrPlaceholder()` и `getPhotoUrl()` из `frontend/src/lib/photo.ts` — уже используются в `ProductCard.tsx` и `ProductGallery.tsx`.

---

## Verification

1. **Локально:**
   ```bash
   cd frontend
   npm install              # подхватит embla-carousel-autoplay
   npm run dev              # vite на :5173 (или docker compose watch)
   npm run lint             # eslint + prettier должны пройти
   npm run build            # tsc --build + vite build — должно собраться без ошибок
   ```

2. **Ручная проверка в браузере (http://localhost:5173):**
   - Вкладка показывает анимированный (в Firefox) или статичный (в Chrome) favicon — гифка. Сетевая вкладка DevTools показывает `200 OK` на `/favi.gif`.
   - На главной: во второй колонке hero крутится карусель из 10 товаров; через 4 секунды листает сама; клик по слайду уводит на `/catalog/{id}` соответствующего товара; работают стрелки `‹` `›`.
   - На `/catalog`: карточки разной высоты, серого поля вокруг фото нет, сетка-решётка с рамками сохранена.
   - На `/catalog/{id}`: основное фото без серого поля, по пропорциям; миниатюры внизу остались квадратными, без серых полей.

3. **На бою** (после `git push` + деплоя по прежней схеме `docker compose -f compose.yml -f compose.nginx.yml build && up -d`):
   - `https://reestr13.ru` — те же проверки, что и локально.
   - Favicon кешируется браузером агрессивно — может понадобиться hard reload (Ctrl+Shift+R).
