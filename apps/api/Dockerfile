# Contexte de build = racine du monorepo (voir docker-compose.prod.yml,
# `context: ../..`) : necessaire pour que pnpm resolve les packages du
# workspace (packages/shared-types, packages/ui-kit) comme le fait
# `pnpm install` en local. Une seule etape : plus simple a diagnostiquer
# qu'un multi-stage pour un premier deploiement, taille d'image non
# critique sur un VPS.
FROM node:22-alpine

RUN corepack enable
# Sans ca, Prisma ne detecte pas la version d'OpenSSL sur Alpine et
# telecharge le mauvais moteur binaire (echoue silencieusement au
# demarrage avec "Could not parse schema engine response").
RUN apk add --no-cache openssl
WORKDIR /repo

# Copie des manifests seuls d'abord (cache Docker : rebuild rapide tant que
# les dependances ne changent pas, meme si le code applicatif change).
COPY pnpm-workspace.yaml pnpm-lock.yaml package.json tsconfig.base.json ./
COPY apps/api/package.json apps/api/package.json
COPY apps/web/package.json apps/web/package.json
COPY apps/mobile/package.json apps/mobile/package.json
COPY packages/shared-types/package.json packages/shared-types/package.json
COPY packages/ui-kit/package.json packages/ui-kit/package.json

# Le schema doit exister AVANT `pnpm install` : le postinstall de
# apps/api (`prisma generate`) echoue sinon ("Could not find Prisma
# Schema").
COPY apps/api/prisma ./apps/api/prisma

# --filter @fotall/api... : installe uniquement @fotall/api et ses
# dependances de workspace (evite d'installer tout Expo/React Native pour
# une image qui n'en a jamais besoin).
RUN pnpm install --frozen-lockfile --filter @fotall/api...

COPY apps/api ./apps/api
COPY packages ./packages

RUN pnpm --filter @fotall/api run build

ENV NODE_ENV=production
WORKDIR /repo/apps/api
EXPOSE 3000

# prisma migrate deploy avant chaque demarrage : idempotent (ne reapplique
# jamais une migration deja jouee), donc sans danger sur un restart normal
# du conteneur — c'est le mecanisme standard Prisma pour la prod (jamais
# `migrate dev`, qui exige un terminal interactif).
CMD ["sh", "-c", "pnpm exec prisma migrate deploy --schema=prisma/schema.prisma && node dist/main.js"]
