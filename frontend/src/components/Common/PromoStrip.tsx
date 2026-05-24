import { Link } from "@tanstack/react-router"

export function PromoStrip() {
  return (
    <div className="bg-ink text-paper flex h-9 items-center justify-center gap-4 px-6 text-xs">
      <span className="mono upper text-[11px] tracking-[0.18em]">
        РЕЕСТР13 · ЛЕТО 2026
      </span>
      <span className="upper opacity-70">Бесплатная доставка от 5 000 ₽</span>
      <Link
        to="/catalog"
        className="upper inline-flex items-center gap-2 tracking-[0.14em]"
      >
        В каталог <span className="promo-arrow" />
      </Link>
    </div>
  )
}
