# Согласованное обновление безопасности JetSim

Релиз подготовлен после 827 успешных тестов и 10 сборок. Эта инструкция не означает, что сервер уже обновлён. Все 11 репозиториев обновляются из main; существующие ветки поддержки сохранены.

## Подготовка

1. Сделать резервные копии четырёх PostgreSQL-баз и файлов QR/вложений. Проверить восстановление на отдельной базе.
2. Node.js 22 LTS. Backend: pnpm 11.10.0, `pnpm install --frozen-lockfile`; интерфейсы: npm 10, `npm ci`. Не смешивать менеджеры и не выполнять audit fix на сервере.
3. Указать CORS_ORIGINS: точный список HTTPS-origin каждого интерфейса. Для центрального API нужны сайт и админка. Для support также origin сайта, если он напрямую обращается к поддержке. Для разработки перечислить localhost-порты отдельно.
4. Проверить отдельные Redis-подключения и префиксы сервисов. При недоступности Redis вход/OTP намеренно не работают. Не открывать Redis наружу. Backend доверяет X-Forwarded-For только loopback-прокси; Nginx должен обращаться через 127.0.0.1/::1. Старый числовой TRUST_PROXY партнёрки больше не используется; внешний балансировщик требует отдельной настройки доверенных адресов.
5. Задать одинаковый MAIL_SERVICE_KEY у вызывающих backend и otp-sender. OTP_SENDER_URL — loopback или HTTPS. Mail service слушает loopback по умолчанию. Не проксировать его публично. MAIL_HOST должен соответствовать сертификату SMTP; проверку сертификата не отключать.
6. Секреты документации задать через окружение; не публиковать документацию с общим паролем.

## Базы и файлы

- Центральный, Global и partner backend: `pnpm exec prisma migrate deploy`, затем `pnpm exec prisma generate`.
- Support API: в существующей базе со старой схемой сначала проверить её соответствие baseline и выполнить `pnpm exec prisma migrate resolve --applied 20261125000000_baseline`, затем migrate deploy/generate. Для новой пустой базы baseline применяется обычным migrate deploy. Не отмечать baseline на пустой или несовместимой базе.
- Назначить первого support SUPER_ADMIN только по проверенному ID через `OPERATOR_ID=<id> node scripts/promote-superadmin.cjs`. Проверить список операторов: прежняя публичная регистрация не означает доверия к существующим аккаунтам.
- Сначала установить запреты старых публичных URL в Nginx, удалить прежние alias на QR/вложения и очистить CDN-кеши. Для остальных публичных uploads включить deploy/public-images-headers.conf внутри существующего location; это запрещает активный контент старых файлов, сохраняя отображение SVG-флагов как изображений.
- Центральный/Global: `node scripts/protect-qr.cjs` переносит старые QR в private/qr. Support: `node scripts/protect-files.cjs` переносит вложения в private/files. Скрипты не перезаписывают различающиеся файлы. При конфликте остановиться и сверить резервную копию.
- Не предоставлять Nginx прямой доступ к private. Защищённые изображения/вложения проходят через API с проверкой владельца/роли.

## Переключение

1. Применить миграции и запреты публичных файлов.
2. В одном окне обслуживания обновить четыре API, otp-sender и шесть интерфейсов. Установить соответствующие deploy/security-headers.conf и security-private.conf после проверки реальных доменов/прокси.
3. Cookie Secure требуют HTTPS. Все старые JWT перестают приниматься: покупатели и сотрудники входят снова. B2B-ключи и callback поставщиков остаются прежними.
4. Проверить вход/refresh/logout в двух вкладках, отдельные сайт/админку, блокировку сотрудника, чужие SIM/QR/вложения, OTP и ограничения, каталог/корзину, тестовую оплату/повтор callback, поддержку и B2B.
5. Покупки и запросы к реальным поставщикам допускаются только отдельным разрешённым контрольным тестом.

## Откат

Не возвращать публичные QR, прямой выпуск eSIM и прежние небезопасные токены. При несовместимости интерфейса временно закрыть соответствующий поток. Миграции добавляют данные сессий/поля операторов, историю заказов и оплат не удаляют. Не откатывать базу поверх новых заказов без отдельной сверки.

## Что ещё требуется на тестовом сервере

SMTP с реальным сертификатом, корректные Origin и прокси-IP, CSP для банковских редиректов/аналитики/Socket.IO, полное переключение всех интерфейсов, старые файловые URL и кеши. Локальная сборка не заменяет эти проверки.

## Команды обновления кода и сборок

Пути ниже соответствуют известным каталогам /var/www; перед выполнением сверьте реальные cwd процессов через `pm2 describe <имя>`. Для otp-sender используйте его настоящий каталог и имя PM2. Сначала выполните подготовку, резервное копирование и проверку настроек выше. Не перезапускайте процессы до готовности всех сборок и Nginx.

Запускать в bash. Этот блок обновляет код и собирает приложения, но не переключает работающие процессы:

```bash
bash
set -euo pipefail

BACKENDS=(
  /var/www/jetsim
  /var/www/jetsim-global/jetsim-global-backend
  /var/www/jetsim-partner-backend
  /var/www/jetsim-support-api
)
FRONTS=(
  /var/www/jetsim-site
  /var/www/jetsim-dashboard-front
  /var/www/jetsim-global/jetsim-global-site
  /var/www/jetsim-global/jetsim-global-dashboard
  /var/www/jetsim-partner-dashboard
  /var/www/jetsim-support-front
)

update_main() {
  local repo="$1"
  git -C "$repo" fetch origin
  if git -C "$repo" show-ref --verify --quiet refs/heads/main; then
    git -C "$repo" switch main
  else
    git -C "$repo" switch --track -c main origin/main
  fi
  git -C "$repo" pull --ff-only origin main
}

for repo in "${BACKENDS[@]}"; do
  update_main "$repo"
  (cd "$repo" && pnpm install --frozen-lockfile && pnpm exec prisma generate && pnpm run build)
done

update_main /var/www/otp-sender
(cd /var/www/otp-sender && pnpm install --frozen-lockfile)

for repo in "${FRONTS[@]}"; do
  update_main "$repo"
  (cd "$repo" && npm ci && npm run build)
done
```

Если git сообщает local changes или divergent history — остановиться, сохранить серверные изменения и разобрать конфликт. Не использовать reset --hard, force push или удаление .env. При Permission denied используйте уже установленный deploy key этого репозитория, например для Global site:

```bash
git -C /var/www/jetsim-global/jetsim-global-site config core.sshCommand \
  'ssh -i /root/.ssh/jetsim-global-site -o IdentitiesOnly=yes'
```

Не копируйте этот ключ в другие репозитории: deploy keys могут быть привязаны к одному репозиторию.

### Окно переключения

После подготовки резервных копий и Nginx, на время миграции файлов остановите выдачу/изменение вложений в обновляемых API. Callback поставщиков во время окна должен получать временный отказ для повторной доставки; не отвечайте фиктивным success при недоступном обработчике. Сайт и админка должны показывать обслуживание до окончания переключения. Ключи B2B и URL callback не менять.

```bash
pm2 stop jetsim-api jetsim-global-api jetsim-partner-api jetsim-support-api

(cd /var/www/jetsim && pnpm exec prisma migrate deploy && pnpm exec prisma generate && node scripts/protect-qr.cjs)
(cd /var/www/jetsim-global/jetsim-global-backend && pnpm exec prisma migrate deploy && pnpm exec prisma generate && node scripts/protect-qr.cjs)
(cd /var/www/jetsim-partner-backend && pnpm exec prisma migrate deploy && pnpm exec prisma generate)
```

Support: если база уже содержит старые таблицы, но не имеет истории Prisma, сначала **сверить схему с baseline**. Только после подтверждения соответствия отметить старый baseline:

```bash
cd /var/www/jetsim-support-api
pnpm exec prisma migrate status
# Только для существующей совместимой базы без применённого baseline:
pnpm exec prisma migrate resolve --applied 20261125000000_baseline
pnpm exec prisma migrate deploy
pnpm exec prisma generate
node scripts/protect-files.cjs
```

Для новой пустой базы migrate resolve не выполнять; сразу migrate deploy. Для уже отмеченного baseline повторять resolve также не нужно. Если возникла ошибка — не продолжать до её устранения.

Первого суперадмина поддержки выбирают по проверенному существующему ID, без массового повышения старых операторов:

```bash
cd /var/www/jetsim-support-api
# Замените 123 на проверенный ID доверенного оператора.
OPERATOR_ID=123 node -r dotenv/config scripts/promote-superadmin.cjs
```

Установите Nginx include внутри соответствующих server/location блоков:

- API JetSim: `/var/www/jetsim/deploy/security-private.conf`.
- API Global: `/var/www/jetsim-global/jetsim-global-backend/deploy/security-private.conf`.
- API поддержки: `/var/www/jetsim-support-api/deploy/security-private.conf`; удалить прежний прямой alias /files и проксировать /chat/files к API с Authorization.
- Каждый frontend: его `deploy/security-headers.conf` в HTTPS server; проверить фактические домены CSP.
- Публичные uploads центрального/Global API: `deploy/public-images-headers.conf` внутри соответствующего location. Директория private не обслуживается Nginx.

Nginx не наследует server-level add_header, если внутри location есть собственные add_header; проверьте итоговые заголовки после include. Сохраните существующие заголовки proxy и Authorization. После настройки:

```bash
nginx -t && systemctl reload nginx

# Если сервис уже зарегистрирован под этим именем:
pm2 restart otp-sender --update-env
# Если его ещё нет, вместо restart:
# cd /var/www/otp-sender
# pm2 start src/server.js --name otp-sender --cwd /var/www/otp-sender

pm2 restart jetsim-api jetsim-global-api jetsim-partner-api jetsim-support-api --update-env
pm2 save
pm2 status
```

Все команды миграций/переноса должны успешно завершиться до restart. Обновление static dist, миграций и API следует выполнять в одном окне; не оставлять новый backend со старыми интерфейсами. Если отдельные фронты развёрнуты через releases/symlink, переключать их только после подготовки backend, а не собирать поверх активного каталога.

### Проверки после переключения

```bash
curl -I https://jetsim.ru
curl -I https://jet-sim.com
curl -I https://admin.jet-sim.com
curl -s -o /dev/null -w '%{http_code}\n' https://api.jetsim.ru/sims/1
curl -s -o /dev/null -w '%{http_code}\n' https://api.jet-sim.com/sims/1
curl -s -o /dev/null -w '%{http_code}\n' https://api.jetsim.ru/uploads/qr/qr_content_1.png
pm2 logs jetsim-api --lines 40 --nostream
pm2 logs jetsim-global-api --lines 40 --nostream
pm2 logs jetsim-support-api --lines 40 --nostream
```

Без токена SIM должны возвращать 401, старый QR — 404. Дополнительно проверить в браузере вход и повторный вход, refresh/logout в двух вкладках, QR владельца, поддержку и загрузки, каталог Global, корзину, B2B. Реальную покупку не выполнять без отдельного решения. При пропавшем OTP проверить Redis, SMTP TLS и MAIL_SERVICE_KEY; не отключать защиту сертификатов или ограничения ради восстановления входа.
