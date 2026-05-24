# Plan: Таб «Статистика заказов» в /admin

## Context

Сейчас на `/admin` уже есть три таба (`Пользователи`, `Товары`, `Заказы`) — `frontend/src/routes/_admin/admin.tsx`. Админу нужно видеть аналитику продаж, не выгружая данные вручную: сколько заказов и денег за период, какой средний чек, и в какие часы клиенты заказывают чаще. По решениям пользователя в этом диалоге:

- График: **shadcn/ui `Chart`** поверх `recharts` (вписывается в текущий стек `new-york` + Tailwind v4, темизация через CSS-переменные).
- Агрегация: **новый backend endpoint** `GET /api/v1/orders/stats` — PostgreSQL `date_trunc` справится с миллионами строк, фронт получает только готовые точки.
- Диапазон дат: **shadcn `Calendar` + `Popover`** с пресетами «Сегодня / 7 дней / Месяц / Полгода / Год / Произвольно».
- Какие заказы считать: **все статусы**, включая `CANCELLED` (явно решение пользователя).
- Часовой пояс: **`Europe/Moscow`** (агрегируем на бэке через `AT TIME ZONE`).
- Второй график: **timeline по часам** для разглядывания пиков — с ограничением диапазона до 31 дня (иначе график нечитаем и тяжёл).

Существующие паттерны, которые нужно переиспользовать: `Annotated[..., Depends(...)]` через `SessionDep` + `get_current_active_superuser`, `useSuspenseQuery` + `<Suspense>`, `formatPrice` из `@/lib/format`, стили вкладок `data-[state=active]:bg-ink data-[state=active]:text-paper tracking-[0.18em] uppercase`.

---

## Backend

### 1. Pydantic-модели

В `backend/app/models/order.py` добавить (рядом с `OrdersPublic`):

```python
class OrderStatsBucket(SQLModel):
    bucket: datetime           # начало интервала в Europe/Moscow (timezone-aware)
    count: int
    total: Decimal
    average: Decimal           # 0 если count == 0

class OrderStatsSummary(SQLModel):
    count: int
    total: Decimal
    average: Decimal

class OrderStatsResponse(SQLModel):
    group_by: Literal["hour", "day", "month"]
    start: datetime
    end: datetime
    points: list[OrderStatsBucket]
    summary: OrderStatsSummary
```

Реэкспортировать из `models/__init__.py`.

### 2. CRUD-функция

В `backend/app/crud.py` добавить `get_orders_stats(session, *, start, end, group_by) -> OrderStatsResponse`:

- Одним SQL-запросом: `SELECT date_trunc(:group_by, created_at AT TIME ZONE 'Europe/Moscow') AS bucket, COUNT(*), COALESCE(SUM(total), 0) FROM shop_order WHERE created_at >= :start AND created_at < :end GROUP BY bucket ORDER BY bucket;` — собрать через SQLAlchemy `func.date_trunc` и `select(...).group_by(...)`.
- `:start`/`:end` приводятся к UTC перед привязкой; bucket-метки оставляем naive «по Москве» и проставляем tzinfo `ZoneInfo("Europe/Moscow")` уже в Python.
- **Заполнить пустые бакеты нулями** через генератор интервалов (`hour/day/month`) в Python — иначе area chart рвётся.
- Считать `average = total / count if count else 0`, округлять до 2 знаков (`Decimal.quantize`).
- Параллельно считаем `summary` агрегатом без `group_by` (один lightweight-запрос).

### 3. Route

В `backend/app/api/routes/orders.py`:

```python
@router.get(
    "/stats",
    response_model=OrderStatsResponse,
    dependencies=[Depends(get_current_active_superuser)],
)
def read_orders_stats(
    session: SessionDep,
    start: datetime,
    end: datetime,
    group_by: Literal["hour", "day", "month"] = "day",
) -> Any:
    if end <= start:
        raise HTTPException(400, "end must be after start")
    if group_by == "hour" and (end - start) > timedelta(days=31):
        raise HTTPException(400, "Для группировки по часам диапазон не более 31 дня")
    return crud.get_orders_stats(session=session, start=start, end=end, group_by=group_by)
```

Маршрут **обязан** располагаться выше `@router.get("/{id}")`, иначе FastAPI распарсит `stats` как UUID.

### 4. Тесты

`backend/app/tests/api/routes/test_orders.py`:
- 403 для обычного пользователя.
- 400 при `end <= start`.
- 400 при `group_by=hour` + диапазон > 31 дня.
- Создаём 3 заказа в разные часы → проверяем корректность bucket-меток в `Europe/Moscow`, count, total, average и заполнение нулями.

### 5. Регенерация SDK

После добавления route — `bash scripts/generate-client.sh`. Появятся `ordersReadOrdersStats` + типы `OrderStatsResponse`/`OrderStatsBucket`/`OrderStatsSummary` в `frontend/src/client/sdk.gen.ts`.

---

## Frontend

### 1. Установка shadcn-примитивов и зависимостей

Из `frontend/`:

```bash
npx shadcn add chart calendar popover card
```

Это притянет `recharts`, `react-day-picker`, `date-fns` и создаст файлы `components/ui/{chart,calendar,popover,card}.tsx`. Эти файлы остаются в шаблоне shadcn и игнорируются ESLint/Prettier — править их вручную не нужно.

### 2. Расширение схемы таба

`frontend/src/routes/_admin/admin.tsx`:
- В `adminSearchSchema`: `tab: z.enum(["users", "items", "orders", "stats"])`.
- В `<TabsList>` добавить `<TabsTrigger value="stats">Статистика</TabsTrigger>` тем же стилем, что у соседей.
- `<TabsContent value="stats">` → `<OrdersStatsPanel />` (lazy не нужен — таб один файл).

### 3. Новые компоненты

Все — в `frontend/src/components/Admin/Stats/`:

- **`OrdersStatsPanel.tsx`** — корень таба. Локальные стейты `periodRange` (по умолчанию «Последние 30 дней») и `hourlyRange` (по умолчанию «Последние 7 дней»). Две секции: «По периоду» и «По часам», каждая обёрнута в `<Suspense fallback={<StatsSkeleton />}>`.
- **`DateRangePicker.tsx`** — кнопка с подписью выбранного диапазона → `Popover` с двумя элементами:
  - Список пресетов слева (`Сегодня`, `7 дней`, `Месяц`, `Полгода`, `Год`, `Произвольно`), вычисляются через `date-fns/subDays|subMonths`.
  - `Calendar` (`mode="range"`) справа. Пропсы: `value`, `onChange`, `maxRangeDays?` (для hourly — 31).
- **`StatsKpiCards.tsx`** — три карточки `<Card>`: «Заказов», «Сумма», «Средний чек». Получает `summary` из ответа API. Денежные значения форматирует `formatPrice`.
- **`StatsAreaChart.tsx`** — переиспользуемый area chart на shadcn `ChartContainer`. Пропсы: `data`, `xKey`, `series` (`[{ dataKey: "count", label: "Заказов" }, { dataKey: "total", label: "Сумма" }]`), `xFormatter`. Использует `<AreaChart>` + два `<Area>` с `fillOpacity` градиентом, как в примере shadcn. Цвета через `--chart-1`, `--chart-2`.
- **`useOrdersStatsQuery.ts`** — обёртка над `ordersReadOrdersStats`, ключ запроса `["orders", "stats", { start, end, groupBy }]`, `useSuspenseQuery`.

Логика выбора `group_by` для «По периоду»:
- `≤ 2 дня` → `hour`, `≤ 90 дней` → `day`, иначе → `month`. (Простая ступенька, не показываем пользователю — деталь.)

Для «По часам» — всегда `group_by=hour`, `DateRangePicker` ограничен 31 днём.

### 4. Форматирование

- Денежные значения — `formatPrice(Number(value))` из `@/lib/format`.
- Подписи оси X: `new Intl.DateTimeFormat("ru-RU", { ... }).format(...)` в зависимости от `group_by` (час → `HH:00`, день → `dd.MM`, месяц → `LLL yyyy`).
- В tooltip — полная дата + три метрики (count, total, average).

### 5. Стиль

Соответствие текущему дизайну админки (см. `admin.tsx`, `AdminOrdersPanel.tsx`):
- Заголовки секций — `mono text-muted-foreground text-[11px] tracking-[0.2em] uppercase` над названием.
- Карточки и графики — обёрнуты в `border-ink rounded-md border` без скруглений Tailwind по умолчанию.
- Никаких новых цветов — только токены, уже определённые в `src/index.css`.

---

## Файлы

**Изменяем:**
- `backend/app/models/order.py`, `backend/app/models/__init__.py`
- `backend/app/crud.py`
- `backend/app/api/routes/orders.py`
- `backend/app/tests/api/routes/test_orders.py`
- `frontend/src/routes/_admin/admin.tsx`

**Создаём:**
- `frontend/src/components/Admin/Stats/OrdersStatsPanel.tsx`
- `frontend/src/components/Admin/Stats/DateRangePicker.tsx`
- `frontend/src/components/Admin/Stats/StatsKpiCards.tsx`
- `frontend/src/components/Admin/Stats/StatsAreaChart.tsx`
- `frontend/src/components/Admin/Stats/useOrdersStatsQuery.ts`

**Автогенерируются:**
- `frontend/src/components/ui/{chart,calendar,popover,card}.tsx` — через `npx shadcn add`
- `frontend/src/client/**` — через `bash scripts/generate-client.sh`

---

## Verification

1. **Backend lint + tests**
   ```bash
   docker compose exec backend bash scripts/lint.sh
   docker compose exec backend uv run pytest tests/api/routes/test_orders.py -v
   ```

2. **SDK регенерация**
   ```bash
   bash scripts/generate-client.sh
   ```
   Проверить, что в `frontend/src/client/sdk.gen.ts` появилась `ordersReadOrdersStats`.

3. **Frontend lint + build**
   ```bash
   cd frontend && npm run lint && npm run build
   ```

4. **Ручная проверка** (`docker compose watch`, открыть `http://dashboard.localhost:8081/admin?tab=stats` как суперюзер):
   - Создать 3–5 тестовых заказов в разное время (через UI или прямо в БД).
   - Открыть таб «Статистика» — KPI и графики отрисовались, нули в пустых бакетах не ломают линию.
   - Сменить пресет «Сегодня» → запрос летит с `group_by=hour`, точек 24.
   - Сменить «Год» → `group_by=month`, точек 12.
   - Во втором графике выбрать диапазон > 31 дня — отрисовать ошибку (toast через `handleError`).
   - Зайти под обычным пользователем — таб не виден / 403.

5. **DevTools / Network** — проверить, что timestamps в payload в UTC, а bucket-метки в ответе в `+03:00`.
