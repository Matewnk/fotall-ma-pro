# Contexte de build = racine du monorepo (voir docker-compose.prod.yml,
# `context: ../..`), meme raison que apps/api/Dockerfile.
FROM node:22-alpine AS builder

RUN corepack enable
WORKDIR /repo

COPY pnpm-workspace.yaml pnpm-lock.yaml package.json tsconfig.base.json ./
COPY apps/web/package.json apps/web/package.json
COPY packages/shared-types/package.json packages/shared-types/package.json

RUN pnpm install --frozen-lockfile --filter @fotall/web...

COPY apps/web ./apps/web
COPY packages/shared-types ./packages/shared-types

# Vite fige les variables VITE_* dans le bundle statique au moment du
# build, jamais lues au runtime du conteneur — changer VITE_API_URL exige
# donc de reconstruire cette image, pas juste de changer une variable
# d'environnement du conteneur (piege classique, voir tuto de deploiement).
ARG VITE_API_URL
ENV VITE_API_URL=$VITE_API_URL
RUN pnpm --filter @fotall/web run build

FROM nginx:1.27-alpine
COPY --from=builder /repo/apps/web/dist /usr/share/nginx/html
COPY apps/web/nginx.conf /etc/nginx/conf.d/default.conf
EXPOSE 80
