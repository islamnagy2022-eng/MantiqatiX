export type DefaultImageKind = "activity" | "product" | "service" | "cover";

export interface DefaultImageInput {
  name?: string | null;
  description?: string | null;
  category?: string | null;
  kind?: DefaultImageKind;
}

export function resolveDefaultImage(_input: DefaultImageInput = {}): string {
  return "";
}

export function resolveDefaultActivityImages(_input: Omit<DefaultImageInput, "kind">): { logoUrl: string; coverUrl: string } {
  return { logoUrl: "", coverUrl: "" };
}

    coverUrl: resolveDefaultImage({ ...input, kind: "cover" }),
  };
}
