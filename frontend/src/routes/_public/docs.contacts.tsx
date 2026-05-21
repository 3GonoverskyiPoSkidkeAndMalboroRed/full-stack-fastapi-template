import { createFileRoute } from "@tanstack/react-router"

import { LegalPage } from "@/components/Legal/LegalPage"

export const Route = createFileRoute("/_public/docs/contacts")({
  component: ContactsPage,
  head: () => ({ meta: [{ title: "Контакты — РЕЕСТР13" }] }),
})

function ContactsPage() {
  return (
    <LegalPage
      kicker="Раздел / 10 · Документы"
      title="Контакты"
      effectiveDate="21.05.2026"
      intro="Реквизиты и каналы связи для покупателей, партнёров и контролирующих органов."
      sections={[
        {
          heading: "Реквизиты продавца",
          body: (
            <>
              <p>
                <strong>Полное наименование:</strong> Индивидуальный
                предприниматель Нагабедян Денис Сергеевич.
              </p>
              <p>
                <strong>ИНН:</strong> 591703265101
                <br />
                <strong>ОГРНИП:</strong> 326590000000000
                <br />
                <strong>Юридический адрес:</strong> 614000, г. Пермь, ул.
                Ленина, д. 13, кв. 1.
              </p>
              <p>
                <strong>Банковские реквизиты:</strong> р/с 40802 810 0 0000
                0000000 в АО «Тинькофф Банк», к/с 30101 810 1 4525 0000974, БИК
                044525974.
              </p>
            </>
          ),
        },
        {
          heading: "Контактные данные",
          body: (
            <>
              <ul>
                <li>
                  <strong>Поддержка покупателей:</strong>{" "}
                  <a href="mailto:support@reestr13.ru">support@reestr13.ru</a>
                </li>
                <li>
                  <strong>Заявления на возврат:</strong>{" "}
                  <a href="mailto:refund@reestr13.ru">refund@reestr13.ru</a>
                </li>
                <li>
                  <strong>Персональные данные:</strong>{" "}
                  <a href="mailto:privacy@reestr13.ru">privacy@reestr13.ru</a>
                </li>
                <li>
                  <strong>Сотрудничество и СМИ:</strong>{" "}
                  <a href="mailto:press@reestr13.ru">press@reestr13.ru</a>
                </li>
                <li>
                  <strong>Телефон:</strong> +7 (902) 800-13-13 (звонки и
                  мессенджеры).
                </li>
              </ul>
            </>
          ),
        },
        {
          heading: "Часы работы службы поддержки",
          body: (
            <>
              <p>
                Понедельник — пятница: 10:00–19:00 (МСК).
                <br />
                Суббота — воскресенье: 12:00–17:00 (МСК).
              </p>
              <p>
                Письма, поступившие в нерабочее время, обрабатываются в
                ближайший рабочий день. Срок ответа — не более 3 (трёх) рабочих
                дней.
              </p>
            </>
          ),
        },
        {
          heading: "Социальные сети",
          body: (
            <>
              <ul>
                <li>
                  ВКонтакте:{" "}
                  <a
                    href="https://vk.com/reestr13"
                    target="_blank"
                    rel="noreferrer"
                  >
                    vk.com/reestr13
                  </a>
                </li>
                <li>
                  Telegram:{" "}
                  <a
                    href="https://t.me/reestr13"
                    target="_blank"
                    rel="noreferrer"
                  >
                    t.me/reestr13
                  </a>
                </li>
              </ul>
            </>
          ),
        },
        {
          heading: "Контролирующие органы",
          body: (
            <>
              <p>
                Управление Роспотребнадзора по Пермскому краю: 614016, г. Пермь,
                ул. Куйбышева, д. 50; телефон: +7 (342) 239-34-09.
              </p>
              <p>
                Управление Роскомнадзора по Приволжскому федеральному округу:
                603022, г. Нижний Новгород, ул. Большая Печёрская, д. 32/5;
                телефон: +7 (831) 416-21-12.
              </p>
            </>
          ),
        },
      ]}
    />
  )
}
