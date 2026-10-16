import React, { useEffect, useRef } from "react";
import {
  createOverlayCharacter,
  type CharacterState,
  type ExitReason,
  type OverlayCharacter,
} from "@/character";

/**
 * Relays overlay events to the 3D character. Events can arrive before the
 * WebGL scene exists (first show right after the canvas mounts), so the
 * bridge remembers the current session and replays it on attach.
 */
export class CharacterBridge {
  private ch: OverlayCharacter | null = null;
  private session: { state: CharacterState; mic: boolean } | null = null;
  /** True when WebGL could not be started: the overlay falls back to the pill. */
  failed = false;

  constructor(private onExitDone: (token: unknown) => void) {}

  attach(ch: OverlayCharacter) {
    this.ch = ch;
    if (this.session) {
      ch.show(this.session.state);
      if (this.session.mic) ch.micReady();
    }
  }

  detach(ch: OverlayCharacter) {
    if (this.ch === ch) this.ch = null;
  }

  exitDone(token: unknown) {
    this.onExitDone(token);
  }

  show(state: CharacterState) {
    this.session = {
      state,
      mic: state === "recording" ? false : (this.session?.mic ?? false),
    };
    this.ch?.show(state);
  }

  micReady() {
    if (this.session) this.session.mic = true;
    this.ch?.micReady();
  }

  levels(l: number[]) {
    this.ch?.levels(l);
  }

  error() {
    this.ch?.error();
  }

  hide(reason: ExitReason, token: unknown) {
    this.session = null;
    if (this.ch) this.ch.hide(reason, token);
    else this.onExitDone(token);
  }

  /** Another overlay form takes the window (e.g. Live): drop the character at once. */
  abort() {
    this.session = null;
    this.ch?.abort();
  }
}

interface CharacterOverlayProps {
  bridge: CharacterBridge;
  onFail: () => void;
}

/** The canvas hosting the 3D character. Mounted once and kept alive, so the
 *  WebGL context, shaders and textures survive between dictations. */
export const CharacterOverlay: React.FC<CharacterOverlayProps> = ({
  bridge,
  onFail,
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    let ch: OverlayCharacter;
    try {
      ch = createOverlayCharacter(canvas, {
        onExitDone: (token) => bridge.exitDone(token),
      });
    } catch (error) {
      console.error("3D character unavailable, using the pill:", error);
      bridge.failed = true;
      onFail();
      return;
    }
    bridge.attach(ch);
    return () => {
      bridge.detach(ch);
      ch.dispose();
    };
  }, [bridge, onFail]);

  return <canvas ref={canvasRef} className="ov-character" aria-hidden="true" />;
};
