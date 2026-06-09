import type { TimeZoneOption } from "@/lib/timezones";
import {
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
  type FocusEvent,
  type KeyboardEvent,
} from "react";

type TimeZoneOptionParts = {
  name: string;
  meta: string;
  city: string;
};

export function timeZoneOptionParts(
  option: TimeZoneOption,
): TimeZoneOptionParts {
  const separator = " - ";
  const separatorIndex = option.label.indexOf(separator);
  const hasMeta = separatorIndex > -1;
  const name = hasMeta
    ? option.label.slice(separatorIndex + separator.length)
    : option.label;
  const meta = hasMeta ? option.label.slice(0, separatorIndex) : "";
  const city = name.split("/").pop()?.replace(/_/g, " ") ?? name;

  return { name, meta, city };
}

export function filterTimeZoneOptions(
  options: TimeZoneOption[],
  query: string,
): TimeZoneOption[] {
  const normalizedQuery = query.trim().toLowerCase();
  if (!normalizedQuery) {
    return options;
  }

  return options.filter((option) => {
    const parts = timeZoneOptionParts(option);
    const searchable = [
      option.value,
      option.label,
      parts.name,
      parts.meta,
      parts.city,
    ]
      .join(" ")
      .toLowerCase();

    return searchable.includes(normalizedQuery);
  });
}

export function TimeZoneSelect(props: {
  value: string;
  options: TimeZoneOption[];
  onChange: (timezone: string) => void;
  ariaLabel?: string;
}) {
  const listId = useId();
  const searchId = useId();
  const searchInputRef = useRef<HTMLInputElement>(null);
  const [isOpen, setIsOpen] = useState(false);
  const [query, setQuery] = useState("");
  const selectedOption =
    props.options.find((option) => option.value === props.value) ?? null;
  const selectedParts = selectedOption
    ? timeZoneOptionParts(selectedOption)
    : { name: props.value, meta: "", city: props.value };
  const filteredOptions = useMemo(
    () => filterTimeZoneOptions(props.options, query),
    [props.options, query],
  );

  useEffect(() => {
    if (!isOpen) {
      setQuery("");
      return;
    }

    searchInputRef.current?.focus();
  }, [isOpen]);

  function closeOnBlur(event: FocusEvent<HTMLDivElement>) {
    const nextTarget = event.relatedTarget as Node | null;
    if (!event.currentTarget.contains(nextTarget)) {
      setIsOpen(false);
    }
  }

  function selectTimeZone(timezone: string) {
    props.onChange(timezone);
    setIsOpen(false);
  }

  function handleButtonKeyDown(event: KeyboardEvent<HTMLButtonElement>) {
    if (
      event.key === "ArrowDown" ||
      event.key === "Enter" ||
      event.key === " "
    ) {
      event.preventDefault();
      setIsOpen(true);
    }
  }

  function handlePickerKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    if (event.key === "Escape") {
      event.preventDefault();
      setIsOpen(false);
    }
  }

  return (
    <div
      className="timezone-select"
      onBlur={closeOnBlur}
      onKeyDown={handlePickerKeyDown}
    >
      <button
        type="button"
        className="timezone-select-trigger"
        onClick={() => setIsOpen((current) => !current)}
        onKeyDown={handleButtonKeyDown}
        role="combobox"
        aria-expanded={isOpen}
        aria-haspopup="listbox"
        aria-label={props.ariaLabel}
        aria-controls={listId}
      >
        <span className="timezone-select-current">
          <span className="timezone-select-name">{selectedParts.name}</span>
          {selectedParts.meta ? (
            <span className="timezone-select-meta">{selectedParts.meta}</span>
          ) : null}
        </span>
        <span className="timezone-select-caret" aria-hidden="true">
          ▾
        </span>
      </button>

      <div className="timezone-select-popover" hidden={!isOpen}>
        <label className="timezone-select-search" htmlFor={searchId}>
          <span className="sr-only">Search timezones</span>
          <input
            id={searchId}
            ref={searchInputRef}
            value={query}
            onChange={(event) => setQuery(event.currentTarget.value)}
            placeholder="Search timezones"
            autoComplete="off"
          />
        </label>
        <div className="timezone-select-list" id={listId} role="listbox">
          {filteredOptions.length ? (
            filteredOptions.map((option) => {
              const parts = timeZoneOptionParts(option);
              const isSelected = option.value === props.value;

              return (
                <button
                  type="button"
                  className="timezone-select-option"
                  key={option.value}
                  onClick={() => selectTimeZone(option.value)}
                  role="option"
                  aria-selected={isSelected}
                >
                  <span className="timezone-select-option-main">
                    <span className="timezone-select-city">{parts.city}</span>
                    <span className="timezone-select-name">{parts.name}</span>
                  </span>
                  {parts.meta ? (
                    <span className="timezone-select-meta">{parts.meta}</span>
                  ) : null}
                </button>
              );
            })
          ) : (
            <p className="timezone-select-empty">No timezones found.</p>
          )}
        </div>
      </div>
    </div>
  );
}
