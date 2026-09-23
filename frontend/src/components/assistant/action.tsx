"use client";

import { useSyncExternalStore } from "react";
import { Button, type ButtonProps } from "@/components/ui/button";

function subscribe(callback: () => void) {
  window.addEventListener("ekt:ready", callback);
  return () => window.removeEventListener("ekt:ready", callback);
}
const snapshot = () => document.documentElement.dataset.assistantReady === "true";
const serverSnapshot = () => false;

export function AssistantAction(props: ButtonProps) {
  const ready = useSyncExternalStore(subscribe, snapshot, serverSnapshot);
  return <Button {...props} disabled={!ready || props.disabled} />;
}
