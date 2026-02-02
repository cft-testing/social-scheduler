# Social Scheduler

Plataforma de agendamento e publicação de conteúdo para redes sociais.
Permite criar, agendar e publicar posts no Facebook, Instagram e LinkedIn a partir de um único painel.

---

## Índice

1. [Visão Geral](#visão-geral)
2. [Stack Tecnológica](#stack-tecnológica)
3. [Arquitetura do Projeto](#arquitetura-do-projeto)
4. [Estrutura de Ficheiros](#estrutura-de-ficheiros)
5. [Base de Dados (Prisma)](#base-de-dados-prisma)
6. [Autenticação e Autorização](#autenticação-e-autorização)
7. [Funcionalidades](#funcionalidades)
   - [Dashboard](#dashboard)
   - [Compositor de Posts](#compositor-de-posts)
   - [Calendário](#calendário)
   - [Histórico](#histórico)
   - [Canais](#canais)
   - [Definições](#definições)
8. [API REST](#api-rest)
9. [Sistema de Publicação](#sistema-de-publicação)
   - [Fila de Jobs (BullMQ)](#fila-de-jobs-bullmq)
   - [Adaptadores (Meta e LinkedIn)](#adaptadores-meta-e-linkedin)
   - [Modo Dry-Run vs Live](#modo-dry-run-vs-live)
10. [Segurança](#segurança)
11. [Configuração e Instalação](#configuração-e-instalação)
    - [Variáveis de Ambiente](#variáveis-de-ambiente)
    - [Setup Local (Docker)](#setup-local-docker)
    - [Setup Cloud (Supabase + Upstash + Vercel)](#setup-cloud-supabase--upstash--vercel)
12. [Comandos Disponíveis](#comandos-disponíveis)
13. [Fluxo Completo de Uso](#fluxo-completo-de-uso)

---

## Visão Geral

O Social Scheduler é uma aplicação web completa que permite:

- **Criar posts** com texto e imagens
- **Selecionar canais** onde publicar (Facebook Page, Instagram Business, LinkedIn)
- **Agendar publicações** para uma data/hora futura
- **Publicar automaticamente** quando chega a hora agendada
- **Monitorizar o estado** de cada publicação por canal
- **Consultar histórico** e logs de eventos de tudo o que aconteceu
- **Gerir utilizadores** com diferentes níveis de acesso (Admin, Editor, Viewer)

A interface está toda em **português (Portugal)**.

---

## Stack Tecnológica

| Tecnologia | Função |
|---|---|
| **Next.js 15** (App Router) | Framework frontend + backend (React + API routes) |
| **TypeScript** | Tipagem estática em todo o projeto |
| **Tailwind CSS** | Estilos utilitários para a interface |
| **Prisma ORM** | Acesso à base de dados com tipagem automática |
| **PostgreSQL** | Base de dados relacional principal |
| **NextAuth v5** | Autenticação (login, sessões JWT) |
| **BullMQ** | Fila de jobs para publicação agendada |
| **Redis** | Backend da fila BullMQ |
| **Zod** | Validação de dados (formulários, API) |
| **bcryptjs** | Hash de passwords |
| **class-variance-authority** | Variantes de componentes UI (botões, badges) |

---

## Arquitetura do Projeto

```
┌─────────────────────────────────────────────────────┐
│                   BROWSER (Cliente)                  │
│                                                     │
│  Login/Register ─── Dashboard ─── Compositor        │
│  Calendário ─── Histórico ─── Canais ─── Definições │
└──────────────────────┬──────────────────────────────┘
                       │ HTTP
┌──────────────────────▼──────────────────────────────┐
│              NEXT.JS SERVER (App Router)             │
│                                                     │
│  ┌─────────────┐  ┌──────────────┐  ┌────────────┐ │
│  │ API Routes  │  │ Server Comps │  │  NextAuth   │ │
│  │ /api/posts  │  │ Dashboard    │  │  JWT/Sess   │ │
│  │ /api/users  │  │ Settings     │  │  Guards     │ │
│  └──────┬──────┘  └──────┬───────┘  └────────────┘ │
│         │                │                          │
│  ┌──────▼────────────────▼───────┐                  │
│  │         Prisma ORM            │                  │
│  └──────────────┬────────────────┘                  │
└─────────────────┼───────────────────────────────────┘
                  │
     ┌────────────▼────────────┐   ┌──────────────────┐
     │      PostgreSQL         │   │      Redis        │
     │  (dados da aplicação)   │   │  (fila de jobs)   │
     └─────────────────────────┘   └────────┬─────────┘
                                            │
                                   ┌────────▼─────────┐
                                   │   BullMQ Worker   │
                                   │  (processo à parte)│
                                   │                   │
                                   │  Meta Adapter     │
                                   │  LinkedIn Adapter │
                                   └───────────────────┘
```

**Dois processos correm em separado:**
1. **Next.js** — serve a aplicação web e a API
2. **Worker** — processo Node.js que consome jobs da fila Redis e executa as publicações

---

## Estrutura de Ficheiros

```
social-scheduler/
├── prisma/
│   ├── schema.prisma          # Esquema da base de dados (modelos, enums, relações)
│   └── seed.ts                # Script para popular a BD com dados iniciais
│
├── public/
│   └── uploads/               # Pasta onde ficam as imagens uploaded (local)
│
├── src/
│   ├── app/                   # Next.js App Router (páginas e API)
│   │   ├── globals.css        # Estilos globais (Tailwind)
│   │   ├── layout.tsx         # Layout raiz (HTML, metadata)
│   │   ├── page.tsx           # Página inicial (redireciona para /dashboard ou /login)
│   │   │
│   │   ├── (auth)/            # Grupo de rotas de autenticação
│   │   │   ├── layout.tsx     # Layout centrado para login/register
│   │   │   ├── login/page.tsx # Página de login
│   │   │   └── register/page.tsx # Página de registo
│   │   │
│   │   ├── (dashboard)/       # Grupo de rotas protegidas (requer login)
│   │   │   ├── layout.tsx     # Layout com sidebar (verifica autenticação)
│   │   │   ├── dashboard/page.tsx    # Dashboard com estatísticas
│   │   │   ├── composer/page.tsx     # Compositor de posts
│   │   │   ├── calendar/page.tsx     # Calendário de agendamentos
│   │   │   ├── history/page.tsx      # Lista de posts com filtros
│   │   │   ├── history/[id]/page.tsx # Detalhe de um post
│   │   │   ├── history/[id]/cancel-button.tsx # Botão de cancelamento
│   │   │   ├── channels/page.tsx     # Gestão de canais
│   │   │   └── settings/            # Definições
│   │   │       ├── page.tsx          # Info do workspace e conta
│   │   │       └── user-management.tsx # Gestão de utilizadores (admin)
│   │   │
│   │   └── api/               # API REST (Route Handlers)
│   │       ├── auth/
│   │       │   ├── [...nextauth]/route.ts  # NextAuth endpoints
│   │       │   └── register/route.ts       # POST /api/auth/register
│   │       ├── posts/
│   │       │   ├── route.ts                # GET (listar) + POST (criar)
│   │       │   └── [id]/
│   │       │       ├── route.ts            # GET (detalhe) + DELETE (cancelar)
│   │       │       ├── schedule/route.ts   # POST (agendar)
│   │       │       └── media/route.ts      # POST (associar media)
│   │       ├── upload/route.ts             # POST (upload de imagens)
│   │       ├── channels/
│   │       │   ├── route.ts                # GET (listar canais)
│   │       │   └── [id]/route.ts           # DELETE (desconectar)
│   │       ├── events/route.ts             # GET (logs de eventos)
│   │       └── users/
│   │           ├── route.ts                # GET (listar utilizadores)
│   │           └── [id]/
│   │               ├── route.ts            # DELETE (eliminar utilizador)
│   │               └── role/route.ts       # PATCH (alterar função)
│   │
│   ├── components/            # Componentes React reutilizáveis
│   │   ├── sidebar.tsx        # Barra lateral de navegação
│   │   ├── status-badge.tsx   # Badge colorido por estado do post
│   │   └── ui/               # Componentes base (estilo shadcn/ui)
│   │       ├── button.tsx
│   │       ├── input.tsx
│   │       ├── label.tsx
│   │       ├── card.tsx
│   │       ├── badge.tsx
│   │       ├── textarea.tsx
│   │       ├── separator.tsx
│   │       └── select.tsx
│   │
│   ├── jobs/                  # Sistema de fila de publicação
│   │   ├── queue.ts           # Definição da fila BullMQ + funções de enqueue/cancel
│   │   └── worker.ts          # Processo worker que executa os jobs
│   │
│   └── lib/                   # Bibliotecas e utilitários partilhados
│       ├── db.ts              # Instância singleton do Prisma Client
│       ├── auth.ts            # Configuração do NextAuth (provider, callbacks)
│       ├── auth-guard.ts      # Funções de proteção (requireAuth, requireRole)
│       ├── crypto.ts          # Encriptação/desencriptação AES-256-GCM
│       ├── logger.ts          # Sistema de logging para a tabela EventLog
│       ├── validation.ts      # Schemas Zod (login, register, createPost, etc.)
│       ├── storage.ts         # Driver de armazenamento (local ou S3)
│       ├── rate-limit.ts      # Rate limiter em memória
│       ├── utils.ts           # Funções utilitárias (cn, formatDate, labels, etc.)
│       └── adapters/          # Adaptadores de publicação por rede social
│           ├── types.ts       # Interfaces (SocialAdapter, PublishResult)
│           ├── meta-adapter.ts    # Adaptador Meta (Facebook + Instagram)
│           ├── linkedin-adapter.ts # Adaptador LinkedIn
│           └── index.ts       # Factory: getAdapter(provider)
│
├── package.json               # Dependências e scripts
├── tsconfig.json              # Configuração TypeScript
├── next.config.ts             # Configuração Next.js (headers de segurança)
├── tailwind.config.ts         # Configuração Tailwind CSS
├── postcss.config.mjs         # Configuração PostCSS
├── vitest.config.ts           # Configuração de testes
├── docker-compose.yml         # PostgreSQL + Redis em Docker
├── .env.example               # Template das variáveis de ambiente
└── .gitignore                 # Ficheiros ignorados pelo Git
```

---

## Base de Dados (Prisma)

O esquema da base de dados está definido em `prisma/schema.prisma`. Aqui estão os modelos e como se relacionam:

### Modelos

#### Workspace
O contentor principal. Tudo pertence a um workspace.
- Um workspace tem vários **utilizadores**, **canais** e **posts**

#### User
Utilizador da plataforma.
- Tem um **email** único e **password** (hash bcrypt)
- Pertence a um **workspace**
- Tem uma **função** (role): `ADMIN`, `EDITOR` ou `VIEWER`
- Pode ser **autor** de posts e **editor** de posts

#### Channel
Uma conta de rede social conectada.
- Pertence a um **workspace**
- Tem um **provider** (`META` ou `LINKEDIN`) e um **type** (`FB_PAGE`, `IG_BUSINESS`, `LI_ORG`, `LI_PROFILE`)
- Guarda o **token de acesso encriptado** (AES-256-GCM)
- Campos `connected` e `needsReconnect` para gerir o estado da ligação

#### Post
Uma publicação criada pelo utilizador.
- Pertence a um **workspace** e tem um **autor**
- Tem **texto**, **estado global** e **data de agendamento**
- Estados possíveis: `DRAFT` → `SCHEDULED` → `PUBLISHING` → `PUBLISHED` / `FAILED` / `CANCELLED`
- Tem várias **media** (imagens) e vários **postChannels** (um por cada canal onde vai ser publicado)

#### PostMedia
Imagem associada a um post.
- Tem **URL**, **tipo** (IMAGE), **ordem**, **filename**, **mimeType** e **tamanho**
- Eliminado em cascata quando o post é eliminado

#### PostChannel
A relação entre um Post e um Channel — representa "este post vai ser publicado neste canal".
- Tem o seu próprio **estado** (pode estar publicado num canal e falhado noutro)
- Guarda o **ID externo** do post na rede social após publicação
- Guarda o **último erro** em caso de falha
- Combinação `postId + channelId` é única

#### EventLog
Registo de tudo o que acontece na plataforma (audit trail).
- Ligado a **workspace**, opcionalmente a **post** e **channel**
- Tem **nível** (INFO, WARN, ERROR), **ação**, **mensagem** e **detalhes JSON**

### Diagrama de Relações

```
Workspace ─┬── User (1:N)
            ├── Channel (1:N)
            ├── Post (1:N)
            └── EventLog (1:N)

Post ─┬── PostMedia (1:N, cascade delete)
      ├── PostChannel (1:N, cascade delete)
      └── EventLog (1:N)

PostChannel ── Channel (N:1)

User ─┬── Post (autor, 1:N)
      ├── Post (último editor, 1:N)
      └── PostChannel (cancelado por, 1:N)
```

### Enums

| Enum | Valores | Descrição |
|---|---|---|
| `Role` | ADMIN, EDITOR, VIEWER | Função do utilizador |
| `Provider` | META, LINKEDIN | Fornecedor da rede social |
| `ChannelType` | FB_PAGE, IG_BUSINESS, LI_ORG, LI_PROFILE | Tipo específico de canal |
| `PostStatus` | DRAFT, SCHEDULED, PUBLISHING, PUBLISHED, FAILED, CANCELLED | Estado de um post |
| `MediaType` | IMAGE | Tipo de media |
| `LogLevel` | INFO, WARN, ERROR | Nível de log |

---

## Autenticação e Autorização

### Como funciona o login

1. O utilizador submete email + password no formulário `/login`
2. O frontend chama `signIn("credentials", { email, password })`
3. O NextAuth v5 executa a função `authorize()` em `src/lib/auth.ts`:
   - Procura o utilizador na BD pelo email
   - Compara a password com o hash (bcrypt)
   - Se válido, retorna os dados do utilizador
4. O NextAuth gera um **JWT** (JSON Web Token) com `id`, `role` e `workspaceId`
5. O JWT é guardado num **cookie HTTP-only**
6. Em cada pedido seguinte, o NextAuth lê o cookie e disponibiliza a sessão

### Funções (Roles) e Permissões

| Ação | ADMIN | EDITOR | VIEWER |
|---|:---:|:---:|:---:|
| Ver dashboard e histórico | ✅ | ✅ | ✅ |
| Criar e agendar posts | ✅ | ✅ | ❌ |
| Cancelar posts | ✅ | ✅ | ❌ |
| Gerir canais (desconectar) | ✅ | ❌ | ❌ |
| Gerir utilizadores (roles, eliminar) | ✅ | ❌ | ❌ |

### Ficheiros relevantes

- `src/lib/auth.ts` — Configuração do NextAuth (provider credentials, callbacks JWT/session)
- `src/lib/auth-guard.ts` — Funções auxiliares:
  - `requireAuth()` — redireciona para `/login` se não autenticado (server components)
  - `requireRole("ADMIN")` — redireciona para `/dashboard` se permissão insuficiente
  - `requireAuthApi()` — retorna 401 se não autenticado (API routes)
  - `requireRoleApi("ADMIN")` — retorna 403 se permissão insuficiente

### Registo de novos utilizadores

- O primeiro utilizador registado num workspace recebe automaticamente a função **ADMIN**
- Os seguintes recebem **EDITOR** por defeito
- O registo tem rate limiting (máximo 5 tentativas por minuto por IP)

---

## Funcionalidades

### Dashboard

**Ficheiro:** `src/app/(dashboard)/dashboard/page.tsx`
**Tipo:** Server Component (carrega dados no servidor)

Mostra um resumo da plataforma:
- **4 cartões de estatísticas**: total de posts, agendados, publicados, falhados
- **Próximas publicações**: posts agendados ordenados por data (mais próximo primeiro)
- **Atividade recente**: últimos 5 posts atualizados, com autor e estado

### Compositor de Posts

**Ficheiro:** `src/app/(dashboard)/composer/page.tsx`
**Tipo:** Client Component (interativo)

Permite criar uma nova publicação:
1. **Área de texto** — escrever o conteúdo do post (mostra contagem de caracteres)
2. **Seleção de canais** — botões toggle para escolher onde publicar
3. **Upload de imagens** — selecionar ficheiros de imagem (JPEG, PNG, GIF, WebP, máx. 10MB cada)
4. **Agendamento** — escolher data/hora para publicar no futuro
5. **Dois botões de ação**:
   - "Guardar Rascunho" — guarda como DRAFT sem agendar
   - "Agendar Publicação" / "Publicar Agora" — agenda ou publica imediatamente
6. **Pré-visualização** — mostra como ficará o texto

**Fluxo técnico ao criar:**
```
[Compositor] → POST /api/posts (cria post + postChannels)
            → POST /api/posts/:id/schedule (agenda na fila BullMQ)
            → Redireciona para /history
```

### Calendário

**Ficheiro:** `src/app/(dashboard)/calendar/page.tsx`
**Tipo:** Client Component

Mostra os posts agendados numa vista de calendário:
- **Vista Mês** — grelha 7×5 com dias, posts aparecem como etiquetas clicáveis
- **Vista Semana** — 7 colunas com mais detalhe
- **Navegação** — setas para avançar/recuar meses
- O dia atual é destacado a azul
- Clicar num post leva ao detalhe

### Histórico

**Ficheiro:** `src/app/(dashboard)/history/page.tsx` (lista) e `history/[id]/page.tsx` (detalhe)

**Lista:**
- Mostra todos os posts com **filtro por estado** (dropdown)
- **Paginação** (20 por página)
- Cada item mostra texto, autor, data e estado (badge colorido)
- Clicar leva ao detalhe

**Detalhe de um post:**
- Texto completo e metadata (autor, data, agendamento)
- **Estado por canal** — mostra o estado individual em cada rede social
  - Se falhou, mostra a mensagem de erro
  - Se publicado, mostra a data de publicação
  - Botão "Cancelar" para posts ainda agendados
- **Registo de eventos** — timeline de tudo o que aconteceu (início, sucesso, falha)
  - Indicador colorido: verde (INFO), amarelo (WARN), vermelho (ERROR)

### Canais

**Ficheiro:** `src/app/(dashboard)/channels/page.tsx`
**Tipo:** Client Component

Mostra:
- **Canais conectados** — lista com nome, tipo, provider, estado
  - Badge "Conectado" ou "Desconectado"
  - Badge "Necessita reconexão" se o token expirou
  - Botão "Desconectar" (só admin)
- **Ligar novos canais** — informação sobre como configurar OAuth para Meta e LinkedIn
  - Botões desativados com instruções para configurar as variáveis de ambiente

### Definições

**Ficheiro:** `src/app/(dashboard)/settings/page.tsx` + `user-management.tsx`

- **Workspace** — nome e ID do workspace
- **A Minha Conta** — nome, email e função do utilizador atual
- **Gestão de Utilizadores** (só visível para ADMIN):
  - Lista todos os utilizadores do workspace
  - Dropdown para alterar a função (Admin/Editor/Viewer)
  - Botão para eliminar utilizadores
  - Não é possível alterar/eliminar a própria conta

---

## API REST

Todos os endpoints estão em `src/app/api/`. Requerem autenticação (cookie JWT) exceto o registo.

### Autenticação

| Método | Endpoint | Descrição |
|---|---|---|
| POST | `/api/auth/register` | Criar nova conta (rate limited: 5/min) |
| POST | `/api/auth/signin` | Login (gerido pelo NextAuth) |
| POST | `/api/auth/signout` | Logout (gerido pelo NextAuth) |
| GET | `/api/auth/session` | Obter sessão atual (gerido pelo NextAuth) |

### Posts

| Método | Endpoint | Descrição | Permissão |
|---|---|---|---|
| GET | `/api/posts` | Listar posts (filtros: status, from, to, page, pageSize) | Autenticado |
| POST | `/api/posts` | Criar post (text, channelIds, scheduledAtUtc?, mediaIds?) | Editor+ |
| GET | `/api/posts/:id` | Obter detalhe de um post | Autenticado |
| DELETE | `/api/posts/:id` | Cancelar post (body: {postChannelId?}) | Editor+ |
| POST | `/api/posts/:id/schedule` | Agendar um rascunho (body: {scheduledAtUtc}) | Editor+ |
| POST | `/api/posts/:id/media` | Associar media a um post | Editor+ |

### Upload

| Método | Endpoint | Descrição |
|---|---|---|
| POST | `/api/upload` | Upload de imagem (multipart form, máx. 10MB, JPEG/PNG/GIF/WebP) |

### Canais

| Método | Endpoint | Descrição | Permissão |
|---|---|---|---|
| GET | `/api/channels` | Listar canais do workspace (tokens não incluídos) | Autenticado |
| DELETE | `/api/channels/:id` | Desconectar um canal | Admin |

### Utilizadores

| Método | Endpoint | Descrição | Permissão |
|---|---|---|---|
| GET | `/api/users` | Listar utilizadores do workspace | Admin |
| DELETE | `/api/users/:id` | Eliminar utilizador | Admin |
| PATCH | `/api/users/:id/role` | Alterar função (body: {role}) | Admin |

### Eventos

| Método | Endpoint | Descrição |
|---|---|---|
| GET | `/api/events` | Listar logs (filtros: postId, channelId, level, page, pageSize) |

---

## Sistema de Publicação

### Fila de Jobs (BullMQ)

**Ficheiros:** `src/jobs/queue.ts` (fila) e `src/jobs/worker.ts` (worker)

O BullMQ é uma biblioteca de filas baseada em Redis. Funciona assim:

1. **Quando um post é agendado**, a API cria um job para cada `PostChannel` na fila "publish"
2. Cada job tem um **delay** calculado: `scheduledAtUtc - agora` (em milissegundos)
3. O job fica em espera no Redis até chegar a hora
4. O **worker** (processo separado) consome o job e executa a publicação

**Configuração da fila:**
- **3 tentativas** por job em caso de falha
- **Backoff exponencial** — espera 5s, depois 10s, depois 20s entre tentativas
- Jobs completos são mantidos (últimos 1000)
- Jobs falhados são mantidos (últimos 5000)
- Cada job tem um **ID determinístico** (`publish-{postChannelId}`) para evitar duplicados

**Funções disponíveis:**
- `enqueuePublishJob(postChannelId, delayMs)` — adiciona job à fila
- `cancelPublishJob(postChannelId)` — remove job da fila (se ainda não começou)

### Adaptadores (Meta e LinkedIn)

**Ficheiros:** `src/lib/adapters/`

Os adaptadores seguem uma interface comum (`SocialAdapter`):

```typescript
interface SocialAdapter {
  validate(post): Promise<{ valid: boolean; errors: string[] }>
  publish(post, accessToken): Promise<PublishResult>
}
```

**MetaAdapter** (`meta-adapter.ts`):
- Valida limites de caracteres e imagens por tipo de canal
  - Facebook Page: 63.206 caracteres, 10 imagens
  - Instagram Business: 2.200 caracteres, 10 imagens
- Em modo live: usa a Graph API do Facebook (esqueleto preparado, não implementado)

**LinkedInAdapter** (`linkedin-adapter.ts`):
- Valida limites: 3.000 caracteres, 9 imagens (org e perfil)
- Em modo live: usa a UGC Post API do LinkedIn (esqueleto preparado, não implementado)

### Modo Dry-Run vs Live

Controlado pela variável `PUBLISH_MODE` no `.env`:

**Dry-Run (`PUBLISH_MODE=dryrun`)** — modo por defeito:
- Simula o processo de publicação sem contactar as APIs reais
- Adiciona um delay aleatório (600ms-2000ms) para simular latência de rede
- **10% de taxa de falha simulada** para testar o tratamento de erros
- Gera IDs externos falsos (ex: `dryrun_meta_1706789...`)
- Ideal para desenvolvimento e testes

**Live (`PUBLISH_MODE=live`)**:
- Contacta as APIs reais das redes sociais
- Requer tokens de acesso válidos nos canais
- Os esqueletos das chamadas API estão preparados mas comentados
- Necessita implementação completa antes de usar em produção

### Fluxo do Worker

Quando um job é processado, o worker faz o seguinte:

```
1. Buscar o PostChannel na BD (com Post, Media e Channel)
2. Verificar idempotência (já publicado ou cancelado? → skip)
3. Marcar PostChannel como PUBLISHING
4. Registar evento "publish.start" no log
5. Validar o post (limites de caracteres, imagens)
   → Se inválido: marcar como FAILED, registar erro
6. Desencriptar o token de acesso do canal
7. Chamar adapter.publish()
   → Se sucesso: marcar como PUBLISHED, guardar externalPostId
   → Se falha auth: marcar canal como needsReconnect
   → Se falha de rede/rate limit: throw error (BullMQ vai retry)
   → Se falha permanente: marcar como FAILED
8. Recalcular estado global do Post:
   - Todos PUBLISHED → PUBLISHED
   - Todos CANCELLED → CANCELLED
   - Algum PUBLISHING → PUBLISHING
   - Algum FAILED → FAILED
   - Algum SCHEDULED → SCHEDULED
   - Caso contrário → DRAFT
```

### Categorização de Erros

Os adaptadores categorizam os erros para decidir o que fazer:

| Categoria | Exemplos | Ação |
|---|---|---|
| `auth` | Token expirado, OAuth inválido | Marca canal como `needsReconnect`, não faz retry |
| `rate_limit` | Limite de API excedido | Faz retry (backoff exponencial) |
| `validation` | Texto demasiado longo | Não faz retry (erro permanente) |
| `network` | Timeout, conexão recusada | Faz retry (backoff exponencial) |
| `unknown` | Qualquer outro erro | Não faz retry |

---

## Segurança

### Encriptação de Tokens

**Ficheiro:** `src/lib/crypto.ts`

Os tokens de acesso das redes sociais são encriptados em repouso na base de dados:
- **Algoritmo:** AES-256-GCM (encriptação autenticada)
- **Chave:** 32 bytes, derivada da variável `ENCRYPTION_KEY` (base64)
- **Formato:** `IV (12 bytes) + Auth Tag (16 bytes) + Ciphertext` → base64
- Cada encriptação usa um **IV aleatório** diferente

### Headers de Segurança

**Ficheiro:** `next.config.ts`

A aplicação adiciona os seguintes headers HTTP:
- `X-Frame-Options: DENY` — previne embedding em iframes (clickjacking)
- `X-Content-Type-Options: nosniff` — previne MIME sniffing
- `Referrer-Policy: origin-when-cross-origin` — limita informação do referrer

### Rate Limiting

**Ficheiro:** `src/lib/rate-limit.ts`

Rate limiter em memória para proteger endpoints sensíveis:
- Registo: máximo **5 pedidos por minuto** por IP
- Implementação com `Map` + limpeza automática a cada 5 minutos
- Retorna `429 Too Many Requests` quando excedido

### Passwords

- Hash com **bcrypt** (12 rounds)
- Nunca armazenadas em texto limpo
- Validação mínima de 6 caracteres

### Validação de Input

**Ficheiro:** `src/lib/validation.ts`

Toda a entrada de dados é validada com **Zod**:
- `loginSchema` — email válido + password mín. 6 chars
- `registerSchema` — email + password + nome obrigatório
- `createPostSchema` — texto obrigatório + pelo menos 1 canal
- `schedulePostSchema` — data ISO 8601 válida

### Upload de Ficheiros

- Tipos permitidos: JPEG, PNG, GIF, WebP
- Tamanho máximo: 10MB por ficheiro
- Ficheiros renomeados com UUID para evitar colisões

---

## Configuração e Instalação

### Variáveis de Ambiente

Copiar `.env.example` para `.env` e preencher:

```bash
# Base de dados PostgreSQL
DATABASE_URL="postgresql://user:pass@host:5432/social_scheduler?schema=public"

# Redis (para BullMQ)
REDIS_URL="redis://localhost:6379"

# Chave secreta para NextAuth (gerar string aleatória de 32+ chars)
AUTH_SECRET="uma-string-secreta-aleatoria-muito-longa"
AUTH_URL="http://localhost:3000"
NEXTAUTH_URL="http://localhost:3000"

# Chave de encriptação para tokens sociais (32 bytes em base64)
# Gerar com: node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"
ENCRYPTION_KEY="dGhpcyBpcyBhIDMyIGJ5dGUga2V5ISEhISEhISEhIQ=="

# URL da aplicação
APP_URL="http://localhost:3000"

# Armazenamento de ficheiros: "local" ou "s3"
STORAGE_DRIVER="local"

# Modo de publicação: "dryrun" (simulado) ou "live" (real)
PUBLISH_MODE="dryrun"

# Meta (Facebook/Instagram) — opcional, só para OAuth live
# META_APP_ID=""
# META_APP_SECRET=""
# META_REDIRECT_URI="http://localhost:3000/api/channels/meta/callback"

# LinkedIn — opcional, só para OAuth live
# LINKEDIN_CLIENT_ID=""
# LINKEDIN_CLIENT_SECRET=""
# LINKEDIN_REDIRECT_URI="http://localhost:3000/api/channels/linkedin/callback"
```

### Setup Local (Docker)

Requer **Docker** e **Docker Compose** instalados.

```bash
# 1. Clonar o repositório
git clone https://github.com/cft-testing/social-scheduler.git
cd social-scheduler

# 2. Copiar variáveis de ambiente
cp .env.example .env

# 3. Iniciar PostgreSQL e Redis
docker-compose up -d

# 4. Instalar dependências
npm install

# 5. Correr migrações e gerar Prisma Client
npx prisma migrate dev --name init

# 6. Popular a base de dados com dados iniciais
npx prisma db seed

# 7. Iniciar a aplicação (terminal 1)
npm run dev

# 8. Iniciar o worker de publicação (terminal 2)
npm run worker
```

Abrir http://localhost:3000 no browser.
Login: `admin@example.com` / `admin123`

### Setup Cloud (Supabase + Upstash + Vercel)

Para correr sem instalar nada localmente:

**1. Supabase (PostgreSQL gratuito)**
- Criar conta em https://supabase.com (login com GitHub)
- Criar novo projeto
- Ir a Project Settings → Database → Connection string → URI
- Copiar a connection string para `DATABASE_URL` no `.env`

**2. Upstash (Redis gratuito)**
- Criar conta em https://upstash.com (login com GitHub)
- Criar nova Redis database
- Copiar o `UPSTASH_REDIS_URL` para `REDIS_URL` no `.env`

**3. Vercel (Deploy da app)**
- Criar conta em https://vercel.com (login com GitHub)
- Import do repositório `social-scheduler`
- Adicionar as variáveis de ambiente no dashboard da Vercel
- A Vercel faz deploy automático a cada push

**4. Migrações**
```bash
# Localmente, com a DATABASE_URL do Supabase no .env:
npx prisma migrate deploy
npx prisma db seed
```

**Nota sobre o Worker:**
O worker BullMQ precisa de correr como processo separado. Na Vercel (serverless) não é possível correr processos persistentes. Alternativas:
- Correr o worker num serviço como **Railway**, **Render** ou **Fly.io** (planos gratuitos disponíveis)
- Adaptar para usar **Vercel Cron Jobs** + API routes (para volumes baixos)

---

## Comandos Disponíveis

| Comando | Descrição |
|---|---|
| `npm run dev` | Inicia o servidor Next.js em modo desenvolvimento (http://localhost:3000) |
| `npm run build` | Compila a aplicação para produção |
| `npm start` | Inicia o servidor em modo produção (requer build primeiro) |
| `npm run worker` | Inicia o worker BullMQ de publicação |
| `npm run prisma:migrate` | Corre migrações pendentes da base de dados |
| `npm run prisma:seed` | Popula a BD com dados iniciais (workspace, admin, canais demo) |
| `npm test` | Corre os testes com Vitest |
| `npx prisma studio` | Abre interface visual para explorar a base de dados |
| `npx prisma generate` | Regenera o Prisma Client após alterações ao schema |

---

## Fluxo Completo de Uso

Aqui está o percurso típico de um utilizador desde o registo até à publicação:

```
1. REGISTO
   Utilizador → /register → preenche nome, email, password
   → POST /api/auth/register → cria User na BD
   → Primeiro utilizador = ADMIN, seguintes = EDITOR

2. LOGIN
   Utilizador → /login → email + password
   → NextAuth verifica credenciais → gera JWT → cookie

3. DASHBOARD
   → Vê estatísticas: posts totais, agendados, publicados, falhados
   → Vê próximas publicações e atividade recente

4. CRIAR POST
   Utilizador → /composer
   → Escreve texto
   → Seleciona canais (Facebook, Instagram, LinkedIn)
   → Opcionalmente faz upload de imagens
   → Opcionalmente define data/hora de agendamento
   → Clica "Agendar Publicação"

5. POST CRIADO
   → POST /api/posts cria Post + PostChannel por cada canal selecionado
   → POST /api/posts/:id/schedule agenda na fila BullMQ
   → Status: SCHEDULED
   → Jobs criados no Redis com delay até a hora agendada

6. PUBLICAÇÃO AUTOMÁTICA
   (quando chega a hora agendada)
   → Worker consome o job da fila Redis
   → Valida o post (limites de caracteres, imagens)
   → Chama o adaptador da rede social (dry-run ou live)
   → Atualiza status: PUBLISHED ou FAILED
   → Regista evento no log

7. MONITORIZAÇÃO
   Utilizador → /history → vê lista de posts
   → Clica num post → vê estado por canal
   → Vê logs de eventos (timeline do que aconteceu)
   → Pode cancelar posts que ainda estão agendados

8. GESTÃO (Admin)
   → /channels → ver/desconectar canais
   → /settings → gerir utilizadores (alterar roles, eliminar)
```
