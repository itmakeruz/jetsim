# JETSIM

## Tech stack:

- Programming Language: Typescript (5.8.3)
- Framework: NodeJS (22.13.1), NestJS (11.0.7)
- Database: PostgreSQL (16.6)

### Installation

Install necessery tech stack globally

Prisma

```
npm install -g prisma
```

Nestjs

```
npm install -g @nestjs/cli
```

Firstly install pnpm to your system with this [pnpm](https://pnpm.io/installation) link or install via npm:

```bash
npm install -g pnpm
```

Install environment

```bash
pnpm install
```

### Copy `.env.example` to `.env`

```bash
cp .env.example .env
```

### Run the project

```bash
pnpm start
```

## Commands

```bash
# Generate migration
npx prisma migrate deploy

# Build the project
pnpm build

# Run migration
npx prisma generate

# Run seeders
npx prisma db seed

# Run the project
pnpm start

# Run the project in watch mode
pnpm run start:watch
```
