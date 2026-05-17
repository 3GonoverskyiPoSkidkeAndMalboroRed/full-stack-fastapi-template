import { createFileRoute, Link } from "@tanstack/react-router"
import { ArrowRight } from "lucide-react"

import { Button } from "@/components/ui/button"

export const Route = createFileRoute("/_public/")({
  component: HomePage,
  head: () => ({
    meta: [{ title: "Главная — FastAPI Template" }],
  }),
})

function HomePage() {
  return (
    <section className="relative overflow-hidden rounded-xl">
      <img
        src="https://picsum.photos/seed/storefront/1600/700"
        alt="Витрина магазина"
        className="h-[420px] w-full object-cover"
      />
      <div className="absolute inset-0 flex items-center bg-gradient-to-r from-black/70 via-black/40 to-transparent">
        <div className="max-w-xl space-y-5 px-6 text-white md:px-12">
          <h1 className="text-4xl leading-tight font-bold md:text-5xl">
            Добро пожаловать в магазин
          </h1>
          <p className="text-base text-white/90 md:text-lg">
            Подобрали для вас стильные вещи на каждый день — загляните в каталог
            и найдите своё.
          </p>
          <Button asChild size="lg">
            <Link to="/catalog">
              Перейти в каталог
              <ArrowRight className="ml-1 size-4" />
            </Link>
          </Button>
        </div>
      </div>
    </section>
  )
}
