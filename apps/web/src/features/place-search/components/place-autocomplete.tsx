'use client';

import type { Place } from '@baldeacao/types';
import { useId, useState, type KeyboardEvent } from 'react';

import { PLACE_SEARCH_MIN_LENGTH, usePlaceSearch, type PlaceSearchStatus } from '../hooks';

export interface PlaceAutocompleteProps {
  /** Rótulo visível do campo, ex.: "Origem". */
  label: string;
  /** Lugar escolhido; null enquanto o usuário não escolheu nenhuma sugestão. */
  value: Place | null;
  /** Chamado ao escolher uma sugestão e com null quando o texto deixa de ser o lugar escolhido. */
  onChange: (place: Place | null) => void;
  placeholder?: string;
  /** id do input; sem ele é gerado um. */
  id?: string;
}

const STATUS_MESSAGES: Partial<Record<PlaceSearchStatus, string>> = {
  'too-short': `Digite pelo menos ${PLACE_SEARCH_MIN_LENGTH} caracteres.`,
  loading: 'Buscando lugares...',
  empty: 'Nenhum lugar encontrado.',
  error: 'Não foi possível buscar lugares. Tente de novo.',
};

/** Campo de busca de lugar no padrão combobox (WAI-ARIA), com sugestões navegáveis por teclado. */
export function PlaceAutocomplete({
  label,
  value,
  onChange,
  placeholder,
  id,
}: PlaceAutocompleteProps) {
  const generatedId = useId();
  const inputId = id ?? `place-${generatedId}`;
  const listboxId = `${inputId}-listbox`;
  const statusId = `${inputId}-status`;

  const [text, setText] = useState(value?.name ?? '');
  const [prevValue, setPrevValue] = useState(value);
  const [isOpen, setIsOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);

  // Valor trocado por fora (ex.: inverter origem e destino): o texto acompanha. Quando vira null
  // porque o usuário editou o texto, o que ele digitou é mantido.
  if (value !== prevValue) {
    setPrevValue(value);
    if (value) setText(value.name);
    else if (text === prevValue?.name) setText('');
  }

  const { status, places } = usePlaceSearch(text, value === null);
  const showList = isOpen && status === 'success';
  const message = isOpen ? STATUS_MESSAGES[status] : undefined;
  const activePlace = showList && activeIndex >= 0 ? places[activeIndex] : undefined;

  function select(place: Place) {
    setText(place.name);
    setIsOpen(false);
    setActiveIndex(-1);
    onChange(place);
  }

  function handleTextChange(next: string) {
    setText(next);
    setIsOpen(true);
    setActiveIndex(-1);
    if (value) onChange(null);
  }

  function handleKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    switch (event.key) {
      case 'ArrowDown':
      case 'ArrowUp': {
        event.preventDefault();
        if (!isOpen) {
          setIsOpen(true);
          return;
        }
        if (places.length === 0) return;
        const step = event.key === 'ArrowDown' ? 1 : -1;
        setActiveIndex((current) => {
          if (current < 0) return step === 1 ? 0 : places.length - 1;
          return (current + step + places.length) % places.length;
        });
        return;
      }
      case 'Enter':
        if (activePlace) {
          event.preventDefault();
          select(activePlace);
        }
        return;
      case 'Escape':
        if (isOpen) {
          event.preventDefault();
          setIsOpen(false);
          setActiveIndex(-1);
        } else if (text) {
          event.preventDefault();
          handleTextChange('');
          setIsOpen(false);
        }
        return;
    }
  }

  return (
    <div className="relative">
      <label htmlFor={inputId} className="mb-1 block text-sm font-medium text-neutral-800">
        {label}
      </label>
      <input
        id={inputId}
        type="text"
        role="combobox"
        autoComplete="off"
        spellCheck={false}
        aria-autocomplete="list"
        aria-expanded={showList}
        aria-controls={listboxId}
        aria-describedby={statusId}
        aria-activedescendant={activePlace ? `${listboxId}-${activeIndex}` : undefined}
        placeholder={placeholder}
        value={text}
        onChange={(event) => handleTextChange(event.target.value)}
        onKeyDown={handleKeyDown}
        onFocus={() => setIsOpen(true)}
        onBlur={() => {
          setIsOpen(false);
          setActiveIndex(-1);
        }}
        className="h-10 w-full rounded-lg border border-neutral-300 bg-white px-3 text-base focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-700"
      />
      <p
        id={statusId}
        role={status === 'error' && message ? 'alert' : 'status'}
        className={
          message
            ? `mt-1 text-sm ${status === 'error' ? 'text-red-700' : 'text-neutral-600'}`
            : 'sr-only'
        }
      >
        {message ?? (showList ? `${places.length} sugestões disponíveis.` : '')}
      </p>
      <ul
        id={listboxId}
        role="listbox"
        aria-label={`Sugestões para ${label}`}
        hidden={!showList}
        className="absolute inset-x-0 top-full z-10 mt-1 max-h-72 overflow-y-auto rounded-lg border border-neutral-200 bg-white py-1 shadow-lg"
      >
        {showList
          ? places.map((place, index) => (
              <li
                key={place.id}
                id={`${listboxId}-${index}`}
                role="option"
                aria-selected={index === activeIndex}
                // mousedown antes do blur do input: sem isso a lista fecha antes do clique.
                onMouseDown={(event) => event.preventDefault()}
                onClick={() => select(place)}
                onMouseEnter={() => setActiveIndex(index)}
                className={`cursor-pointer px-3 py-2 ${index === activeIndex ? 'bg-blue-50' : ''}`}
              >
                <span className="block font-medium">{place.name}</span>
                {place.address ? (
                  <span className="block truncate text-sm text-neutral-600">{place.address}</span>
                ) : null}
              </li>
            ))
          : null}
      </ul>
    </div>
  );
}
