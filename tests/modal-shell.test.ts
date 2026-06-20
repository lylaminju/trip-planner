import { createElement } from "react";
import { describe, expect, it, vi } from "vitest";

import { ModalShell } from "@/components/ModalShell";

describe("ModalShell", () => {
  it("closes from backdrop clicks but ignores clicks inside modal content", () => {
    const onClose = vi.fn();
    const modalContent = {};
    const backdrop = {};
    const element = ModalShell({
      onClose,
      children: createElement("form", { className: "modal" }),
    });

    element.props.onClick({
      currentTarget: backdrop,
      target: modalContent,
    });
    expect(onClose).not.toHaveBeenCalled();

    element.props.onClick({
      currentTarget: backdrop,
      target: backdrop,
    });
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});
