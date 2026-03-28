FROM ghcr.io/puppeteer/puppeteer:24.4.0

# Define diretório de trabalho usando o usuário "pptruser" que já vem na imagem
WORKDIR /home/pptruser/app

# Copia os arquivos de dependência
COPY --chown=pptruser:pptruser package*.json ./

# Instala dependências e garante o puppeteer localmente
RUN npm ci

# Copia o resto dos arquivos do projeto
COPY --chown=pptruser:pptruser . .

# Comando padrão para rodar o bot
CMD ["npm", "start"]
