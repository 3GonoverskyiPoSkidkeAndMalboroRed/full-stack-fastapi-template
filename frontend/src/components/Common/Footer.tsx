import { Link } from "@tanstack/react-router"

const navLinks: Array<{ label: string; to: string }> = [
  { label: "Главная", to: "/" },
  { label: "Магазин", to: "/catalog" },
  { label: "Кабинет", to: "/account" },
]

const socialLinks: Array<{ label: string; href: string }> = [
  { label: "vk.com/reestr13", href: "https://vk.com" },
  { label: "t.me/reestr13", href: "https://t.me" },
]

const docsLinks: Array<{ label: string; to: string }> = [
  { label: "Пользовательское соглашение", to: "/docs/terms" },
  { label: "Политика конфиденциальности", to: "/docs/privacy" },
  { label: "Условия доставки", to: "/docs/delivery" },
  { label: "Условия возврата", to: "/docs/refund" },
  { label: "Контакты", to: "/docs/contacts" },
]

export function Footer() {
  const currentYear = new Date().getFullYear()

  return (
    <footer className="bg-paper text-ink px-6 pt-12 pb-7">
      <div className="border-ink grid [grid-template-columns:1.4fr_1fr_1fr_1fr] gap-8 border-b pb-8 max-lg:[grid-template-columns:1fr_1fr] max-sm:grid-cols-1">
        <div>
          <div className="brand-mark text-[42px] leading-none">РЕЕСТР13</div>
          <p className="text-muted-foregroundmt-4 max-w-[36ch] text-[13px] leading-relaxed">
            То, что скрыто от масс...
          </p>
        </div>

        <FooterColumn title="Навигация">
          {navLinks.map((link) => (
            <li key={link.label}>
              <Link to={link.to} className="footer-link">
                {link.label}
              </Link>
            </li>
          ))}
        </FooterColumn>

        <FooterColumn title="Соцсети">
          {socialLinks.map((link) => (
            <li key={link.label}>
              <a
                href={link.href}
                target="_blank"
                rel="noreferrer"
                className="footer-link"
              >
                {link.label}
              </a>
            </li>
          ))}
        </FooterColumn>

        <FooterColumn title="Документы">
          {docsLinks.map((link) => (
            <li key={link.label}>
              <Link to={link.to} className="footer-link">
                {link.label}
              </Link>
            </li>
          ))}
        </FooterColumn>
      </div>

      <div className="text-muted-foregroundflex flex-wrap items-start justify-between gap-6 pt-6 text-[11px] leading-relaxed">
        <p className="max-w-[62ch]">
          Специально для АУГСГИП. Нагабедян Денис Сергеевич
        </p>
        <span className="mono upper">© {currentYear} · РЕЕСТР13 v0.1</span>
      </div>
    </footer>
  )
}

function FooterColumn({
  title,
  children,
}: {
  title: string
  children: React.ReactNode
}) {
  return (
    <div>
      <h5 className="text-muted-foregroundmb-4 text-[11px] font-medium tracking-[0.2em] uppercase">
        {title}
      </h5>
      <ul className="flex list-none flex-col gap-2 text-[14px]">{children}</ul>
    </div>
  )
}
