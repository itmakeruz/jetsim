# Mobiline and provider balances

## Deployment

1. Back up the database and apply `npx prisma migrate deploy` from the backend directory. Generate Prisma Client (`npx prisma generate`) before building the backend.
2. Configure `MOBILINE_BASE_URI`, `MOBILINE_GROUP_ID`, `MOBILINE_GROUP_KEY`, `SKYBLUE_BASE_URI`, `SKYBLUE_EMAIL`, `SKYBLUE_PASSWORD`, and the existing Redis settings. These credentials are specific to Jetsim; do not copy account secrets from Happytel source files.
3. Deploy backend, then the site and dashboard. Existing installations may leave Mobiline/SkyBlue settings empty until onboarding; do not activate Mobiline tariffs until the account is configured.
4. Create a partner with provider type **Mobiline (3)**. Its database row ID may be any value. Create tariffs with the Mobiline product ID in `sku_id` and a positive `validity_period` in days. Product catalog auto-import and physical USIM are not included.
5. Register **POST https://api.jetsim.ru/order/mobiline/callback** with Mobiline. No customer JWT is needed on this route. The reference implementation provides no callback signature scheme; no invented signature is required.
6. Conduct one approved controlled purchase, confirm the callback, QR and notifications, then check the balance in both interfaces. This local implementation does not register callbacks, change production settings or purchase eSIMs.

## APIs

- `GET /sims/:id/usage`: JWT-authenticated owner; another owner's SIM returns 404.
- `GET /sims/admin/:id/usage`: JWT and ADMIN/SUPER_ADMIN roles.
- Both return `{status: "ok", data: {...}}`, `{status: "not_ready"}`, or `{status: "unsupported"}`. Successful data contains state, traffic in MB, unlimited flag, validity dates, remaining days, daily usage and `checked_at`. Unknown fields are null; unlimited allowance and remaining traffic are null.
- Provider failures return HTTP 502 with a safe message and `last_success` if a previous snapshot exists. Never display an unavailable balance as zero usage.
- `GET /sims/usage` retains the historical raw BC response array. Persisted counters use the common usage service; the compatibility adapter additionally retrieves BC's raw response for old consumers.

## Mobiline lifecycle and operations

One paid SIM produces one activation request. A stable `channel_order_id` and request body are saved before submission. Numeric/string ret zero means accepted. The SIM waits in NOTIFY_COUPON until an ESIM callback supplies cid and qrcode. Issuance completion is separate from the package's actual activation date.

An ambiguous request failure (timeout, transport error, invalid response) stays PENDING. Inspect the order timeline and reconcile with Mobiline using the saved channel_order_id. Do not reset it to CREATED or resubmit automatically: the supplier may already have charged for the eSIM. An accepted response without application_id still waits for its callback and records a warning.

Callbacks return 200 `{success:true}` for processed results and terminal-state repeats; 400 for invalid bodies; 404 for unknown correlation; 422 for incomplete successful eSIM data; and 500 if persistence fails. Duplicate callbacks do not repeat delivery/notifications. Conflicting callbacks after a terminal state are recorded and ignored. Completed eSIM issuance is not rolled back by QR-file, socket or notification failures; QR can be regenerated through the existing admin QR endpoint.

Successful usage snapshots are cached for 60 seconds and persisted in Sims. A cron refreshes completed SIMs every 20 minutes, isolating individual failures. last_usage_quantity remains used traffic in MB for legacy consumers.

SkyBlue sessions live in Jetsim-prefixed Redis keys for 12 hours. Login is serialized, E9998 allows one relogin, E1000 does not rotate the session. Rejected credentials pause login attempts for 10 minutes; portal outages do not. Credentials, cookies and customer details from SkyBlue are not exposed in usage responses or errors. Check account settings when repeated balance checks fail; previous successful data remains visible with its original timestamp.

## Validation

Run `npm test -- --runInBand` and `npm run build` in the backend, and `npm run build` in both frontend projects. Tests cover provider units/timezones, callback races/repeats, ambiguous submissions, authentication/ownership/roles, cache/error snapshots and SkyBlue session recovery. Live provider behavior still requires the controlled purchase described above.
