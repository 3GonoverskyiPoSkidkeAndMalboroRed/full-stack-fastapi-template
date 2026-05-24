import { createFileRoute } from "@tanstack/react-router"

import ChangePassword from "@/components/UserSettings/ChangePassword"
import DeleteAccount from "@/components/UserSettings/DeleteAccount"
import UserCards from "@/components/UserSettings/UserCards"
import UserInformation from "@/components/UserSettings/UserInformation"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import useAuth from "@/hooks/useAuth"

const tabsConfig = [
  { value: "my-profile", title: "Профиль", component: UserInformation },
  { value: "cards", title: "Мои карты", component: UserCards },
  { value: "password", title: "Пароль", component: ChangePassword },
  { value: "danger-zone", title: "Опасная зона", component: DeleteAccount },
]

export const Route = createFileRoute("/_authed/settings")({
  component: UserSettings,
  head: () => ({
    meta: [{ title: "Настройки — РЕЕСТР13" }],
  }),
})

function UserSettings() {
  const { user: currentUser } = useAuth()

  if (!currentUser) {
    return null
  }

  return (
    <section>
      <header className="sec-head">
        <div>
          <div className="mono text-muted-foreground mb-3 text-[11px] tracking-[0.2em] uppercase">
            Раздел / 04 · Настройки
          </div>
          <h2>Настройки пользователя</h2>
        </div>
        <span className="text-muted-foreground hidden text-[13px] sm:inline">
          Управляйте настройками аккаунта и предпочтениями
        </span>
      </header>

      <div className="frame py-8">
        <Tabs defaultValue="my-profile">
          <TabsList className="border-ink h-auto gap-2 rounded-none border bg-transparent p-1">
            {tabsConfig.map((tab) => (
              <TabsTrigger
                key={tab.value}
                value={tab.value}
                className="data-[state=active]:bg-ink data-[state=active]:text-paper rounded-none text-[11px] tracking-[0.18em] uppercase"
              >
                {tab.title}
              </TabsTrigger>
            ))}
          </TabsList>
          {tabsConfig.map((tab) => (
            <TabsContent key={tab.value} value={tab.value} className="pt-6">
              <tab.component />
            </TabsContent>
          ))}
        </Tabs>
      </div>
    </section>
  )
}
