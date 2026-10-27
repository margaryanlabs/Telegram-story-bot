FROM node:24-alpine
WORKDIR /app
COPY music-bot/server.mjs music-bot/library.mjs ./
ENV NODE_ENV=production PORT=8787 VETOGRAM_MUSIC_STORE_PATH=/data
USER node
EXPOSE 8787
CMD ["node","/app/server.mjs"]
