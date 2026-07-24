"use client";

import {
  useId,
  useMemo,
  useState,
  type FocusEvent,
  type KeyboardEvent,
  type ReactNode,
} from "react";

import {
  filterDestinationOptions,
  findDestinationOption,
} from "@/lib/destination-options";

import { DestinationOptionRow } from "./DestinationOptionRow";

export function DestinationCombobox(props: {
  value: string;
  onChange: (destination: string) => void;
  inputId?: string;
  leadingIcon?: ReactNode;
  showPreview?: boolean;
  // When set, only these preset slugs are offered and custom destinations are
  // disabled (guest mode: destinations need a ready-made attraction catalog).
  allowedSlugs?: readonly string[];
}) {
  const generatedInputId = useId();
  const listId = useId();
  const inputId = props.inputId ?? generatedInputId;
  const [isOpen, setIsOpen] = useState(false);
  const allowedSlugs = props.allowedSlugs;
  const filteredOptions = useMemo(() => {
    const options = filterDestinationOptions(props.value);
    return allowedSlugs
      ? options.filter((option) => allowedSlugs.includes(option.slug))
      : options;
  }, [props.value, allowedSlugs]);
  const trimmedValue = props.value.trim();
  const matchedOption = findDestinationOption(trimmedValue);
  const showCustomOption = Boolean(
    trimmedValue && !matchedOption && !allowedSlugs,
  );

  function closeOnBlur(event: FocusEvent<HTMLDivElement>) {
    const nextTarget = event.relatedTarget as Node | null;
    if (!event.currentTarget.contains(nextTarget)) {
      setIsOpen(false);
    }
  }

  function selectDestination(destination: string) {
    props.onChange(destination);
    setIsOpen(false);
  }

  function handleKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key === "Escape") {
      event.preventDefault();
      setIsOpen(false);
      return;
    }

    if (event.key === "ArrowDown") {
      setIsOpen(true);
    }
  }

  const wrapperClassName = props.leadingIcon
    ? "destination-combobox destination-combobox-has-icon"
    : "destination-combobox";

  return (
    <div className={wrapperClassName} onBlur={closeOnBlur}>
      {props.leadingIcon ? (
        <span className="destination-combobox-icon" aria-hidden="true">
          {props.leadingIcon}
        </span>
      ) : null}
      <input
        id={inputId}
        value={props.value}
        onChange={(event) => {
          props.onChange(event.currentTarget.value);
          setIsOpen(true);
        }}
        onFocus={() => setIsOpen(true)}
        onKeyDown={handleKeyDown}
        placeholder="Search destinations"
        autoComplete="off"
        role="combobox"
        aria-autocomplete="list"
        aria-expanded={isOpen}
        aria-controls={listId}
        required
      />

      <div className="destination-combobox-popover" hidden={!isOpen}>
        <div className="destination-combobox-list" id={listId} role="listbox">
          {filteredOptions.map((option) => (
            <DestinationOptionRow
              key={option.slug}
              option={option}
              isSelected={matchedOption?.slug === option.slug}
              showPreview={props.showPreview}
              onSelect={selectDestination}
            />
          ))}

          {showCustomOption ? (
            <button
              type="button"
              className="destination-combobox-option destination-combobox-custom-option"
              onMouseDown={(event) => event.preventDefault()}
              onClick={() => selectDestination(trimmedValue)}
              role="option"
              aria-selected="false"
            >
              <span className="destination-combobox-option-name">
                Use &quot;{trimmedValue}&quot; as custom destination
              </span>
            </button>
          ) : null}

          {!filteredOptions.length && !showCustomOption ? (
            <p className="destination-combobox-empty">No destinations found.</p>
          ) : null}
        </div>
      </div>
    </div>
  );
}
