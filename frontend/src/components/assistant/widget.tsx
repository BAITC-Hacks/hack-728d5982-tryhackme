import Script from "next/script";
import assistant from "@/generated/assistant.json";
import "@/generated/widget.css";

export function AssistantWidget() {
  return (
    <>
      {/* Only build-owned HTML. React does not manage the mutable chat subtree. */}
      <div className="assistant-widget" dangerouslySetInnerHTML={{ __html: assistant.markup }} />
      <Script id="ekt-assistant-runtime" src="/assistant/runtime.js" strategy="afterInteractive" />
    </>
  );
}
