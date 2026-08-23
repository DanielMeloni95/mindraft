"use client";

import * as React from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Search } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export function SearchForm({ defaultValue }: { defaultValue: string }) {
  const router = useRouter();
  const params = useSearchParams();
  const [value, setValue] = React.useState(defaultValue);

  return (
    <form
      className="mb-4 flex gap-2"
      onSubmit={(event) => {
        event.preventDefault();
        const next = new URLSearchParams(params.toString());
        if (value.trim()) next.set("q", value.trim());
        else next.delete("q");
        router.push(`/search?${next.toString()}`);
      }}
      role="search"
    >
      <div className="relative flex-1">
        <Search
          className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
          aria-hidden
        />
        <Input
          value={value}
          onChange={(event) => setValue(event.target.value)}
          placeholder="Cerca fra idee, progetti, documenti…"
          aria-label="Termine di ricerca"
          autoFocus
          className="pl-8"
        />
      </div>
      <Button type="submit" variant="primary">
        Cerca
      </Button>
    </form>
  );
}
