# Telegram Digital Market

Отдельный маркетплейс цифровых Telegram-активов.

## Render
Build Command: npm install
Start Command: npm start

## Telegram Login
Для production-входа создайте отдельного бота в @BotFather и зарегистрируйте Allowed URLs/Redirect URI. Telegram Login использует OIDC/PKCE; сервер должен проверять ID token.

## Безопасность
Сайт не должен запрашивать или хранить Telegram OTP, пароль 2FA или готовые пользовательские сессии.
