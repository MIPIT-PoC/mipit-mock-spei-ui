# mipit-mock-spei-ui

> Panel de control del mock SPEI + frontend de simulación. Parte del PoC MiPIT
> ([overview en mipit-docs](https://github.com/MIPIT-PoC/mipit-docs)).

## Propósito

Frontend Next.js 14 dedicado al riel **SPEI (México 🇲🇽)**. Mismo shape que
`mipit-mock-pix-ui` y `mipit-mock-berb-ui` — 3 modos:

1. **Panel admin del mock** SPEI (rate rechazo, latencia, reject/timeout-next, stats).
2. **Simulación local** — `/api/simulate/spei` (atajo demo, NO pipeline ISO).
3. **Simulación internacional** — POST `/payments` al core con JWT (pipeline real).

> ⚠️ El modo **Local** NO pasa por el pipeline ISO 20022 — atajo de demo.
> El flujo real cross-border vive en la pestaña **Internacional**.

## Puerto

| Entorno | URL |
|---|---|
| Docker compose | `http://localhost:3002` |
| Dev local | `npm run dev` → `http://localhost:3002` |
| Container interno | `:3000` (Next.js standalone default) |

## Endpoints que consume

| Endpoint | Quién lo expone | Auth |
|---|---|---|
| `GET/POST /admin/*` | mock-server SPEI (`:9002`) | No |
| `POST /api/simulate/spei` | mock-server SPEI (`:9002`) | No (modo Local) |
| `POST /auth/token`, `POST /payments`, `GET /payments/:id` | core (`:8080`) | Bearer JWT |

## Build args

```yaml
build:
  args:
    NEXT_PUBLIC_API_BASE_URL: http://localhost:8080
    NEXT_PUBLIC_ADAPTER_URL: http://localhost:9002
```

## Stack & desarrollo

Mismo que `mipit-mock-pix-ui` — Next 14, React 18, TS, Tailwind, sonner,
react-hook-form, zod. `npm install && npm run dev` (puerto 3002).

## Validación de CLABE

El form valida CLABE (mod-10 weighted) en el client antes de enviar.
Para defaults válidos:
- `SPEI-012180000118359713` (mod-10 check digit = 3)
- `SPEI-002180012345678906` (mod-10 check digit = 6)

## Cross-ref

- Plan maestro: `mipit-docs/audits/AUDITORIA-4-2026-05-20.md`
- Demo script: `mipit-docs/demo-runbook/defense-script-10min.md`
- Limitaciones: `mipit-docs/LIMITATIONS.md` §14
