"use client";

import {
  useId,
  useMemo,
  useState,
  type FocusEvent,
  type KeyboardEvent,
} from "react";

import { isAiPlanningDestinationSupported } from "@/lib/ai-planning";
import {
  filterDestinationOptions,
  findDestinationOption,
} from "@/lib/destination-options";

export function DestinationCombobox(props: {
  value: string;
  onChange: (destination: string) => void;
  inputId?: string;
}) {
  const generatedInputId = useId();
  const listId = useId();
  const inputId = props.inputId ?? generatedInputId;
  const [isOpen, setIsOpen] = useState(false);
  const filteredOptions = useMemo(
    () => filterDestinationOptions(props.value),
    [props.value],
  );
  const trimmedValue = props.value.trim();
  const matchedOption = findDestinationOption(trimmedValue);
  const showCustomOption = Boolean(trimmedValue && !matchedOption);

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

  return (
    <div className="destination-combobox" onBlur={closeOnBlur}>
      <input
        id={inputId}
        value={props.value}
        onChange={(event) => {
          props.onChange(event.currentTarget.value);
          setIsOpen(true);
        }}
        onFocus={() => setIsOpen(true)}
        onKeyDown={handleKeyDown}
        placeholder="Search or type destination"
        autoComplete="off"
        role="combobox"
        aria-autocomplete="list"
        aria-expanded={isOpen}
        aria-controls={listId}
        required
      />

      <div className="destination-combobox-popover" hidden={!isOpen}>
        <div className="destination-combobox-list" id={listId} role="listbox">
          {filteredOptions.map((option) => {
            const isSelected = matchedOption?.slug === option.slug;

            return (
              <button
                type="button"
                className="destination-combobox-option"
                key={option.slug}
                onMouseDown={(event) => event.preventDefault()}
                onClick={() => selectDestination(option.name)}
                role="option"
                aria-selected={isSelected}
              >
                <span className="destination-combobox-option-name">
                  {option.name}
                </span>
                {isAiPlanningDestinationSupported(option.slug) ? (
                  <span className="destination-combobox-option-badge">
                    🪄 AI-planning available
                  </span>
                ) : null}
              </button>
            );
          })}

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
