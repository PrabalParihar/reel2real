"use client";

import type { KeyboardEvent, ReactNode } from "react";

export function filmstripKeyJumps(key: string): boolean {
  return key === "Enter" || key === " ";
}

export function jumpFromClick(index: number, jump: (index: number) => void) {
  jump(index);
}

export function jumpFromKey(key: string, index: number, jump: (index: number) => void): boolean {
  if (!filmstripKeyJumps(key)) return false;
  jump(index);
  return true;
}

export function Filmstrip({
  steps,
  current,
  onJump,
}: {
  steps: Array<{ id: string; thumb: ReactNode; title?: string }>;
  current: number;
  onJump: (index: number) => void;
}) {
  function onKeyDown(event: KeyboardEvent<HTMLButtonElement>, index: number) {
    if (!jumpFromKey(event.key, index, onJump)) return;
    event.preventDefault();
  }

  return (
    <ol className={`filmstrip${steps.length > 3 ? " is-scroll" : ""}`}>
      {steps.map((step, index) => {
        const currentStep = index === current;
        return (
          <li key={step.id} className={currentStep ? "is-current" : ""}>
            <button
              type="button"
              className="film-jump"
              role="button"
              tabIndex={0}
              aria-label={`Go to step ${index + 1}`}
              aria-current={currentStep ? "step" : undefined}
              onClick={() => jumpFromClick(index, onJump)}
              onKeyDown={(event) => onKeyDown(event, index)}
            >
              {step.thumb}
              <span className="film-num">{index + 1}</span>
              {currentStep && step.title ? <span className="film-title">{step.title}</span> : null}
            </button>
          </li>
        );
      })}
    </ol>
  );
}
