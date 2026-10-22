# VETOGRAM 2.0 — аудит подготовки выпуска, 22 октября 2026

**Статус: DRAFT / NOT PRODUCTION READY. Production deploy не выполнялся.**

## Проверенная база

- Репозиторий: `margaryanlabs/Telegram-story-bot`.
- Main и последний проверенный production-коммит: `6504a387d2b88961df3689792cd1c6d4d0e68571`.
- Production не изменён. Служебные сведения аккаунта и deployment IDs исключены из публикуемого отчёта.
- PR #178 открыт, draft, не слит; проверенный head `78ba850180c96a3e1455d4231c8fc0abbecc0059`.
- Новая ветка `feat/vetogram-2-unified-onboarding-20261022` создана поверх этого head. PR #178 и его ветка не переписывались, force push не использовался.
- Git→Vercel integration проверена до push по метаданным реальных preview deployments ветки #178. Production связан с `main`; эти previews имеют target=null и были CANCELED. Успешный preview не считается QA.

## Что найдено и исправлено

1. В main `viewer-sync` уже присутствует в router. PR #178 добавлял второй одинаковый ключ: локальная проверка действительно падала (`33 !== 32`). Дубликат удалён; маршрут сохранён. Проверены все 32 API через настоящий router с замоканными/запрещёнными внешними вызовами.
2. Три старых header-теста требовали первоначально свёрнутую панель и автосворачивание. Обновлены под утверждённое поведение: развёрнута при входе, сворачивание только нажатием. Итого базовый PR #178 имел четыре локальных падения до работы.
3. Business-мастер создавал пустой `BusinessBotRights`, из-за чего не выдавал Stories. Добавлено отдельное непредустановленное согласие. `teleproto 1.229.0` сериализует `manageStories` в wire flag 13 — проверено тестом, а не только наличием JS-поля.
4. Существующее собственное Business-подключение раньше блокировалось. Теперь оно распознаётся; по умолчанию сохраняются текущие права, scope, выбранные чаты и исключения. Изменения требуют нового подтверждения.
5. Добавлены широкие и выбранные recipient modes, исключения, отдельный отзыв Stories и полный Business revoke. Другая Business-система не заменяется мастером.
6. Свежий подписанный owner-bound snapshot с TTL 5 минут защищает от устаревшего согласия. Перед записью выполняется дополнительное чтение Telegram. Повторная запись после ошибки/таймаута не выполняется: только чтение фактического результата. SDK request retries для Business-записей ограничены одним вызовом. В одном экземпляре функции действует owner lock.
7. Anti-Delete, Edit History и Inbox включаются только при отдельном явном opt-in. Stories-only согласие не включает архив автоматически. Сбой сохранения настроек архива возвращается как частичное завершение, без отката Telegram-подключения.
8. Production capability gate выключен по умолчанию. Prepare возвращает `enabled:false`; автоматический UI continuation не показывает новый мастер. Полное включение потребует отдельного решения о выпуске; env в этом запуске не менялись.
9. Исправлена существовавшая double-escaped regexp в `api/viewer-sync.js`: сервер мог удалять цифры из номера. Нормализация номера теперь общая с auth helper, покрыта поведенческими тестами.
10. Сохранены QR, phone и SRP 2FA. Добавлены email-code SignIn, email setup по явному согласию, переход к следующему коду и немедленная авторизация `SentCodeSuccess`. Challenge хранит только auth-state в существующем шифровании; email, введённый код и пароль не добавлены в сохраняемый payload. Email help/back сохраняет правильный delivery.
11. Проверка сохранённого Bot API Connection ID стала read-only: prepare больше не может записать устаревший ID поверх нового из webhook. Права и состояние проверяются отдельно; отсутствие нового ID обозначается как pending webhook.
12. Ошибка durable сохранения connection update теперь возвращает HTTP 503 и допускает повторную доставку Telegram. Последовательный delayed disable старого ID не очищает уже известный новый ID. Это не обеспечивает глобальную атомарность — см. ограничения.
13. Сохранён официальный split-V SVG. Wordmark разделён на серебристый VETO / коралловый GRAM. Унаследованные expanded header и Telegram safe-area исправления сохранены; добавлены ограниченные стили для других экранов/диалогов.
14. Логи auth-ошибок и router больше не выводят сырое upstream error message. Проверка Mini App подписи, Telegram ID и реального MTProto owner сохранена.
15. Зафиксирован dependency lockfile; GitHub verification использует `npm ci`. Новых production-зависимостей не добавлено.

## Файлы

| Группа | Изменённые файлы | Назначение |
|---|---|---|
| Business | `lib/telegram-business-consent.js`, `api/business-wizard.js` | Consent, scope, rights, snapshot, verification, revoke, production gate |
| Авторизация | `api/viewer-sync.js`, `lib/viewer-sync-telegram.js`, `lib/telegram-auth-feedback.js`, `lib/telegram-history-backup.js` | Phone regexp, email/QR/2FA, client retry options |
| Доставка | `api/webhook-v7.js`, `api/router.js` | Retryable connection persistence, old-disable guard, 32 routes, безопасные ошибки |
| Интерфейс | `public/app.js`, `public/privacy.js`, `public/studio.html`, `public/vetogram-header.css`, `public/vetogram-header.js` | Unified handoff, отдельные согласия, статусы, отзыв, бренд и safe areas |
| Сборка | `.gitignore`, `package-lock.json`, `.github/workflows/vetogram-verification.yml` | Повторяемая установка и исключение временных файлов |
| Новые тесты | `tests/vetogram-unified-business.test.js`, `tests/vetogram-auth-email.test.js`, `tests/vetogram-webhook-flow.test.js`, `tests/vetogram-business-publisher.test.js`, `tests/vetogram-onboarding-controller.test.js` | Поведенческие mock/VM tests |
| Обновлённые тесты | `tests/telegram-business-wizard.test.js`, `tests/telegram-login-resume.test.js`, `tests/telegram-mirror-full-coverage.test.js`, `tests/veto-brand-identity-consistency.test.js`, `tests/veto-messenger-visual-rebirth.test.js`, `tests/vetogram-header.test.js`, `tests/vetogram-hobby-api-router.test.js` | Утверждённое поведение и runtime route smoke |
| Унаследовано из #178 | `tests/vetogram-mobile-header-safearea.test.js` и UI-изменения | Исправления исходного PR сохранены |

## Что не изменено

Нет diff относительно head #178 в:

- `api/telegram-stories.js`: тот же GetAllStories/GetStoriesByID, загрузка разрешённого медиа и read-only allowlist. Не добавлены readStories/incrementStoryViews и Premium Stealth Mode.
- `lib/story-app-publisher.js`: основной Business Bot API `postStory`, дополнительный MTProto Business transport, аудитории и обработка ошибок.
- `api/miniapp.js`: приоритет Business публикации и существующий user fallback.
- `lib/viewer-sync-crypto.js`, `lib/viewer-sync-keyring.js`, `lib/viewer-sync-store.js`: прежние криптография, ключи, storage gateway и операции.
- `api/webhook-v8.js`: прежняя проверка webhook secret и делегирование v7.
- Модули живых чатов/отправки, Intelligence, Voice, Studio, Vault, Reader, поиск и навигационные разделы не переписаны.

Базы, реальные архивы, реальные сессии, ключи и production environment variables не читались/не изменялись ради тестирования. Миграции, Neon reset, Supabase deletion, paywall и платежи отсутствуют. Платные AI API/Lovable не вызывались.

## Реальные результаты локальной проверки

`npm run vercel-build` завершён успешно на Node 24.19.0: syntax checks + **305 tests, 305 pass, 0 fail, 0 skipped**. `git diff --check` — clean.

Новые поведенческие проверки включают:

- Сериализацию реального teleproto `manageStories`, минимальные новые права и сохранение действующих.
- Все существующие/будущие, контакты/не-контакты, выбранные чаты и исключения; отклонение чужих/повторных/конфликтных peer IDs.
- Existing connection no-op; изменение только Stories без изменения recipient scope; отдельный revoke Stories и полный disconnect.
- Другого бота, устаревшее/чужое/подделанное/просроченное согласие, изменение состояния перед записью, same-instance overlapping writes.
- Ошибку после успешной записи и ошибку до записи: одна попытка мутации, затем read reconciliation.
- Подписанный Mini App запрос и запрет hidden Anti-Delete; частичную ошибку settings store.
- Production capability off без чтения сессии; UI capability fallback и реальные обработчики consent в VM с mock DOM.
- Phone normalization; QR success/2FA handoff; phone/email SignIn; email setup и SentCodeSuccess; password helper.
- Настоящий webhook-v8→v7 на моках: сообщение→архив, edit→версия/уведомление, delete→сохранённая копия/уведомление владельцу. Сбои записи возвращают 503.
- Смену ID в connection update и повторную доставку после storage failure; чужой owner при Bot API verification отклоняется. Prepare не выполняет upsert старого ID.
- Настоящий `publishPhotoStory` вызывает `postStory` с новым Business ID и multipart фото; mock не требует Premium-флага и не запускает user SendStory.
- Все 32 обработчика router реально импортируются и отвечают на запросы без пользовательской авторизации. Это проверка маршрутизации/auth-boundary, не полная проверка успешных действий каждого модуля.

Mock storage и Telegram ответы не доказывают состояние реального Telegram или Neon.

## Live QA — не подменять unit-тестами

| Проверка | Локальная проверка | Реальный Telegram |
|---|---|---|
| QR / phone login | Mock helpers + existing regressions PASS | NOT VERIFIED |
| Email code / email setup / 2FA | Mock helpers PASS | NOT VERIFIED |
| Повторный вход / сохранённая сессия | Existing regressions + unchanged crypto/storage | NOT VERIFIED |
| Existing/new Business, сохранение scope/Stories | Mock PASS | NOT VERIFIED |
| Stories без Premium до/после | Business transport mock PASS | NOT VERIFIED; нужна сравнительная публикация |
| Ghost View | Механизм не изменён; existing regressions PASS | Подтверждён пользователем до работы; новый двухаккаунтный тест NOT VERIFIED |
| Anti-Delete / Edit History / alerts | Webhook integration mock PASS | NOT VERIFIED |
| Connection ID / webhook recovery | Mock PASS; concurrency limitation ниже | NOT VERIFIED |
| Android/iOS safe area, панель, скролл, нижняя навигация | Static/VM tests PASS | NOT VERIFIED |
| Существующие данные/сессии | Неизменённый storage/crypto, без миграций | Read-only live integrity comparison NOT VERIFIED |

Полноценный browser layout QA не выполнен: установленный Playwright не имел Chromium; разрешённая попытка установки вернула повреждённый архив (0 MiB, unzip error). Отсутствие визуального браузерного QA нельзя считать успешным Android/iOS тестом.

## GitHub Actions и preview

У первоначального head #178 workflow run `39744671911`, job `119710060307` завершён failure, но API возвращает `steps:null`; попытка чтения логов вернула BlobNotFound/404. Поэтому конкретная причина **этого** remote failure не установлена. Доказано отдельно: базовый код действительно имел четыре локальных test failure; они исправлены. Нельзя утверждать, что GitHub failure был только runner error.

Результаты CI/preview нового коммита фиксируются отдельно в `VETOGRAM_2_REMOTE_STATUS_20261022.md`, если доступны. Production не публиковался.

## Независимый повторный аудит

Read-only повторный аудит выполнен отдельным агентом по явному требованию пользователя. Найденные и закрытые замечания:

- Неполный UI production gate и неточные заявленные permissions.
- Потенциальный overwrite нового ID read-only проверкой старого ID.
- Потеря email шага, непринятый SentCodeSuccess и неверный email help/back.
- Swallowed durable upsert failure с ACK200.

Аудитор независимо выполнял безопасные локальные тесты. Финальный полный прогон после всех исправлений — 305/305. Независимый аудит не включал живые аккаунты или внешнюю сертификацию безопасности.

## Оставшиеся ограничения и блокеры выпуска

1. **Межинстансная конкурентность:** Telegram `updateConnectedBot` не предоставляет expected-version/CAS. Snapshot + повторное чтение + owner lock одного экземпляра не обеспечивают атомарность между другим клиентом Telegram и двумя разными экземплярами Vercel. Смена чужого бота в узком интервале read→write и взаимная перезапись concurrent scope edits остаются риском. Нужны отдельное решение о сериализации на существующем durable backend и воспроизводимая concurrency проверка; новый сервис в этой работе не создавался.
2. **Порядок webhook updates:** последовательный delayed-disable guard работает, но параллельные disable(A)/enable(B) между экземплярами не имеют общей CAS. Повторная доставка после store failure улучшена; строгое монотонное применение ID требует backend versioning/serialization. До этого не заявлять надёжность всех конкурентных переходов.
3. **Уведомления:** существующая реализация может сохранить событие, но потерять delete/edit notification при Telegram sendMessage error; alert error по-прежнему не имеет durable outbox. Mock проверяет успешные уведомления. Failure recovery для уведомлений нуждается в отдельном решении; гарантированную доставку обещать нельзя.
4. **Live blockers:** две согласившиеся тестовые учётные записи; хотя бы одна без Premium; login/email/2FA; Ghost View без отметки просмотра у автора; сравнение Stories до/после; message/edit/delete/notification с закрытым Mini App; Android и iPhone.
5. **Backend mapping:** в исходниках `lib/viewer-sync-store.js` по-прежнему обращается к существующему Supabase Function gateway. Это не доказывает отсутствие Neon downstream, но фактический production маршрут до Neon и доступность ключей/архивов в этом запуске не проверены. Не выполнять перенос ради предположения; подтвердить реальную схему до выпуска.
6. Prepare получает до 100 отображаемых owner-visible dialogs (backend проверяет до 500); selected/exclusion режимы ограничены 12 явными чатами, широкие режимы не ограничены 12 чатами. Чаты, отсутствующие в отображаемой странице, можно подключить через сохранённый ручной recovery flow. Полная пагинация picker не реализована.

## Следующий безопасный выпуск и откат

До отдельного сообщения пользователя **«ДЕПЛОЙ»**: не сливать ни PR #178, ни feature PR; не выполнять production deploy, promotion, rollback или env changes.

После устранения блокеров и live QA: проверить актуальные SHA/CI, протестировать точный preview, отдельно согласовать включение production capability. Сам merge пока не включает новую схему: production gate остаётся off без явной настройки. Этот запуск не менял флаг.

Откат после будущего разрешённого выпуска:

1. Отдельно выключить capability после разрешения на env change; сохранить возможность ручного подключения. Не отзывать работающие пользовательские сессии и bot rights массово.
2. Вернуть предыдущий проверенный код/deployment с учётом ошибки в базовом PR #178. Слепой возврат к head #178 вернёт дубликат router и четыре test failure; нужен текущий исправленный hotfix baseline.
3. Не откатывать данные, ключи, архивацию или схемы: миграций нет. Business grants — внешнее состояние Telegram; откат кода их не удаляет. Пользователь может отдельно отозвать доступ через Telegram или мастер, когда он доступен.
4. После отката проверить owner-authorized viewer-sync, Chats, Stories, webhook, сохранённые архивы и ID. Существующий production `6504a387` — известная точка возврата deployment, но не подтверждение работоспособности всех функций.
