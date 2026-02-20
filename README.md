# AI Trader Backend

## Run locally
1. Install dependencies: `npm install`
2. Set env vars:
   - `DATABASE_URL`
   - `PORT`
   - `ENGINE_MODE` (`paper` or `disabled`)
   - `CONFIDENCE_THRESHOLD`
   - `SYMBOL`
3. Start dev server: `npm run dev`

## DB connection check
- Hit `GET /health` and ensure `db: "connected"`.

## Force trade check
- `POST /api/force-trade` with body:
```json
{
  "symbol": "ETHUSDC",
  "side": "BUY",
  "notionalUsd": 50,
  "tpPct": 0.5,
  "slPct": 0.25
}
```

## TP/SL check
1. Force open a trade with TP/SL.
2. Let the engine tick or call `POST /api/force-trade` and wait for market move.
3. Verify trade closes in `/api/trades` with proper `closeReason` and pnl fields.

## Health route check
- `curl http://localhost:$PORT/health`

## Railway deployment
1. Push repository.
2. Create Railway service from repo.
3. Set env vars in Railway.
4. Railway runs `npm run start` via `railway.json`.
5. Run migrations in Railway once (e.g. `npx prisma migrate deploy`).

## Example Railway env setup
- `DATABASE_URL=postgresql://...neon...`
- `PORT=8787`
- `ENGINE_MODE=paper`
- `CONFIDENCE_THRESHOLD=0.6`
- `SYMBOL=ETHUSDC`
- `CORS_ORIGIN=*`

## Railway troubleshooting (build detection)
- Ensure Railway **Root Directory** is repo root (`/`), not `src/`.
- This repo includes `nixpacks.toml` and `start.sh` as fallbacks so Railpack can still build/start deterministically.
- If Railway still reports only `src/` analyzed, update the service root directory setting and redeploy.


## Prisma note
- Prisma client is generated during install/build (`postinstall` and `build` scripts).
- Ensure `DATABASE_URL` is present so Prisma can target Neon/Postgres correctly.
