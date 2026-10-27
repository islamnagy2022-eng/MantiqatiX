export type DefaultImageKind = "activity" | "product" | "service" | "cover";

export interface DefaultImageInput {
  name?: string | null;
  description?: string | null;
  category?: string | null;
  kind?: DefaultImageKind;
}

/**
 * Do not return third-party stock imagery as if it depicts a real business or item.
 * The frontend renders local neutral placeholders when these values are empty.
 */
export function resolveDefaultImage(_input: DefaultImageInput = {}): string {
  return "";
}

export function resolveDefaultActivityImages(
  _input: Omit<DefaultImageInput, "kind">,
): { logoUrl: string; coverUrl: string } {
  return { logoUrl: "", coverUrl: "" };
}
