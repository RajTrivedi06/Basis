"use client";

import { AskWidget } from "@/components/ask/AskWidget";
import { AskWidgetProvider } from "@/components/ask/AskWidgetContext";

export function AskWidgetRoot() {
  return (
    <AskWidgetProvider>
      <AskWidget />
    </AskWidgetProvider>
  );
}
