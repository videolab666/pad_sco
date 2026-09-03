# Настройка авторизации игроков (Supabase Auth)

План: `docs/plans/2026-09-02-player-auth-video-cabinet.md`. Провайдеры v1:
**Google OAuth** + **Email Magic Link**. Apple — Phase 2 (нужен Apple
Developer $99/год), Telegram — Phase 2.

## Email Magic Link — уже работает ✅

Провайдер Email включён в проекте по умолчанию (проверено 2026-09-02:
`POST /auth/v1/otp` → 200). Письма шлёт встроенный SMTP Supabase — для
пилота хватает (лимиты: ~4 письма/час на адрес). Для прода настроить
свой SMTP: Dashboard → Authentication → Email Templates → SMTP Settings.

## Google OAuth — ручная настройка (один раз)

1. **Google Cloud Console** → создать проект → «APIs & Services» →
   «OAuth consent screen»: External, название приложения, домен.
2. «Credentials» → «Create Credentials» → «OAuth Client ID» →
   тип **Web application**. Authorized redirect URI:

   ```
   https://<PROJECT_REF>.supabase.co/auth/v1/callback
   ```

   `<PROJECT_REF>` — из URL проекта (см. `NEXT_PUBLIC_SUPABASE_URL`).
3. Полученные **Client ID** и **Client Secret** →
   Supabase Dashboard → Authentication → Providers → Google → Enable.
4. **Authentication → URL Configuration:**
   - Site URL: домен прода (например `https://padel.club`)
   - Redirect URLs: добавить `http://localhost:3000/**` (dev) и
     `https://<домен>/**` (прод)

Без Redirect URLs Google-редирект и magic link будут падать с
`redirect_mismatch` / 403.

## Проверка после настройки

```bash
# magic link (письмо придёт на адрес):
curl -X POST "$NEXT_PUBLIC_SUPABASE_URL/auth/v1/otp" \
  -H "apikey: $NEXT_PUBLIC_SUPABASE_ANON_KEY" -H "Content-Type: application/json" \
  -d '{"email":"you@gmail.com"}'

# Google: открыть /login → «Продолжить с Google» → согласие → возврат на /auth/callback
```

## Куки-сессия

`@supabase/ssr` хранит сессию в cookie `sb-<ref>-auth-token`
(base64 JSON), читается сервером через `lib/auth.ts:getAuthUser()`.
На проде за HTTPS; для PWA «На экран “Домой”» работает как обычная
cookie-сессия браузера.
