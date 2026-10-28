export type CoverAdPlacement = 'HOME_ONLY' | 'BUSINESS_COVER' | 'BOTH';
export type CoverAdDuration = 'MONTHLY' | 'QUARTERLY' | 'SEMIANNUAL' | 'ANNUAL';
export type CoverAdLocationScope = 'ALL' | 'GOVERNORATE' | 'CITY';

export interface CoverAdvertisement {
  id: string;
  title: string;
  imageUrl: string;
  storagePath?: string;
  targetUrl: string;
  placement: CoverAdPlacement;
  duration: CoverAdDuration;
  startDate: string;
  endDate: string;
  targetBusinessIds: string[];
  locationScope: CoverAdLocationScope;
  locationValue: string;
  price: number;
  status: 'ACTIVE' | 'INACTIVE';
  createdAt?: string;
}

export type CoverAdvertisementDraft = Omit<CoverAdvertisement, 'id' | 'imageUrl' | 'storagePath' | 'endDate' | 'createdAt'> & {
  id?: string;
  imageUrl?: string;
  storagePath?: string;
  endDate?: string;
};
