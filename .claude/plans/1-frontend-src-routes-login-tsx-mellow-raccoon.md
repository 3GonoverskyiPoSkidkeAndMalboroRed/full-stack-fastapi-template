# План правок: login, каталог, шапка, маска телефона, настройки кабинета

## Context

Пользователь просит сразу 6 правок фронтенда + расширение модели User. Изменения объединены в один план, так как они затрагивают сквозные компоненты (AuthLayout, PublicHeader, User, каталог) и должны быть согласованы.

Уточнённые решения по неоднозначным пунктам (через AskUserQuestion):
- **Размеры по категории**: фильтрация на фронтенде по имени (числа → «Обувь», буквы → «Одежда»). Без миграции БД, без поля `category_id` в `Size`. Seed дополняется недостающими числовыми размерами (это безопасные новые строки, не изменение схемы).
- **Поля профиля**: в `User` добавляются `phone` и `delivery_address`. Бэкенд расширяется + регенерация клиента.
- **Маска телефона**: пакет `react-imask`, применяется только в `CheckoutForm` (по выбору пользователя).
- **Вкладка «Настройки»** размещается в существующем `/account` (так как пользователь сказал «в личный кабинет»). Текущий отдельный роут `/settings` не трогаем.

---

## 1. Login: русификация + ссылка на главную + убрать переключатель темы

### Файлы
- `frontend/src/components/Common/AuthLayout.tsx`
- `frontend/src/routes/login.tsx`
- `frontend/src/routes/signup.tsx` (минимально, см. ниже)

### Что меняется

**AuthLayout** сейчас всегда рендерит `<Appearance />` (переключатель темы) и используется и в `login`, и в `signup`. Пользователь просил убрать тему только с `login`, поэтому добавляем опциональный проп:

```tsx
interface AuthLayoutProps {
  children: React.ReactNode
  showThemeToggle?: boolean  // default: true (сохраняет поведение signup)
}
```

Внутри `AuthLayout`: рендерить `<Appearance />` только если `showThemeToggle !== false`. Если блок темы скрыт — оставить пустой `<div />`, чтобы `Footer` не «съехал».

**login.tsx**:
- Передать `<AuthLayout showThemeToggle={false}>`.
- Перевести строки:
  - title: `"Вход — FastAPI Template"`
  - заголовок: `"Войдите в аккаунт"`
  - label email: `"Email"` (остаётся)
  - placeholder email: `"user@example.com"` (остаётся)
  - сообщения валидации: `"Введите пароль"`, `"Пароль должен быть не короче 8 символов"`
  - label password: `"Пароль"`
  - placeholder password: `"Пароль"`
  - ссылка «Forgot your password?» → `"Забыли пароль?"`
  - кнопка `"Войти"` (уже есть в шапке как «Войти», тут — сабмит).
  - футер: `"Ещё нет аккаунта?"` + `"Зарегистрироваться"`.
- Добавить кнопку-ссылку «На главную» (`Button variant="ghost" asChild` с `<Link to="/">`) над заголовком формы. Использовать `ArrowLeft` из `lucide-react` для иконки.

**signup.tsx**: не трогать, тема там остаётся.

---

## 2. Каталог: размеры зависят от категории (фронт-only)

### Файлы
- `backend/app/core/db.py` — расширить `SEED_SIZES`.
- `frontend/src/routes/_public/catalog.index.tsx` — клиентская фильтрация.

### Бэкенд: дополнить seed размеров

В `SEED_SIZES` добавить недостающие числовые размеры:
```
"35", "36", "37", "38", "39", "40", "41", "44", "45", "46"
```
(уже есть `XS, S, M, L, XL, 42, 43, One Size`). `init_db` идемпотентен — это просто новые строки, без миграции схемы.

### Фронт: фильтрация по имени

В `catalog.index.tsx`:
1. По `search.category_id` находить выбранную категорию из `categoriesQuery.data` → её `name`.
2. Вычислять отфильтрованный массив размеров:
   - `name === "Одежда"` → размеры, у которых `/^[A-Z]+$/i.test(name)` (XS, S, M, L, XL).
   - `name === "Обувь"` → размеры, у которых `/^\d+$/.test(name)`.
   - Остальные категории (Аксессуары, Электроника, …) или категория не выбрана → все размеры.
3. При смене категории — если текущий `size_id` не попадает в новый отфильтрованный список, сбросить его (`size_id: undefined` через `navigate({ search })`). Делается одним эффектом или прямо в `onValueChange` категории.
4. Селект размера: `disabled`, если список пуст (на всякий случай); placeholder и пункт `"Все размеры"` остаются.

---

## 3. PublicHeader: hover только при наведении

### Файл
- `frontend/src/components/Common/PublicHeader.tsx`

### Что происходит сейчас
У каждой кнопки `<Link>` стоит `activeProps={{ className: "bg-accent text-accent-foreground" }}` — TanStack Router добавляет этот класс, когда маршрут активен. Это выглядит как «залипшая подсветка» на текущей странице. Сам `Button variant="ghost"` уже даёт hover через `hover:bg-accent` (см. `components/ui/button.tsx:20`).

### Правка
Удалить `activeProps` со всех кнопок-ссылок (Каталог, Корзина, Кабинет, Логин). Остаётся только `hover:bg-accent` из `ghost` варианта.

Если в будущем потребуется отметить активный пункт — можно вернуть через подчёркивание текста, а не фон. Сейчас этого не делаем (пользователь просил только hover).

---

## 4. Убрать смену темы с login

Покрыто пунктом 1 (`showThemeToggle={false}` в `AuthLayout`).

---

## 5. Маска телефона в CheckoutForm

### Файлы
- `frontend/package.json` — установить `react-imask`.
- `frontend/src/components/Checkout/CheckoutForm.tsx`.

### Шаги

1. Установить пакет: `npm install react-imask` (внутри `frontend/`).
2. В `CheckoutForm.tsx` импортировать `IMaskInput` из `react-imask`.
3. Заменить `<Input ... {...field} />` для поля `phone` на:
   ```tsx
   <IMaskInput
     mask="+7 (000) 000-00-00"
     value={field.value}
     onAccept={(value) => field.onChange(value)}
     onBlur={field.onBlur}
     placeholder="+7 (___) ___-__-__"
     className={/* те же tailwind-классы, что у shadcn Input */}
   />
   ```
   Классы можно взять из `components/ui/input.tsx` (скопировать ту же строку или вынести в константу). Чтобы не дублировать стили — обернуть `IMaskInput` через `asChild`-подобный паттерн или просто отрисовать `IMaskInput inputRef={field.ref}` со стилями shadcn-Input.
4. Обновить zod-схему `phone`: использовать строгий regex для замаскированного формата `^\+7 \(\d{3}\) \d{3}-\d{2}-\d{2}$` (после маски значение всегда в этом виде).

В настройках профиля (пункт 6) маска НЕ применяется — пользователь явно отметил только CheckoutForm.

---

## 6. Поля User (phone, delivery_address) + вкладки в /account

### Бэкенд

**`backend/app/models/user.py`**:
- В `UserBase` добавить:
  ```python
  phone: str | None = Field(default=None, max_length=32)
  delivery_address: str | None = Field(default=None, max_length=500)
  ```
  Эти поля автоматически наследуются `User`, `UserPublic`.
- В `UserUpdateMe` добавить те же поля как `Optional`:
  ```python
  phone: str | None = Field(default=None, max_length=32)
  delivery_address: str | None = Field(default=None, max_length=500)
  ```
- В `UserCreate`/`UserRegister` поля НЕ добавляем — заполняются позже в настройках.

**Миграция**: `alembic revision --autogenerate -m "add phone and delivery_address to user"`, потом `alembic upgrade head` (внутри контейнера backend).

**`backend/app/crud.py::update_user`**: уже использует `user_in.model_dump(exclude_unset=True)`, новые поля попадут автоматически. Проверить и не трогать.

### Регенерация клиента

`bash scripts/generate-client.sh` — пересоздаёт `frontend/src/client/types.gen.ts` (`UserPublic`, `UserUpdateMe` получат новые поля).

### Фронтенд

**`frontend/src/routes/_authed/account.tsx`**:
- Перевести страницу на вкладки `Tabs` из `@/components/ui/tabs`:
  - `orders` — «Мои заказы» (текущая секция `<OrdersList />`).
  - `wishlist` — «Избранное» (`<WishlistList />`).
  - `settings` — «Настройки» (новый компонент `AccountSettings`).
- Дефолтная вкладка: `orders`. Состояние вкладки локальное (`useState`), без синка с URL (минимально).
- Заголовки секций («Мои заказы», «Избранное»), которые сейчас на странице — превращаются в `TabsTrigger`.

**Новый компонент `frontend/src/components/Account/AccountSettings.tsx`**:
- Форма на `react-hook-form` + `zodResolver`.
- Поля: `email`, `full_name`, `phone`, `delivery_address`.
- Zod-схема: email обязательный, остальные опциональные с длинами как в модели.
- Источник данных: `useAuth().user` (см. `frontend/src/hooks/useAuth.ts`).
- Мутация: `usersUpdateUserMe` из `@/client`, на `onSuccess` — `queryClient.invalidateQueries({ queryKey: ["currentUser"] })`, на ошибке — `handleError`. Toast через `useCustomToast`.
- Состояния: можно сделать сразу редактируемую форму (без отдельного «Edit»-режима), чтобы упростить. Кнопка `Сохранить` (disabled, пока форма не dirty). Кнопка `Отменить` сбрасывает на `user`-значения (`form.reset(user)`).
- Поле `delivery_address` — `<Textarea>` (если есть в shadcn) или многострочный `Input` через `as="textarea"`. **Проверка**: `components/ui/` сейчас не содержит `textarea.tsx`. Нужно добавить: `npx shadcn add textarea` (или использовать обычный `<Input>` для коротких адресов). Решение: добавить `textarea` через shadcn — это стандартный примитив, файл попадает в `components/ui/`.

Не трогать существующий `frontend/src/routes/_authed/settings.tsx` и `UserInformation.tsx` — они продолжают работать со старыми полями (мутация без новых полей просто их не меняет благодаря `exclude_unset=True`).

---

## Сводный список файлов

### Бэкенд
- `backend/app/models/user.py` — поля phone, delivery_address.
- `backend/app/alembic/versions/<new>.py` — миграция (создаётся автогенерацией).
- `backend/app/core/db.py` — расширение `SEED_SIZES`.

### Фронтенд (правки)
- `frontend/src/components/Common/AuthLayout.tsx` — проп `showThemeToggle`.
- `frontend/src/routes/login.tsx` — русский текст, кнопка «На главную», `showThemeToggle={false}`.
- `frontend/src/components/Common/PublicHeader.tsx` — убрать `activeProps`.
- `frontend/src/routes/_public/catalog.index.tsx` — фильтрация размеров по имени категории + сброс `size_id`.
- `frontend/src/components/Checkout/CheckoutForm.tsx` — `IMaskInput` для phone, обновить regex.
- `frontend/src/routes/_authed/account.tsx` — `Tabs` (Заказы / Избранное / Настройки).
- `frontend/package.json` (через `npm install react-imask`).

### Фронтенд (новые файлы)
- `frontend/src/components/Account/AccountSettings.tsx` — форма редактирования email/ФИО/телефона/адреса.
- `frontend/src/components/ui/textarea.tsx` — через `npx shadcn add textarea` (для адреса доставки).
- `frontend/src/client/*.gen.ts` — авто-регенерация скриптом.

---

## Verification

1. **Бэкенд**:
   - `docker compose exec backend alembic upgrade head` — миграция применяется без ошибок.
   - `docker compose exec backend bash scripts/tests-start.sh -x` — тесты зелёные (особенно тесты `users` и `crud.update_user`).
   - `docker compose exec backend bash scripts/lint.sh` — mypy + ty + ruff чистые.

2. **Регенерация клиента**:
   - `bash scripts/generate-client.sh` — без ошибок, в `types.gen.ts` появились `phone` и `delivery_address`.

3. **Фронтенд**:
   - `npm run lint` и `npm run build` — без ошибок и предупреждений TS/ESLint.
   - Ручная проверка через `docker compose watch` на http://dashboard.localhost:8081:
     - `/login`: всё по-русски, есть кнопка «На главную» (ведёт на `/`), нет переключателя темы; signup-форма свою тему сохраняет.
     - `/catalog?category_id=<Одежда>` показывает только XS-XL в размерах; `<Обувь>` — только числа; при смене категории выбранный размер сбрасывается, если не подходит.
     - В шапке навигации hover работает, но текущий маршрут не «залип» подсветкой.
     - В `/checkout` поле телефона маскируется как `+7 (___) ___-__-__`, валидация работает.
     - В `/account` есть вкладки «Мои заказы», «Избранное», «Настройки»; в «Настройках» можно править email, ФИО, телефон, адрес доставки; сохранение через тост.
   - Запустить хотя бы `npx playwright test tests/auth.spec.ts` — не должна сломаться авторизация.
