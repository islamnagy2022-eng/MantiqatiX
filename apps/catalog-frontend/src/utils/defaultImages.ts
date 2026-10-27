/**
 * Neutral local placeholders for missing owner-provided imagery.
 * Never imply that stock photography depicts a real business or product.
 */

export type DefaultImageKind = 'activity' | 'product' | 'service' | 'cover';

export interface DefaultImageInput {
  name?: string | null;
  description?: string | null;
  category?: string | null;
  kind?: DefaultImageKind;
}

const publicAsset = (name: string): string => {
  const base = import.meta.env.BASE_URL || '/';
  return `${base.endsWith('/') ? base : `${base}/`}${name}`;
};

export function resolveDefaultImage(input: DefaultImageInput = {}): string {
  if (input.kind === 'activity' || input.kind === 'cover') return publicAsset('business-placeholder.svg');
  return publicAsset('catalog-item-placeholder.svg');
}

export function resolveDefaultActivityImages(_input: Omit<DefaultImageInput, 'kind'>): { logoUrl: string; coverUrl: string } {
  return {
    logoUrl: publicAsset('business-placeholder.svg'),
    coverUrl: publicAsset('business-placeholder.svg'),
  };
}
