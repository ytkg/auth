# オレオレ認証基盤

Cloudflare Workers + Hono で動く、最小構成の認証 API です。

## 提供 API

1. `POST /login`
- 入力: `{ "username": "...", "password": "..." }`
- 成功: `200` + `{ "token": "...", "accessToken": "...", "refreshToken": "...", "tokenType": "Bearer", "expiresIn": 900 }`
- 失敗: `401` + `{ "error": "Invalid credentials" }`

2. `GET /verify`
- 入力: `Authorization: Bearer <token>`
- 成功: `200` + `{ "payload": ... }`
- 失敗: `401`（JWT 検証エラー）

3. `POST /refresh`
- 入力: `{ "refreshToken": "..." }`
- 成功: `200` + `{ "token": "...", "accessToken": "...", "refreshToken": "...", "tokenType": "Bearer", "expiresIn": 900 }`
- 失敗: `401` + `{ "error": "Invalid refresh token" }`
- 運用: 成功レスポンスの `refreshToken` で必ず上書きしてください（トークン使い回しを避けるため）

アクセストークンの有効期限は発行から 15 分です。リフレッシュトークンは 7 日です。

## セットアップ

```bash
bun install
```

## Secrets 設定

```bash
wrangler secret put USERNAME
wrangler secret put PASSWORD
wrangler secret put JWT_SECRET
wrangler secret put JWT_REFRESH_SECRET
```

## ローカル起動

`package.json` の `dev` は `wrangler dev --remote` です。  
ローカルでも Cloudflare 側を経由して、本番に近い IaaS パスで確認します。

```bash
bun run dev
```

## curl で動作確認

1. ログインしてトークン取得
```bash
curl -i -X POST http://127.0.0.1:8787/login \
  -H 'Content-Type: application/json' \
  -d '{"username":"<USERNAME>","password":"<PASSWORD>"}'
```

2. `/verify` を叩く
```bash
TOKEN='<loginで取得したtoken>'
curl -i http://127.0.0.1:8787/verify \
  -H "Authorization: Bearer $TOKEN"
```

3. `refreshToken` で再発行
```bash
REFRESH_TOKEN='<loginで取得したrefreshToken>'
curl -i -X POST http://127.0.0.1:8787/refresh \
  -H 'Content-Type: application/json' \
  -d "{\"refreshToken\":\"$REFRESH_TOKEN\"}"
```

4. 失敗系（任意）
```bash
curl -i -X POST http://127.0.0.1:8787/login \
  -H 'Content-Type: application/json' \
  -d '{"username":"wrong","password":"wrong"}'
curl -i http://127.0.0.1:8787/verify
curl -i http://127.0.0.1:8787/verify -H 'Authorization: Bearer invalid.token'
curl -i -X POST http://127.0.0.1:8787/refresh \
  -H 'Content-Type: application/json' \
  -d '{"refreshToken":"invalid.token"}'
```

## デプロイ

```bash
bun run deploy
```

## 現状の制約

- ユーザー管理は固定資格情報（`USERNAME` / `PASSWORD`）のみです。
- DB 連携、ロール管理、監査ログは未実装です。
- レート制限やアカウントロックは未実装です。
