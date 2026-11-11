# Arquitetura de Referência - Frontend Next.js (blueprint portável)

Este documento descreve **o padrão arquitetural**, não um projeto específico. Foi desenhado para o
`financeia-frontend` (hoje um projeto Next.js recém-criado, praticamente vazio) espelhando as
mesmas convenções e o mesmo nível de rigor do
[backend](../../../financeia-backend/.claude/code-architetura/arquitetura-referencia.md), adaptadas
para o mundo de componentes, rotas e estado de UI.

> Se você é um agente lendo isto para iniciar/expandir o frontend: siga as regras da seção
> "Regras invioláveis", use os templates da seção "Templates copiáveis" e valide com o
> "Checklist de nova feature". Nada aqui depende do domínio de negócio (orçamento, transação etc.)
> - isso entra como conteúdo dentro de cada `features/<feature>/`.

## 1. Stack de referência

| Camada | Escolha |
|---|---|
| Runtime | Node.js 22.x |
| Framework | Next.js 16.x (App Router) |
| Linguagem | TypeScript 5.x (strict, sem `any` gratuito) |
| UI | React 19.x |
| Estilo | Tailwind CSS v4 (utilitário, sem CSS-in-JS) |
| Estado de servidor (dados remotos) | TanStack Query (`@tanstack/react-query`) |
| Estado de cliente (UI local/global) | `useState`/`useReducer` local; Zustand só quando o estado é
  realmente global e client-only (ex.: sidebar aberta, tema) |
| Formulários | `react-hook-form` + `zod` (`@hookform/resolvers/zod`) |
| Validação/schemas | `zod` - mesmo schema valida formulário e tipa a resposta da API |
| HTTP para o backend | `fetch` nativo atrás de um client HTTP único (`shared/lib/api-client.ts`) |
| Auth | Sessão do IdP (mesmo emissor do backend); token guardado em cookie `httpOnly` via
  Route Handler de login; validado no `middleware.ts` |
| Ícones | `lucide-react` |
| Lint/format | ESLint (`eslint-config-next`) + Prettier |
| Testes | Vitest + Testing Library (componente/hook), Playwright (E2E, quando existir) |

O projeto ainda não tem essas libs instaladas além de `next`/`react`/`tailwindcss` - a tabela é a
escolha de referência para quando cada necessidade aparecer, não uma lista do que já existe em
`package.json`. Instale sob demanda, não tudo de uma vez.

## 2. Mapa de diretórios

```
src/
├── app/                        # ROTEAMENTO (App Router). Fino: layout, page, loading, error.
│   ├── (public)/                # route group: rotas sem sessão (login, landing)
│   │   └── login/page.tsx
│   ├── (app)/                   # route group: rotas autenticadas
│   │   ├── layout.tsx           # shell autenticado (sidebar, header) - Server Component
│   │   └── budgets/
│   │       ├── page.tsx         # busca dados (Server Component) + monta a página
│   │       ├── loading.tsx
│   │       └── error.tsx
│   ├── api/                     # Route Handlers - só para BFF real (webhook, upload assinado,
│   │                             # troca de cookie de sessão). Não é onde a UI busca dado de negócio.
│   ├── layout.tsx                # root layout: fontes, providers globais, <html>/<body>
│   └── globals.css
│
├── features/                    # NEGÓCIO. 1 pasta por bounded context (espelha modules/ do backend)
│   └── <feature>/
│       ├── components/          # apresentação específica da feature (Server ou Client Component)
│       │   └── index.ts
│       ├── hooks/                # orquestra: chama services, liga TanStack Query/estado local
│       │   └── index.ts
│       ├── services/             # ÚNICO lugar que fala com o backend para essa feature
│       │   └── index.ts
│       ├── schemas/              # zod schemas: validação de formulário + shape de resposta da API
│       │   └── index.ts
│       ├── types/                 # tipos que não vêm de schema (ex.: view models)
│       └── index.ts               # barrel: exporta só a API pública da feature
│
├── shared/                      # TRANSVERSAL. Pode ser usado por qualquer feature ou rota.
│   ├── ui/                      # design system "burro": Button, Input, Modal, Card... sem fetch,
│   │                             # sem regra de negócio, só recebe props e emite eventos
│   ├── hooks/                    # hooks genéricos sem negócio: useDebounce, useMediaQuery
│   ├── lib/
│   │   ├── api-client.ts         # fetch wrapper único: baseURL, headers, parse de erro
│   │   ├── query-client.ts       # instância do QueryClient + <Providers>
│   │   └── auth/                 # leitura de sessão (cookie), helpers de redirect
│   ├── config/                   # único lugar que lê process.env / import.meta.env
│   ├── utils/                    # funções puras (formatação de moeda, data, etc.)
│   └── types/                     # tipos globais: ApiError, Paginated<T>, etc.
│
└── middleware.ts                  # auth em nível de edge: redireciona rota autenticada sem sessão
```

## 3. O que cada camada significa

### `app/` - roteamento, não negócio
É o equivalente aos `controllers/` do backend: fino, sem lógica. Cada `page.tsx`:
- se for **Server Component** (padrão), chama uma função de `features/<feature>/services/` (ou um
  hook de leitura que embrulha isso) para buscar o dado e passa como prop para os componentes de
  `features/<feature>/components/`;
- se precisar de interatividade (formulário, filtro, modal), delega para um **Client Component**
  dentro de `features/<feature>/components/`, que aí sim usa hooks de `features/<feature>/hooks/`.

`layout.tsx` monta casca (nav, providers), nunca busca dado específico de uma feature filha.
Route Handlers em `app/api/` só existem para o que **precisa** rodar no servidor da própria
aplicação (assinar upload, processar webhook, setar cookie `httpOnly` no login) - não é atalho
para "não criar service".

### `features/` - o negócio
Cada pasta é um bounded context, mesmo recorte usado no backend (`budgets`, `transactions`,
`auth`...). Fluxo padrão de uma tela:

```
page.tsx (rota) → hook (orquestra) → service (I/O) → api-client → backend
                       ↓
                  component (apresentação, recebe dado já pronto via props)
```

| Camada | Responsabilidade | Pode conhecer | NÃO pode |
|---|---|---|---|
| `components/` | renderizar UI, capturar evento do usuário | hooks da própria feature, `shared/ui` | `fetch`, `api-client` direto, regra de negócio complexa |
| `hooks/` | orquestrar: chamar `services`, gerenciar `useQuery`/`useMutation`, derivar estado de UI | `services`, `schemas`, outros hooks | JSX, `fetch` direto |
| `services/` | única camada que fala HTTP com o backend para a feature | `shared/lib/api-client`, `schemas` (pra validar resposta) | JSX, hooks do React |
| `schemas/` | forma e validação do dado (zod) - mesma fonte tipa formulário e resposta de API | `zod` | lógica de fetch |
| `types/` | view models e tipos derivados que não vêm de schema | nada | implementação |

Casos que fogem do padrão - e são legítimos:
- feature **só de leitura** (uma listagem simples): pode não ter `hooks/` separado, o
  `useQuery` fica direto no componente - mas só se for realmente trivial (uma chamada, sem
  derivação de estado);
- feature **sem tela própria** (usada só como dado auxiliar de outra, ex.: categorias num
  select): pode não ter `components/`.

### `shared/` - transversal
Mesmo teste do backend: "se eu apagar a feature X, isso ainda faz sentido?". Se não, não é shared.

- `ui/` → componente de apresentação **sem** fetch e **sem** import de `features/*`. Se um
  componente de `shared/ui` precisa saber de "orçamento", ele pertence a uma feature, não aqui.
- `lib/api-client.ts` → o único lugar que monta a `baseURL`, injeta o header `Authorization`,
  padroniza erro de rede/HTTP num formato único (`ApiError`). Nenhum `service` de feature usa
  `fetch` cru - todos passam pelo client.
- `lib/query-client.ts` → uma instância de `QueryClient`, exportada e usada no provider do
  `app/layout.tsx`. Não criar `QueryClient` novo em outro lugar.
- `config/` → único lugar que lê `process.env`. Client-side só pode ler variável com prefixo
  `NEXT_PUBLIC_`; qualquer segredo fica só em Server Component/Route Handler, nunca exposto ao
  bundle do cliente.
- `hooks/` → hook genérico, sem `@tanstack/react-query`, sem chamada de API, sem saber o que é
  "orçamento".

## 4. Regras invioláveis

1. **Direção da dependência**: `app → features → shared`. `shared/` nunca importa de `features/`;
   uma feature nunca importa arquivo interno de outra feature - se precisa reusar algo, ou o dado
   sobe pra `app/` (composição na página) ou o utilitário desce pra `shared/`.
2. **`fetch` só em `shared/lib/api-client.ts`.** Nenhum componente ou hook chama `fetch` direto;
   todo `service` de feature usa o client compartilhado.
3. **Toda chamada ao backend passa por `features/<feature>/services/`.** Componente não conhece a
   URL do endpoint; ele chama um hook, que chama um service.
4. **Server Component é o padrão.** `'use client'` só entra quando há de fato necessidade:
   `useState`/`useEffect`, evento de interação, hook de terceiro que exige client
   (`useQuery`, `react-hook-form`). Não marque uma árvore inteira como client por comodidade -
   componente de apresentação puro fica Server Component.
5. **`process.env` só em `shared/config/`, `middleware.ts` e arquivos de setup do framework.**
   Nada de `process.env.X` espalhado em componente ou hook.
6. **Um hook de feature = uma responsabilidade.** `useBudgets()` lista, `useCreateBudget()` cria -
   não um hook gigante fazendo tudo. Cada `useQuery`/`useMutation` tem sua `queryKey` centralizada
   num array exportado do próprio hook ou de `features/<feature>/services/query-keys.ts`.
7. **Validação com zod em toda fronteira de entrada de dado do usuário** (formulário) e,
   idealmente, na resposta de API que alimenta a UI. `schema.parse`/`safeParse` - nunca confiar
   cegamente no shape que a API devolve numa tela crítica.
8. **`shared/ui/` não importa nada de `features/`.** Um componente de design system que precisa de
   dado de negócio não é design system - mova pra dentro da feature.
9. **Nomes de arquivo em kebab-case com sufixo de papel quando ajuda a identificar**:
   `*.service.ts`, `*.schema.ts`, `use-*.ts` (hooks), componente em PascalCase dentro de arquivo
   kebab-case (`budget-card.tsx` exporta `BudgetCard`).
10. **Barrel `index.ts` por pasta** (`components/`, `hooks/`, `services/`, `schemas/`) e um
    `index.ts` na raiz da feature que reexporta só o que é usado fora dela. Import entre
    `app/` e `features/` sempre passa pelo barrel da feature.
11. **Erro de UI tem página própria por segmento de rota**: `error.tsx` (client, `'use client'`) e
    `not-found.tsx` quando aplicável. Não deixar erro de fetch estourar sem boundary.
12. **Auth**: nenhuma página autenticada confia só em checagem client-side. `middleware.ts` barra
    rota protegida sem sessão antes de renderizar; o componente ainda pode checar sessão para UX,
    mas a garantia de segurança é o middleware + validação do token no backend.
13. **Toda `features/<feature>/hooks/*.ts` com lógica não trivial (derivação de estado, mutação
    com efeito colateral) tem teste correspondente** (`*.test.ts(x)`, lado a lado), usando o
    `service` mockado. Hook que só embrulha um `useQuery` sem lógica extra é dispensado.

## 5. Templates copiáveis

Exemplo de feature: `budgets` (orçamentos), consumindo o backend REST (`/api/budgets`).

### 5.1 Schema + tipos (`features/budgets/schemas/budget.schema.ts`)

```ts
import { z } from 'zod';

export const budgetSchema = z.object({
  id: z.number(),
  name: z.string().min(1).max(255),
  limitAmount: z.number().positive(),
  createdAt: z.string().datetime(),
});

export type Budget = z.infer<typeof budgetSchema>;

export const createBudgetSchema = budgetSchema.pick({ name: true, limitAmount: true });

export type CreateBudgetInput = z.infer<typeof createBudgetSchema>;
```

### 5.2 Cliente HTTP compartilhado (`shared/lib/api-client.ts`)

```ts
import { getSessionToken } from '@/shared/lib/auth';

export class ApiError extends Error {
  constructor(public status: number, message: string, public payload?: unknown) {
    super(message);
  }
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const token = await getSessionToken();

  const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}${path}`, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...init?.headers,
    },
  });

  if (!res.ok) {
    const payload = await res.json().catch(() => undefined);
    throw new ApiError(res.status, payload?.message ?? res.statusText, payload);
  }

  if (res.status === 204) return undefined as T;
  return res.json() as Promise<T>;
}

export const apiClient = {
  get: <T>(path: string) => request<T>(path),
  post: <T>(path: string, body: unknown) =>
    request<T>(path, { method: 'POST', body: JSON.stringify(body) }),
  patch: <T>(path: string, body: unknown) =>
    request<T>(path, { method: 'PATCH', body: JSON.stringify(body) }),
  delete: <T>(path: string) => request<T>(path, { method: 'DELETE' }),
};
```

> `getSessionToken` mora em `shared/lib/auth/` e sabe ler o cookie tanto em Server Component
> (`cookies()` do `next/headers`) quanto - quando necessário - de um endpoint client-safe. Service
> de feature nunca lida com essa diferença.

### 5.3 Service da feature (`features/budgets/services/budget.service.ts`)

```ts
import { apiClient } from '@/shared/lib/api-client';
import { budgetSchema, type Budget, type CreateBudgetInput } from '../schemas/budget.schema';
import { z } from 'zod';

export const budgetService = {
  async list(): Promise<Budget[]> {
    const data = await apiClient.get<unknown>('/budgets');
    return z.array(budgetSchema).parse(data);
  },

  async create(input: CreateBudgetInput): Promise<Budget> {
    const data = await apiClient.post<unknown>('/budgets', input);
    return budgetSchema.parse(data);
  },
};
```

### 5.4 Query keys (`features/budgets/services/query-keys.ts`)

```ts
export const budgetKeys = {
  all: ['budgets'] as const,
  list: () => [...budgetKeys.all, 'list'] as const,
  detail: (id: number) => [...budgetKeys.all, 'detail', id] as const,
};
```

### 5.5 Hooks (`features/budgets/hooks/use-budgets.ts` e `use-create-budget.ts`)

```ts
// use-budgets.ts
'use client';
import { useQuery } from '@tanstack/react-query';
import { budgetService } from '../services/budget.service';
import { budgetKeys } from '../services/query-keys';

export function useBudgets() {
  return useQuery({
    queryKey: budgetKeys.list(),
    queryFn: budgetService.list,
  });
}
```

```ts
// use-create-budget.ts
'use client';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { budgetService } from '../services/budget.service';
import { budgetKeys } from '../services/query-keys';
import type { CreateBudgetInput } from '../schemas/budget.schema';

export function useCreateBudget() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: CreateBudgetInput) => budgetService.create(input),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: budgetKeys.list() });
    },
  });
}
```

### 5.6 Componente de apresentação (`features/budgets/components/budget-card.tsx`)

```tsx
import type { Budget } from '../schemas/budget.schema';

export function BudgetCard({ budget }: { budget: Budget }) {
  return (
    <div className="rounded-lg border p-4">
      <h3 className="font-medium">{budget.name}</h3>
      <p className="text-sm text-muted-foreground">
        Limite: {budget.limitAmount.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
      </p>
    </div>
  );
}
```

### 5.7 Componente de formulário - client (`features/budgets/components/create-budget-form.tsx`)

```tsx
'use client';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { createBudgetSchema, type CreateBudgetInput } from '../schemas/budget.schema';
import { useCreateBudget } from '../hooks/use-create-budget';
import { Button } from '@/shared/ui/button';
import { Input } from '@/shared/ui/input';

export function CreateBudgetForm() {
  const { register, handleSubmit, formState } = useForm<CreateBudgetInput>({
    resolver: zodResolver(createBudgetSchema),
  });
  const createBudget = useCreateBudget();

  return (
    <form onSubmit={handleSubmit((data) => createBudget.mutate(data))}>
      <Input {...register('name')} placeholder="Nome do orçamento" />
      <Input {...register('limitAmount', { valueAsNumber: true })} type="number" />
      <Button type="submit" disabled={createBudget.isPending}>
        Criar
      </Button>
      {formState.errors.name && <p className="text-sm text-red-500">{formState.errors.name.message}</p>}
    </form>
  );
}
```

### 5.8 Página - Server Component (`app/(app)/budgets/page.tsx`)

```tsx
import { budgetService } from '@/features/budgets/services/budget.service';
import { BudgetCard } from '@/features/budgets/components/budget-card';
import { CreateBudgetForm } from '@/features/budgets/components/create-budget-form';

export default async function BudgetsPage() {
  const budgets = await budgetService.list();

  return (
    <div className="space-y-6">
      <CreateBudgetForm />
      <div className="grid gap-4">
        {budgets.map((budget) => (
          <BudgetCard key={budget.id} budget={budget} />
        ))}
      </div>
    </div>
  );
}
```

> A página busca o dado inicial no servidor (sem loading spinner na primeira carga); componentes
> client que fazem mutação (`CreateBudgetForm`) usam `useQuery`/`useMutation` e o `QueryClient`
> mantém o cache sincronizado depois disso via `invalidateQueries`.

### 5.9 Barrel da feature (`features/budgets/index.ts`)

```ts
export { BudgetCard } from './components/budget-card';
export { CreateBudgetForm } from './components/create-budget-form';
export { useBudgets } from './hooks/use-budgets';
export { budgetService } from './services/budget.service';
export type { Budget, CreateBudgetInput } from './schemas/budget.schema';
```

### 5.10 Providers globais (`shared/lib/query-client.ts` + `app/layout.tsx`)

```ts
// shared/lib/query-client.ts
import { QueryClient } from '@tanstack/react-query';

export function makeQueryClient() {
  return new QueryClient({
    defaultOptions: { queries: { staleTime: 60 * 1000 } },
  });
}
```

```tsx
// app/layout.tsx (trecho)
import { Providers } from '@/shared/lib/providers';

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR">
      <body>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
```

`shared/lib/providers.tsx` é `'use client'` e monta o `QueryClientProvider` com uma instância
criada via `useState(() => makeQueryClient())` - padrão recomendado pelo próprio TanStack Query
para evitar vazar estado entre requisições no servidor.

### 5.11 Middleware de auth (`src/middleware.ts`)

```ts
import { NextResponse, type NextRequest } from 'next/server';

const PUBLIC_PATHS = ['/login'];

export function middleware(request: NextRequest) {
  const isPublic = PUBLIC_PATHS.some((p) => request.nextUrl.pathname.startsWith(p));
  const hasSession = request.cookies.has('session_token');

  if (!isPublic && !hasSession) {
    return NextResponse.redirect(new URL('/login', request.url));
  }
  return NextResponse.next();
}

export const config = {
  matcher: ['/((?!_next|api|favicon.ico).*)'],
};
```

## 6. Bootstrap

### `app/layout.tsx`
- root layout: fontes, `<Providers>` (QueryClientProvider, tema), metadata global.
- não busca dado de negócio - isso é responsabilidade dos layouts/páginas filhas.

### `shared/config/`
Único lugar (além do próprio `middleware.ts` e arquivos de setup do framework) que lê variável de
ambiente:

```ts
// shared/config/env.ts
export const env = {
  apiUrl: process.env.NEXT_PUBLIC_API_URL!,
};
```

Variáveis expostas ao cliente **precisam** do prefixo `NEXT_PUBLIC_`; qualquer segredo (chave de
serviço, connection string) só é lido dentro de Server Component/Route Handler e nunca reexportado
por esse arquivo compartilhado com o client.

## 7. Checklist de nova feature (ponta a ponta)

1. `features/<feature>/schemas/<entidade>.schema.ts` - schema zod + tipo inferido.
2. `features/<feature>/services/<entidade>.service.ts` - funções que chamam `apiClient` e validam
   a resposta com o schema.
3. `features/<feature>/services/query-keys.ts` - chaves de cache centralizadas.
4. `features/<feature>/hooks/use-<algo>.ts` - um hook por operação (`useX`, `useCreateX`, ...).
5. `features/<feature>/hooks/use-<algo>.test.ts` - teste do hook com service mockado (regra 13),
   quando houver lógica não trivial.
6. `features/<feature>/components/*.tsx` - componentes de apresentação; `'use client'` só onde
   precisa.
7. `features/<feature>/index.ts` - barrel com a API pública da feature.
8. `app/(app)/<rota>/page.tsx` - página que compõe os componentes da feature (Server Component
   buscando dado inicial quando fizer sentido).
9. `app/(app)/<rota>/loading.tsx` e `error.tsx` - boundaries da rota.
10. Se a rota precisa de sessão: confirmar que cai no `matcher` do `middleware.ts`.
11. Verificar: `npx tsc --noEmit && npm run lint && npm run build`.

## 8. Anti-padrões (o que rejeitar em review)

- Componente chamando `fetch`/`apiClient` direto em vez de passar por um `service`.
- `'use client'` em componente que não usa estado, efeito, evento ou hook client-only - perde
  Server Component à toa.
- `process.env` lido fora de `shared/config/`, `middleware.ts` ou arquivo de setup do framework.
- Segredo de servidor (sem prefixo `NEXT_PUBLIC_`) referenciado num componente client.
- Feature importando arquivo interno de outra feature em vez do barrel (`features/x/index.ts`).
- `shared/ui/` importando algo de `features/*` ou fazendo fetch.
- `QueryClient` instanciado fora de `shared/lib/`, ou instanciado mais de uma vez fora do padrão
  `useState(() => new QueryClient())`.
- Resposta de API usada sem passar pelo schema zod numa tela que decide algo com esse dado
  (cálculo, exibição de valor monetário, permissão).
- Rota autenticada sem cobertura no `middleware.ts`, confiando só em checagem client-side.
- Hook de feature virando "hook de tudo" (fetch + mutação + estado de formulário + navegação no
  mesmo arquivo) - quebre em hooks menores.

## 9. Como adaptar em outro projeto

- **Sem TanStack Query** (app pequeno, poucas mutações): `hooks/` pode chamar `service` direto com
  `useState`/`useEffect` ou `use()` + Suspense - mas mantenha a mesma fronteira
  hook→service→api-client.
- **BFF mais forte** (agregação de múltiplos backends, cache no servidor): cresce o uso de
  `app/api/` como camada própria, com os mesmos `services/` sendo chamados a partir de Route
  Handlers em vez de (ou além de) Server Components.
- **Monorepo com design system publicado**: `shared/ui/` vira um pacote (`@financeia/ui`); o resto
  não muda - a regra de "não conhece `features/`" é o que garante que o pacote seja extraível.
- **App sem SSR relevante (SPA-like)**: quase tudo em `features/` vira `'use client'`; a página em
  `app/` fica ainda mais fina, só compondo. A separação hook/service/schema continua igual.
- **Com testes**: `*.test.ts(x)` ao lado do hook/service testado, service mockado via
  `vi.mock('../services/...')` - a arquitetura já isola I/O em `services/` pra isso ser trivial.
