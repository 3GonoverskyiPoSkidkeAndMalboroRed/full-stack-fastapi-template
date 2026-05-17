
export function Footer() {
  const currentYear = new Date().getFullYear()

  return (
    <footer className="border-t px-6 py-4">
      <div className="flex flex-col items-center justify-between gap-4 sm:flex-row">
        <p className="text-muted-foreground text-sm">
          Денис Сергеевич Нагабедян 11ИСП-232к - {currentYear}
        </p>
      </div>
    </footer>
  )
}
