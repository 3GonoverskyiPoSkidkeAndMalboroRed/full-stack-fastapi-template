import { useSuspenseQuery } from "@tanstack/react-query"
import { createFileRoute, Link } from "@tanstack/react-router"
import { Suspense } from "react"

import { itemsReadItemsPublic } from "@/client"
import { ProductGrid } from "@/components/Catalog/ProductGrid"
import { PendingCatalog } from "@/components/Pending/PendingCatalog"

export const Route = createFileRoute("/_public/")({
  component: HomePage,
  head: () => ({
    meta: [{ title: "РЕЕСТР13 — Главная" }],
  }),
})

function HomePage() {
  return (
    <>
      <HeroSection />
      <ShopSection />
    </>
  )
}

function HeroSection() {
  return (
    <section className="border-ink grid grid-cols-1 border-b lg:grid-cols-2">
      <div className="border-ink flex min-h-[520px] flex-col justify-between gap-8 border-b px-7 pt-7 pb-9 lg:border-r lg:border-b-0">
        <div className="flex items-start justify-between gap-4">
          <span className="tag solid">Магазин</span>
          <span className="mono text-muted-foreground text-[11px] tracking-[0.18em] uppercase">
            Раздел · 01 / Коллекция
          </span>
        </div>
        <div>
          <h1 className="m-0 text-[56px] leading-none font-semibold tracking-[-0.02em] text-balance md:text-[60px]">
            Встречайте <em className="hero-em">Лето</em> — новый дроп уже в
            магазине
          </h1>
          <p className="mt-5 max-w-[42ch] text-[17px] leading-[1.45]">
            Мужская и женская одежда, а также ювелирные изделия. Найдено и привезено для вас,
            ограниченные и редкие вещи.
          </p>
          <div className="mt-7 flex items-center justify-between gap-4">
            <Link to="/catalog" className="read-link">
              Открыть каталог
            </Link>
            <span className="mono text-muted-foreground text-[11px] tracking-[0.06em] uppercase">
              10 SKU · ДРОП №04
            </span>
          </div>
        </div>
      </div>
      <div className="ph relative min-h-[420px] lg:min-h-[520px]">
        <span className="label">cover · 01</span>
        <span className="corner">2400 × 1600</span>
      </div>
    </section>
  )
}

function ShopSection() {
  return (
    <section>
      <header className="sec-head">
        <div>
          <div className="mono text-muted-foreground mb-3 text-[11px] tracking-[0.2em] uppercase">
            Раздел / 02 · Магазин
          </div>
          <h2>Ре́ Spring 2026</h2>
        </div>
        <div className="flex flex-col items-end gap-1">
          <span className="text-muted-foreground text-[11px] tracking-[0.2em] uppercase">
            Дроп №04
          </span>
          <Suspense fallback={<span className="mono text-[12px]">…</span>}>
            <ShopMeta />
          </Suspense>
        </div>
      </header>
      <div className="sec-sub">
        <span>
          Следите за последними новостями моды и тенденциями, чтобы быть в
          курсе.
        </span>
        <Link
          to="/catalog"
          className="upper border-ink border-b pb-[2px] text-[11px] tracking-[0.18em]"
        >
          Перейти в магазин →
        </Link>
      </div>
      <Suspense fallback={<PendingCatalog />}>
        <HomeProducts />
      </Suspense>
      <Link to="/catalog" className="see-all">
        <span className="big">Посмотреть все товары</span>
        <Suspense fallback={<span className="hint">…</span>}>
          <SeeAllHint />
        </Suspense>
      </Link>
    </section>
  )
}

function ShopMeta() {
  const { data } = useSuspenseQuery(getHomeItemsQueryOptions())
  return (
    <span className="mono text-[12px] tracking-[0.08em]">
      {Math.min(10, data.data.length)} / {data.count} SKU
    </span>
  )
}

function HomeProducts() {
  const { data } = useSuspenseQuery(getHomeItemsQueryOptions())
  return <ProductGrid items={data.data.slice(0, 10)} columns={5} />
}

function SeeAllHint() {
  const { data } = useSuspenseQuery(getHomeItemsQueryOptions())
  return <span className="hint">{data.count} ПОЗИЦИЙ · ДРОП №04</span>
}

function getHomeItemsQueryOptions() {
  return {
    queryKey: ["home-items"],
    queryFn: async () =>
      (await itemsReadItemsPublic({ query: { limit: 10 } })).data!,
  }
}
