'use client';

import type { Route } from '@baldeacao/types';
import Link from 'next/link';
import { type ReactNode, useId, useState } from 'react';

import { SearchIcon } from '@/shared/ui/icons';

import { LINE_SEARCH_MIN_LENGTH, useLineSearch } from '../hooks';
import { LineBadge } from './line-badge';

const TYPE_LABELS: Record<Route['type'], string> = {
  bus: 'Ônibus',
  trolleybus: 'Trólebus',
  subway: 'Metrô',
  rail: 'Trem',
  tram: 'Bonde',
  ferry: 'Balsa',
};

export interface LineSearchProps {
  /** Link de cada resultado (a página decide a rota). */
  hrefFor: (line: Route) => string;
  autoFocus?: boolean;
}

/** Campo de busca de linha (código ou nome) e a lista de resultados com o selo da linha. */
export function LineSearch({ hrefFor, autoFocus = false }: LineSearchProps) {
  const inputId = useId();
  const statusId = `${inputId}-status`;
  const [text, setText] = useState('');
  const search = useLineSearch(text);

  let message: ReactNode = null;
  switch (search.status) {
    case 'idle':
      message = 'Digite o número ou o nome da linha, por exemplo 875A ou Lapa.';
      break;
    case 'too-short':
      message = `Digite pelo menos ${LINE_SEARCH_MIN_LENGTH} caracteres.`;
      break;
    case 'loading':
      message = 'Buscando linhas...';
      break;
    case 'empty':
      message = `Nenhuma linha encontrada para "${search.query}".`;
      break;
    case 'error':
      message = (
        <>
          <span className="text-danger">Sem conexão com a busca. Tente de novo.</span>
          <button
            type="button"
            onClick={search.retry}
            className="mt-2 block h-11 rounded-sm border border-border px-4 text-sm font-bold"
          >
            Tentar de novo
          </button>
        </>
      );
      break;
    case 'success':
      message = (
        <span className="sr-only">
          {search.lines.length === 1
            ? '1 linha encontrada.'
            : `${search.lines.length} linhas encontradas.`}
        </span>
      );
      break;
  }

  return (
    <div role="search" aria-label="Buscar linha">
      <label htmlFor={inputId} className="sr-only">
        Buscar linha
      </label>
      <div className="flex h-14 items-center gap-3 rounded-md bg-surface-2 px-4">
        <SearchIcon className="size-6 shrink-0 text-muted" />
        <input
          id={inputId}
          type="search"
          autoComplete="off"
          spellCheck={false}
          enterKeyHint="search"
          autoFocus={autoFocus}
          aria-describedby={statusId}
          placeholder="Número ou nome da linha"
          value={text}
          onChange={(event) => setText(event.target.value)}
          className="h-full min-w-0 flex-1 bg-transparent text-lg placeholder:text-muted"
        />
      </div>
      <div
        id={statusId}
        role={search.status === 'error' ? 'alert' : 'status'}
        className="mt-3 text-sm text-muted"
      >
        {message}
      </div>
      {search.status === 'success' ? (
        <ul aria-label="Linhas encontradas" className="mt-1 divide-y divide-border">
          {search.lines.map((line) => (
            <li key={line.id}>
              <Link
                href={hrefFor(line)}
                className="flex min-h-14 items-center gap-3 rounded-sm px-1 py-2 hover:bg-surface-2"
              >
                <LineBadge line={line} />
                <span className="min-w-0">
                  <span className="block truncate font-semibold">{line.longName}</span>
                  <span className="block text-sm text-muted">{TYPE_LABELS[line.type]}</span>
                </span>
              </Link>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
