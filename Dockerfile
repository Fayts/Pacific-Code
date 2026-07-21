# syntax=docker/dockerfile:1
# Image de production Pacific Code (Next.js standalone, ~150 Mo).

FROM node:22-alpine AS deps
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci

FROM node:22-alpine AS build
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
# Les variables NEXT_PUBLIC_* sont figées dans le bundle au moment du build.
# (URL et clé « publishable » Supabase sont publiques par conception : la
# sécurité repose sur la RLS, pas sur le secret de ces valeurs.)
ARG NEXT_PUBLIC_DATA_MODE=mock
ARG NEXT_PUBLIC_SITE_URL
ARG NEXT_PUBLIC_SUPABASE_URL
ARG NEXT_PUBLIC_SUPABASE_ANON_KEY
ENV NEXT_PUBLIC_DATA_MODE=$NEXT_PUBLIC_DATA_MODE \
    NEXT_PUBLIC_SITE_URL=$NEXT_PUBLIC_SITE_URL \
    NEXT_PUBLIC_SUPABASE_URL=$NEXT_PUBLIC_SUPABASE_URL \
    NEXT_PUBLIC_SUPABASE_ANON_KEY=$NEXT_PUBLIC_SUPABASE_ANON_KEY \
    NEXT_TELEMETRY_DISABLED=1
RUN npm run build

FROM node:22-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production \
    PORT=3000 \
    HOSTNAME=0.0.0.0 \
    NEXT_TELEMETRY_DISABLED=1
COPY --from=build /app/.next/standalone ./
COPY --from=build /app/public ./public
COPY --from=build /app/.next/static ./.next/static
# Le cache d'optimisation d'images doit être inscriptible par l'utilisateur
# node (sinon EACCES sur mkdir /app/.next/cache à chaque image servie).
RUN mkdir -p /app/.next/cache && chown -R node:node /app/.next/cache
EXPOSE 3000
USER node
CMD ["node", "server.js"]
