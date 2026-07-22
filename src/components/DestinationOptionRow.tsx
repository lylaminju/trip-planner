"use client";

import {
  countryNameFromCode,
  type DestinationOption,
} from "@/lib/destination-options";

export function DestinationOptionRow(props: {
  option: DestinationOption;
  isSelected: boolean;
  showPreview?: boolean;
  onSelect: (destination: string) => void;
}) {
  const { option, showPreview } = props;
  const countryName = showPreview ? countryNameFromCode(option.countryCode) : null;

  return (
    <button
      type="button"
      className="destination-combobox-option"
      onMouseDown={(event) => event.preventDefault()}
      onClick={() => props.onSelect(option.name)}
      role="option"
      aria-selected={props.isSelected}
    >
      {showPreview ? (
        <span
          className="destination-combobox-option-thumb"
          style={{ backgroundImage: `url("${option.imagePath}")` }}
          aria-hidden="true"
        />
      ) : null}
      {showPreview ? (
        <span className="destination-combobox-option-text">
          <span className="destination-combobox-option-name">{option.name}</span>
          {countryName ? (
            <span className="destination-combobox-option-country">
              {countryName}
            </span>
          ) : null}
        </span>
      ) : (
        <span className="destination-combobox-option-name">{option.name}</span>
      )}
    </button>
  );
}
