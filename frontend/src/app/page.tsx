import { AssistantAction } from "@/components/assistant/action";
import { Button } from "@/components/ui/button";

function Icon({ name, className = "" }: { name: string; className?: string }) {
  return (
    <svg className={`line-icon ${className}`} aria-hidden="true">
      <use href={`#i-${name}`} />
    </svg>
  );
}

const categories = [
  {
    icon: "bolt",
    title: "Автоматы и защита",
    note: "Выключатели, УЗО, реле",
    query: "Найди автомат Legrand",
  },
  {
    icon: "lamp",
    title: "Свет и освещение",
    note: "Лампы и светильники",
    query: "Найди светильник",
  },
  {
    icon: "cable",
    title: "Кабель и провод",
    note: "Подбор под вашу задачу",
    query: "Найди кабель",
  },
  { icon: "socket", title: "Розетки и монтаж", note: "Для дома и бизнеса", query: "Найди розетки" },
];
const capabilities = [
  [
    "01",
    "Проверить товар",
    "Характеристики, остатки по складам и сертификаты, если они есть в источнике.",
    "box",
  ],
  [
    "02",
    "Найти замену",
    "Доступные аналоги с объяснением совпадений и отличий. Вы выбираете подходящий.",
    "bolt",
  ],
  [
    "03",
    "Разобрать список",
    "Excel, Word, PDF или фото. Каждая распознанная позиция остаётся видимой.",
    "file",
  ],
  [
    "04",
    "Собрать корзину",
    "Проверка количества и отдельное согласие перед добавлением выбранных товаров.",
    "cart",
  ],
];
const faq = [
  [
    "Какие файлы можно отправить?",
    "Excel, Word, PDF и JPEG/PNG, а также TXT и CSV. До 5 файлов по 8 МБ. При нечёткой маркировке помощник попросит код или крупное фото. Перед добавлением сверьте распознанные строки с оригиналом.",
  ],
  [
    "Откуда берутся цена и наличие?",
    "Из каталога ekt.kz. Под карточкой указан источник и время получения. Если данных недостаточно или они противоречат друг другу, помощник покажет ограничение и предложит уточнить вопрос у менеджера.",
  ],
  [
    "Товар добавится без моего согласия?",
    "Нет. Сначала вы проверяете позиции и количество, затем отдельно нажимаете «Да, добавить». Загрузка файла и ответ «ок» не меняют корзину.",
  ],
  [
    "Можно оформить заказ в этой версии?",
    "Здесь можно собрать и проверить свою корзину. Заказ, оплату и резерв в ekt.kz эта версия не создаёт. Завершить покупку можно на сайте магазина или с менеджером.",
  ],
  [
    "Что происходит с документами?",
    "После отправки OpenAI анализирует текст и вложения. Файлы не записываются на диск или в базу приложения; сохранение объекта ответа отключено. Не отправляйте платёжные данные. История и файлы автоматически менеджеру не передаются.",
  ],
];

export default function Home() {
  return (
    <div className="site-shell">
      <a className="skip-link" href="#main">
        К основному содержимому
      </a>
      <header className="site-header">
        <div className="site-container flex h-20 items-center justify-between gap-5">
          <a className="flex items-center gap-3" href="#" aria-label="ЭКТ — главная">
            <span className="brand-symbol">
              <Icon name="bolt" />
            </span>
            <span className="text-xl font-bold tracking-tight">
              ЭКТ
              <span className="ml-2 text-xs font-normal tracking-normal text-muted-foreground">
                / помощник
              </span>
            </span>
          </a>
          <nav
            className="hidden items-center gap-7 text-sm text-muted-foreground md:flex"
            aria-label="Главная навигация"
          >
            <a href="#catalog">Каталог</a>
            <a href="#assistant">Возможности</a>
            <a href="#how">Как это работает</a>
          </nav>
          <AssistantAction data-open variant="outline" className="rounded-full px-4 sm:px-5">
            Открыть помощника <span aria-hidden="true">↗</span>
          </AssistantAction>
        </div>
      </header>

      <main id="main">
        <section className="site-container hero-layout" aria-labelledby="heroTitle">
          <div className="hero-content">
            <p className="eyebrow">
              <span className="status-light" />
              ЭЛЕКТРОКОМПЛЕКТ · AI ПОМОЩНИК
            </p>
            <h1 id="heroTitle">
              От вопроса
              <br />к{" "}
              <span className="text-highlight">
                вашей
                <br className="hidden lg:block" /> корзине.
              </span>
            </h1>
            <p className="hero-description">
              Электротехника с понятным выбором. Спросите о товаре или отправьте спецификацию —
              проверим каталог и поможем собрать нужное.
            </p>
            <div className="flex flex-wrap items-center gap-3">
              <AssistantAction data-open size="lg" className="h-12 rounded-xl px-6">
                Начать разговор <Icon name="arrow" />
              </AssistantAction>
              <Button asChild size="lg" variant="outline" className="h-12 rounded-xl px-5">
                <a href="#start">
                  Попробовать на задаче <span aria-hidden="true">↗</span>
                </a>
              </Button>
            </div>
            <p className="mt-6 flex items-center gap-2 text-xs text-muted-foreground">
              <Icon name="shield" className="text-primary" />В корзину — только с вашего
              подтверждения
            </p>
          </div>
          <div className="hero-visual" aria-label="Пример пути от запроса до выбора товара">
            <svg className="circuit-lines" viewBox="0 0 600 600" fill="none" aria-hidden="true">
              <defs>
                <linearGradient id="rgb-path">
                  <stop stopColor="#69e6ad" />
                  <stop offset=".48" stopColor="#64caff" />
                  <stop offset="1" stopColor="#c395ff" />
                </linearGradient>
              </defs>
              <path
                className="circuit-base"
                d="M0 145H110L160 195H330L385 250H600M0 440H140L210 370H340L435 465H600M310 0V95L360 145V450L420 510V600"
              />
              <path
                className="circuit-travel"
                d="M0 145H110L160 195H330L385 250H600M0 440H140L210 370H340L435 465H600M310 0V95L360 145V450L420 510V600"
              />
            </svg>
            <div className="workflow-card rgb-border">
              <div className="flex items-center justify-between border-b border-white/8 px-6 py-4 text-xs">
                <span className="flex items-center gap-2 font-medium">
                  <span className="text-lg text-primary">✧</span>ЭКТ помощник
                </span>
                <span className="text-muted-foreground">Пример подбора</span>
              </div>
              <div className="space-y-5 p-6">
                <div className="example-request">
                  <span className="mb-2 block text-[10px] uppercase tracking-[.16em] text-muted-foreground">
                    Ваш запрос
                  </span>
                  «Нужен Legrand 027005,
                  <br />2 штуки. Что есть в наличии?»
                </div>
                <div className="flex items-center gap-4">
                  <div className="device-sketch" aria-hidden="true">
                    <div className="device-terminals">
                      <i />
                      <i />
                      <i />
                    </div>
                    <b>DRX 125</b>
                    <div className="device-switch" />
                    <span>Legrand</span>
                  </div>
                  <div>
                    <span className="mb-2 inline-block rounded-md border border-primary/20 bg-primary/5 px-2 py-1 text-[10px] text-primary">
                      Подбор по коду
                    </span>
                    <h2 className="text-lg font-semibold">Legrand DRX125 MT</h2>
                    <p className="mt-1 font-mono text-xs text-muted-foreground">
                      027005 · автоматический выключатель
                    </p>
                  </div>
                </div>
                <div className="space-y-3 border-t border-white/8 pt-4 text-xs text-muted-foreground">
                  <p className="flex items-center gap-3">
                    <Icon name="box" className="text-cyan-300" />
                    Характеристики и остатки из каталога
                  </p>
                  <p className="flex items-center gap-3">
                    <Icon name="shield" className="text-violet-300" />
                    Проверка выбранного количества
                  </p>
                </div>
                <div className="flex items-center justify-between rounded-xl border border-primary/20 bg-primary/5 px-4 py-3 text-xs">
                  <span className="text-primary">Решение остаётся за вами</span>
                  <Icon name="check" className="text-primary" />
                </div>
              </div>
            </div>
            <div className="visual-caption">
              <span className="status-light" />
              Товар → проверка → ваше согласие
            </div>
          </div>
        </section>

        <div className="site-container">
          <div className="trust-strip">
            <p>
              <Icon name="box" />
              <span>
                Факты <strong>из каталога</strong>
              </span>
            </p>
            <p>
              <Icon name="file" />
              <span>
                Текст, <strong>документы и фото</strong>
              </span>
            </p>
            <p>
              <Icon name="chat" />
              <span>
                Всё <strong>в одном чате</strong>
              </span>
            </p>
          </div>
        </div>

        <section id="start" className="site-container section-space">
          <div className="section-title">
            <div>
              <p className="eyebrow">БЫСТРЫЙ СТАРТ</p>
              <h2>С чего начнём?</h2>
            </div>
            <p>
              Один товар или целая закупка.
              <br />
              Выберите удобный способ.
            </p>
          </div>
          <div className="grid gap-4 md:grid-cols-3">
            <article className="task-card">
              <span className="tile-icon text-primary">
                <Icon name="box" />
              </span>
              <h3>Есть артикул</h3>
              <p>Узнайте характеристики, наличие и доступные документы на товар.</p>
              <AssistantAction
                data-query="Есть ли 027005 в наличии? Покажи характеристики и сертификат."
                variant="ghost"
                className="task-link"
              >
                Проверить пример 027005 ↗
              </AssistantAction>
            </article>
            <article className="task-card featured-card">
              <span className="tile-icon text-cyan-300">
                <Icon name="file" />
              </span>
              <h3>Есть спецификация</h3>
              <p>Загрузите список. Проверьте каждую позицию, количество и совпадение.</p>
              <AssistantAction data-attach variant="ghost" className="task-link">
                Прикрепить спецификацию ↗
              </AssistantAction>
            </article>
            <article className="task-card">
              <span className="tile-icon text-violet-300">
                <Icon name="bolt" />
              </span>
              <h3>Нужна замена</h3>
              <p>Подберите доступный аналог и сравните значимые отличия.</p>
              <AssistantAction
                data-query="Есть ли ярп4520? Если нет, предложи аналог."
                variant="ghost"
                className="task-link"
              >
                Найти аналог ↗
              </AssistantAction>
            </article>
          </div>
        </section>

        <section id="catalog" className="site-container section-space pt-0!">
          <div className="section-title">
            <div>
              <p className="eyebrow">КАТАЛОГ EKT.KZ</p>
              <h2>Что подбираем сегодня?</h2>
            </div>
            <a
              className="text-sm text-muted-foreground"
              href="https://ekt.kz/catalog/"
              target="_blank"
              rel="noopener noreferrer"
            >
              Весь каталог ↗
            </a>
          </div>
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            {categories.map((c) => (
              <AssistantAction
                key={c.title}
                data-query={c.query}
                variant="outline"
                className="category-tile"
              >
                <span className="flex w-full items-center justify-between">
                  <Icon name={c.icon} />
                  <span className="text-muted-foreground">↗</span>
                </span>
                <span className="mt-5 text-sm font-semibold sm:text-base">{c.title}</span>
                <span className="text-left text-xs font-normal text-muted-foreground">
                  {c.note}
                </span>
              </AssistantAction>
            ))}
          </div>
        </section>

        <section id="assistant" className="capabilities-band">
          <div className="site-container section-space">
            <div className="section-title">
              <div>
                <p className="eyebrow">МЕНЬШЕ РУЧНОГО ПОИСКА</p>
                <h2>
                  Ваш список.
                  <br />
                  Понятный следующий шаг.
                </h2>
              </div>
              <p>
                От вопроса о характеристиках до проверенной партии. Все уточнения остаются рядом с
                товарами.
              </p>
            </div>
            <div className="grid gap-x-10 gap-y-8 sm:grid-cols-2 lg:grid-cols-4">
              {capabilities.map(([n, title, text, icon]) => (
                <article key={n} className="capability-item">
                  <div className="mb-5 flex items-center justify-between">
                    <span className="font-mono text-xs text-muted-foreground">/{n}</span>
                    <Icon name={icon!} className="text-primary" />
                  </div>
                  <h3 className="mb-3 text-lg font-medium">{title}</h3>
                  <p className="text-sm leading-7 text-muted-foreground">{text}</p>
                </article>
              ))}
            </div>
          </div>
        </section>

        <section id="how" className="site-container section-space">
          <div className="section-title">
            <div>
              <p className="eyebrow">ТРИ ПРОСТЫХ ШАГА</p>
              <h2>Собрать закупку проще.</h2>
            </div>
          </div>
          <div className="grid gap-8 md:grid-cols-3">
            {[
              ["01", "Расскажите, что нужно", "Напишите артикул, задачу или прикрепите документ."],
              ["02", "Проверьте результат", "Сверьте товары, количество и предложенные замены."],
              [
                "03",
                "Подтвердите выбор",
                "Отдельное согласие — и выбранные позиции в вашей корзине.",
              ],
            ].map(([n, title, text]) => (
              <div key={n} className="step-card">
                <span>{n}</span>
                <h3>{title}</h3>
                <p>{text}</p>
              </div>
            ))}
          </div>
          <div className="file-band mt-10">
            <div className="flex items-center gap-4">
              <Icon name="clip" className="text-cyan-300" />
              <div>
                <p className="font-medium">Начните с файла, который уже есть</p>
                <p className="mt-1 text-xs text-muted-foreground">
                  До 5 вложений по 8 МБ · без платёжных данных
                </p>
              </div>
            </div>
            <div className="flex flex-wrap gap-2">
              {["XLSX", "DOCX", "PDF", "JPEG"].map((f) => (
                <span className="file-tag" key={f}>
                  {f}
                </span>
              ))}
            </div>
          </div>
        </section>

        <section id="faq" className="site-container grid gap-10 pb-24 md:grid-cols-[.8fr_1.2fr]">
          <div>
            <p className="eyebrow">ОСТАЛИСЬ ВОПРОСЫ?</p>
            <h2 className="section-heading">Поможем разобраться.</h2>
            <p className="mb-6 mt-4 max-w-sm text-sm leading-7 text-muted-foreground">
              Если данных для решения недостаточно, можно уточнить подбор у менеджера магазина.
            </p>
            <AssistantAction data-manager variant="outline" className="rounded-xl">
              Связаться с менеджером <span aria-hidden="true">↗</span>
            </AssistantAction>
          </div>
          <div className="faq-list">
            {faq.map(([q, a]) => (
              <details key={q}>
                <summary>
                  {q}
                  <span aria-hidden="true">+</span>
                </summary>
                <p>{a}</p>
              </details>
            ))}
          </div>
        </section>
      </main>
      <footer className="site-footer">
        <div className="site-container flex flex-wrap items-center justify-between gap-6 py-8">
          <div>
            <p className="text-sm font-semibold">
              ЭКТ <span className="ml-2 font-normal text-muted-foreground">Электрокомплект</span>
            </p>
            <p className="mt-2 text-xs text-muted-foreground">
              HackAlem AI · 2026 · Корзина приложения, без оформления заказа
            </p>
          </div>
          <a
            className="text-sm text-muted-foreground"
            href="https://ekt.kz/"
            target="_blank"
            rel="noopener noreferrer"
          >
            Сайт магазина ↗
          </a>
        </div>
      </footer>
      <noscript>
        <p className="site-container py-6">
          Для работы помощника включите JavaScript. Каталог доступен на{" "}
          <a href="https://ekt.kz/">ekt.kz</a>.
        </p>
      </noscript>
    </div>
  );
}
