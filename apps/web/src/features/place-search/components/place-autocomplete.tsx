'use client';

import type { Place } from '@baldeacao/types';
import { Fragment, useId, useRef, useState, type KeyboardEvent, type ReactNode } from 'react';

import { locate } from '@/shared/hooks/use-geolocation';
import { CrosshairIcon, LocateIcon, SearchIcon } from '@/shared/ui/icons';
import { CURRENT_LOCATION_NAME, currentLocationPlace } from '@/shared/utils/place';

import {
  PLACE_SEARCH_MIN_LENGTH,
  RECENT_PLACES_MAX,
  usePlaceSearch,
  useRecentPlaces,
  useResolvePlace,
} from '../hooks';
import { highlightMatch, pickConfirmed } from '../utils/match';
import { placeSubtitle } from '../utils/place-subtitle';
import { PLACE_KIND_LABELS, PlaceKindIcon } from './place-kind-icon';

export interface PlaceAutocompleteProps {
  /** Nome acessível do campo, ex.: "Origem" (o visual fica no placeholder). */
  label: string;
  /** Lugar escolhido; null enquanto nenhum foi escolhido. */
  value: Place | null;
  /** Chamado ao escolher um lugar e com null quando o texto deixa de ser o lugar escolhido. */
  onChange: (place: Place | null) => void;
  placeholder?: string;
  /** id do input; sem ele é gerado um. */
  id?: string;
  autoFocus?: boolean;
  /** Atalho "Escolher no mapa": quem compõe a tela liga a mira no mapa. */
  onPickOnMap?: () => void;
}

type Option =
  | { type: 'current-location' }
  | { type: 'pick-on-map' }
  | { type: 'place'; place: Place; group?: 'recent' }
  | { type: 'search-full'; query: string };

type ResolveState =
  | { status: 'idle' }
  | { status: 'resolving'; query: string }
  | { status: 'choices'; query: string; places: Place[] }
  | { status: 'not-found'; query: string }
  | { status: 'error'; query: string }
  | { status: 'geo-error' };

const BUTTON_CLASS =
  'inline-flex h-11 items-center gap-2 rounded-sm border border-border bg-surface px-3 text-sm font-bold';

function isAbort(error: unknown): boolean {
  return error instanceof DOMException && error.name === 'AbortError';
}

/**
 * Campo de lugar no padrão combobox (WAI-ARIA). Aceita o que foi digitado: Enter sem item ativo
 * ou sair do campo escolhe a 1ª sugestão; sem sugestão, faz a busca completa de endereço.
 */
export function PlaceAutocomplete({
  label,
  value,
  onChange,
  placeholder,
  id,
  autoFocus,
  onPickOnMap,
}: PlaceAutocompleteProps) {
  const generatedId = useId();
  const inputId = id ?? `place-${generatedId}`;
  const listboxId = `${inputId}-listbox`;
  const statusId = `${inputId}-status`;
  const subtitleId = `${inputId}-subtitle`;

  const [text, setText] = useState(value?.name ?? '');
  const [prevValue, setPrevValue] = useState(value);
  const [isOpen, setIsOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);
  const [resolve, setResolve] = useState<ResolveState>({ status: 'idle' });
  const requestRef = useRef(0);
  const resolveFull = useResolvePlace();
  const { recents, addRecent } = useRecentPlaces();

  // Valor trocado por fora (ex.: inverter origem e destino): o texto acompanha. Quando vira null
  // porque o usuário editou o texto, o que ele digitou é mantido.
  if (value !== prevValue) {
    setPrevValue(value);
    if (value) setText(value.name);
    else if (text === prevValue?.name) setText('');
  }

  const trimmed = text.trim();
  const search = usePlaceSearch(text, value === null && resolve.status !== 'choices');

  let options: Option[] = [];
  if (resolve.status === 'choices') {
    options = resolve.places.map((place) => ({ type: 'place', place }));
  } else if (isOpen && !value) {
    if (trimmed === '') {
      options = [
        { type: 'current-location' },
        ...(onPickOnMap ? [{ type: 'pick-on-map' } as const] : []),
        ...recents
          .slice(0, RECENT_PLACES_MAX)
          .map((place) => ({ type: 'place', place, group: 'recent' }) as const),
      ];
    } else if (trimmed.length >= PLACE_SEARCH_MIN_LENGTH) {
      options = [
        ...search.places.map((place) => ({ type: 'place', place }) as const),
        { type: 'search-full', query: trimmed },
      ];
    }
  }
  const showList = options.length > 0;
  const active = showList && activeIndex >= 0 ? options[activeIndex] : undefined;

  function select(place: Place) {
    requestRef.current++;
    setText(place.name);
    setIsOpen(false);
    setActiveIndex(-1);
    setResolve({ status: 'idle' });
    addRecent(place);
    onChange(place);
  }

  async function runFullSearch(query: string, explicit: boolean) {
    const request = ++requestRef.current;
    setResolve({ status: 'resolving', query });
    try {
      const places = await resolveFull(query);
      if (request !== requestRef.current) return;
      if (places.length === 0) {
        setResolve({ status: 'not-found', query });
        return;
      }
      // Pedido explícito ("Buscar endereço") mostra a lista; o implícito escolhe o melhor.
      const pick = explicit
        ? places.length === 1
          ? places[0]!
          : 'ambiguous'
        : pickConfirmed(places);
      if (pick === 'ambiguous' || pick === null) {
        setActiveIndex(-1);
        setResolve({ status: 'choices', query, places });
      } else {
        select(pick);
      }
    } catch (error) {
      if (request !== requestRef.current || isAbort(error)) return;
      setResolve({ status: 'error', query });
    }
  }

  /** Aceita o texto digitado: 1ª sugestão rápida ou, sem ela, a busca completa. */
  function acceptTyped() {
    if (value || trimmed.length < PLACE_SEARCH_MIN_LENGTH) return;
    if (resolve.status === 'resolving' || resolve.status === 'choices') return;
    const first = search.status === 'success' && search.query === trimmed ? search.places[0] : null;
    if (first) select(first);
    else void runFullSearch(trimmed, false);
  }

  async function chooseMyLocation() {
    setIsOpen(false);
    const position = await locate();
    if (position) select(currentLocationPlace(position));
    else setResolve({ status: 'geo-error' });
  }

  function pickOnMap() {
    setIsOpen(false);
    setActiveIndex(-1);
    setResolve({ status: 'idle' });
    onPickOnMap?.();
  }

  function activate(option: Option) {
    switch (option.type) {
      case 'current-location':
        void chooseMyLocation();
        return;
      case 'pick-on-map':
        pickOnMap();
        return;
      case 'place':
        select(option.place);
        return;
      case 'search-full':
        setIsOpen(false);
        void runFullSearch(option.query, true);
        return;
    }
  }

  function handleTextChange(next: string) {
    requestRef.current++;
    setText(next);
    setIsOpen(true);
    setActiveIndex(-1);
    setResolve({ status: 'idle' });
    if (value) onChange(null);
  }

  function handleKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    switch (event.key) {
      case 'ArrowDown':
      case 'ArrowUp': {
        event.preventDefault();
        if (!isOpen && resolve.status !== 'choices') {
          setIsOpen(true);
          return;
        }
        if (options.length === 0) return;
        const step = event.key === 'ArrowDown' ? 1 : -1;
        setActiveIndex((current) => {
          if (current < 0) return step === 1 ? 0 : options.length - 1;
          return (current + step + options.length) % options.length;
        });
        return;
      }
      case 'Enter':
        event.preventDefault();
        if (active) activate(active);
        else acceptTyped();
        return;
      case 'Escape':
        if (isOpen || resolve.status === 'choices') {
          event.preventDefault();
          setIsOpen(false);
          setActiveIndex(-1);
          if (resolve.status === 'choices') setResolve({ status: 'idle' });
        } else if (text) {
          event.preventDefault();
          handleTextChange('');
          setIsOpen(false);
        }
        return;
    }
  }

  // Mensagem do momento (visível) e o que o leitor de tela anuncia.
  let message: ReactNode = null;
  let isAlert = false;
  if (resolve.status === 'resolving') {
    message = <p className="text-sm text-muted">Buscando endereço...</p>;
  } else if (resolve.status === 'not-found') {
    message = (
      <>
        <p className="text-sm">
          Não achamos &quot;{resolve.query}&quot;. Tente rua e número, por exemplo Rua Augusta,
          1500, ou o nome de uma estação.
        </p>
        <div className="mt-2 flex flex-wrap gap-2">
          {onPickOnMap ? (
            <button type="button" className={BUTTON_CLASS} onClick={pickOnMap}>
              <CrosshairIcon className="size-4" /> Escolher no mapa
            </button>
          ) : null}
          <button type="button" className={BUTTON_CLASS} onClick={() => void chooseMyLocation()}>
            <LocateIcon className="size-4" /> Usar minha localização
          </button>
        </div>
      </>
    );
  } else if (resolve.status === 'error' || (isOpen && !value && search.status === 'error')) {
    isAlert = true;
    const retry =
      resolve.status === 'error' ? () => void runFullSearch(resolve.query, false) : search.retry;
    message = (
      <>
        <p className="text-sm text-danger">Sem conexão com a busca. Tente de novo.</p>
        <button type="button" className={`${BUTTON_CLASS} mt-2`} onClick={retry}>
          Tentar de novo
        </button>
      </>
    );
  } else if (resolve.status === 'geo-error') {
    message = (
      <p className="text-sm">
        Não conseguimos sua localização. Confira a permissão do navegador ou digite o endereço.
      </p>
    );
  } else if (isOpen && !value && search.status === 'too-short') {
    message = (
      <p className="text-sm text-muted">Digite pelo menos {PLACE_SEARCH_MIN_LENGTH} caracteres.</p>
    );
  } else if (isOpen && !value && search.status === 'loading') {
    message = <p className="text-sm text-muted">Buscando lugares...</p>;
  }

  const placeCount = options.filter((o) => o.type === 'place').length;
  const announcement =
    resolve.status === 'choices'
      ? `${placeCount} endereços encontrados para ${resolve.query}.`
      : showList && trimmed
        ? `${placeCount} sugestões disponíveis.`
        : '';

  const firstRecentIndex = options.findIndex((o) => o.type === 'place' && o.group === 'recent');
  const highlightQuery = resolve.status === 'choices' ? resolve.query : trimmed;
  // Lugar escolhido: endereço ou tipo abaixo do nome, para perceber se pegou o lugar errado.
  const subtitle = value && text === value.name ? placeSubtitle(value) : null;

  return (
    <div className="relative min-w-0 flex-1">
      <input
        id={inputId}
        type="text"
        role="combobox"
        autoComplete="off"
        spellCheck={false}
        enterKeyHint="search"
        autoFocus={autoFocus}
        aria-label={label}
        aria-autocomplete="list"
        aria-expanded={showList}
        aria-controls={listboxId}
        aria-describedby={subtitle ? `${subtitleId} ${statusId}` : statusId}
        aria-activedescendant={active ? `${listboxId}-${activeIndex}` : undefined}
        placeholder={placeholder}
        value={text}
        onChange={(event) => handleTextChange(event.target.value)}
        onKeyDown={handleKeyDown}
        onFocus={(event) => {
          setIsOpen(true);
          if (value) event.currentTarget.select();
        }}
        onBlur={() => {
          setIsOpen(false);
          setActiveIndex(-1);
          acceptTyped();
        }}
        className={`w-full rounded-sm bg-transparent px-2 text-base placeholder:text-muted hover:bg-surface-2 ${
          subtitle ? 'h-11 pt-1 font-semibold' : 'h-12'
        }`}
      />
      {subtitle ? (
        <p
          id={subtitleId}
          data-testid="place-subtitle"
          className="-mt-1 truncate px-2 pb-1.5 text-sm text-muted"
        >
          {subtitle}
        </p>
      ) : null}
      <div
        // Cliques dentro da lista não tiram o foco do campo (senão o blur escolheria antes).
        onMouseDown={(event) => event.preventDefault()}
        hidden={!showList && !message}
        className="surface-float absolute inset-x-0 top-full z-40 mt-1 max-h-96 overflow-y-auto rounded-md py-1"
      >
        <div
          id={statusId}
          role={isAlert ? 'alert' : 'status'}
          className={message ? 'px-3 py-2' : 'sr-only'}
        >
          {message ?? announcement}
        </div>
        <ul id={listboxId} role="listbox" aria-label={`Sugestões para ${label}`} hidden={!showList}>
          {options.map((option, index) => (
            <OptionRow
              key={optionKey(option, index)}
              id={`${listboxId}-${index}`}
              option={option}
              query={highlightQuery}
              selected={index === activeIndex}
              groupLabel={index === firstRecentIndex ? 'Recentes' : undefined}
              onActivate={() => activate(option)}
              onHover={() => setActiveIndex(index)}
            />
          ))}
        </ul>
      </div>
    </div>
  );
}

function optionKey(option: Option, index: number): string {
  if (option.type === 'place') return `${option.group ?? 'place'}-${option.place.id}`;
  return `${option.type}-${index}`;
}

interface OptionRowProps {
  id: string;
  option: Option;
  query: string;
  selected: boolean;
  groupLabel: string | undefined;
  onActivate: () => void;
  onHover: () => void;
}

function OptionRow({
  id,
  option,
  query,
  selected,
  groupLabel,
  onActivate,
  onHover,
}: OptionRowProps) {
  let icon: ReactNode;
  let title: ReactNode;
  let subtitle: string | null = null;
  switch (option.type) {
    case 'current-location':
      icon = <LocateIcon />;
      title = CURRENT_LOCATION_NAME;
      subtitle = 'Usar o GPS do aparelho';
      break;
    case 'pick-on-map':
      icon = <CrosshairIcon />;
      title = 'Escolher no mapa';
      subtitle = 'Arraste o mapa até o ponto';
      break;
    case 'search-full':
      icon = <SearchIcon />;
      title = `Buscar endereço "${option.query}"`;
      subtitle = 'Ruas e números, no OpenStreetMap';
      break;
    case 'place':
      icon = <PlaceKindIcon kind={option.place.kind} />;
      title = highlightMatch(option.place.name, query).map((segment, i) =>
        segment.match ? (
          <strong key={i} className="font-extrabold">
            {segment.text}
          </strong>
        ) : (
          <Fragment key={i}>{segment.text}</Fragment>
        ),
      );
      subtitle = option.place.address ?? PLACE_KIND_LABELS[option.place.kind];
      break;
  }

  return (
    <>
      {groupLabel ? (
        <li role="presentation" className="px-3 pt-2 pb-1 text-xs font-bold text-muted uppercase">
          {groupLabel}
        </li>
      ) : null}
      <li
        id={id}
        role="option"
        aria-selected={selected}
        onClick={onActivate}
        onMouseEnter={onHover}
        className={`flex min-h-14 items-center gap-3 px-3 py-2 ${selected ? 'bg-surface-2' : ''}`}
      >
        <span className="inline-flex size-9 shrink-0 items-center justify-center rounded-full bg-surface-2 text-muted">
          {icon}
        </span>
        <span className="min-w-0">
          <span className="block truncate font-semibold">{title}</span>
          {subtitle ? <span className="block truncate text-sm text-muted">{subtitle}</span> : null}
        </span>
      </li>
    </>
  );
}
