# Site statique (fichier HTML unique auto-suffisant : images en base64,
# aucune dependance externe hormis Google Fonts) — sert la landing page
# telle quelle, sans build, sur www.fotallmapro.com.
FROM nginx:1.27-alpine
COPY docs/design/screens/landing_page/code.html /usr/share/nginx/html/index.html
COPY infra/docker/landing-nginx.conf /etc/nginx/conf.d/default.conf
EXPOSE 80
