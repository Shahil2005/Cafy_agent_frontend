import { auth } from './firebase';
import { getBackendUrl } from './apiConfig';

export type ResourceId =
  | 'uk-nhs-organisations-directory'
  | 'uk-council-careers-directory'
  | 'uk-manufacturing-companies-directory'
  | 'uk-automobile-companies-directory'
  | 'uk-finance-money-capital-companies-directory'
  | 'uk-football-clubs-directory'
  | 'uk-technology-engineering-companies-directory'
  | 'uk-supply-chain-employers-directory'
  | 'uk-electronics-employers-directory';

export type ResourceCategoryId =
  | 'nhs'
  | 'council'
  | 'manufacturing'
  | 'automobile'
  | 'finance'
  | 'football'
  | 'technology'
  | 'supply-chain'
  | 'electronics';

export interface ResourceItem {
  id: ResourceId;
  categoryId?: ResourceCategoryId;
  title: string;
  description: string;
  fileName: string;
  format: string;
  fileSizeBytes: number;
  fileSizeLabel: string;
  badge: string;
  highlights: string[];
  downloadPath: string;
  downloadCount: number;
  uniqueDownloaderCount: number;
  fileReady?: boolean;
}

export interface ResourceCategoryItem {
  id: ResourceCategoryId;
  label: string;
  status: 'available' | 'coming_soon';
  title: string;
  description: string;
  badge: string;
  highlights: string[];
  resourceId: ResourceId | null;
  downloadCount: number;
  uniqueDownloaderCount: number;
}

const CATEGORY_ORDER: ResourceCategoryId[] = [
  'council',
  'nhs',
  'manufacturing',
  'automobile',
  'finance',
  'football',
  'technology',
  'supply-chain',
  'electronics',
];

export function sortCategories(
  categories: ResourceCategoryItem[]
): ResourceCategoryItem[] {
  const rank = (id: ResourceCategoryId) => {
    const i = CATEGORY_ORDER.indexOf(id);
    return i === -1 ? 99 : i;
  };
  return [...categories].sort((a, b) => rank(a.id) - rank(b.id));
}

const SPONSORED_LIST_DESCRIPTION_SUFFIX =
  ' Every organisation listed here is sourced from the official **UK sponsored** employers register.';

function resourceItem(
  partial: Omit<ResourceItem, 'downloadCount' | 'uniqueDownloaderCount' | 'downloadPath' | 'fileReady'> & {
    downloadPath?: string;
  }
): ResourceItem {
  return {
    ...partial,
    downloadPath:
      partial.downloadPath ?? `/api/resources/${encodeURIComponent(partial.id)}/file`,
    downloadCount: 72,
    uniqueDownloaderCount: 0,
    fileReady: true,
  };
}

export const FALLBACK_RESOURCES: ResourceItem[] = [
  resourceItem({
    id: 'uk-nhs-organisations-directory',
    categoryId: 'nhs',
    title: 'UK NHS Organisations Directory',
    description:
      'A curated directory of UK NHS organisations to help you research employers, target applications, and plan your healthcare career path.' +
      SPONSORED_LIST_DESCRIPTION_SUFFIX,
    fileName: 'Cafy_Careers_UK_NHS_Organisations_Directory.pdf',
    format: 'PDF',
    fileSizeBytes: 186385,
    fileSizeLabel: '182 KB',
    badge: 'UK · NHS',
    highlights: [
      'Organised for career research',
      'Useful for applications & outreach',
      'Updated for Cafy users',
    ],
  }),
  resourceItem({
    id: 'uk-council-careers-directory',
    categoryId: 'council',
    title: 'UK Council Careers Directory',
    description:
      'A curated directory of UK councils and local authorities to help you research public-sector employers and target applications.' +
      SPONSORED_LIST_DESCRIPTION_SUFFIX,
    fileName: 'Cafy_Careers_UK_Council_Careers_Directory.pdf',
    format: 'PDF',
    fileSizeBytes: 189591,
    fileSizeLabel: '185 KB',
    badge: 'UK · Council',
    highlights: [
      'Local authority employer lists',
      'Useful for public-sector applications',
      'Organised for career research',
    ],
  }),
  resourceItem({
    id: 'uk-manufacturing-companies-directory',
    categoryId: 'manufacturing',
    title: 'UK Manufacturing Companies Directory',
    description:
      'A curated directory of UK manufacturing employers to help you research companies, target applications, and plan your next move.' +
      SPONSORED_LIST_DESCRIPTION_SUFFIX,
    fileName: 'Cafy_Careers_UK_Manufacturing_Companies_Directory.pdf',
    format: 'PDF',
    fileSizeBytes: 198594,
    fileSizeLabel: '194 KB',
    badge: 'UK · Manufacturing',
    highlights: [
      'Manufacturing employer research',
      'Useful for applications & outreach',
      'Organised for career targeting',
    ],
  }),
  resourceItem({
    id: 'uk-automobile-companies-directory',
    categoryId: 'automobile',
    title: 'UK Automobile Companies Directory',
    description:
      'A curated directory of UK automotive employers to help you research OEMs, suppliers, and related opportunities.' +
      SPONSORED_LIST_DESCRIPTION_SUFFIX,
    fileName: 'Cafy_Careers_UK_Automobile_Companies_Directory.pdf',
    format: 'PDF',
    fileSizeBytes: 179059,
    fileSizeLabel: '175 KB',
    badge: 'UK · Automobile',
    highlights: [
      'Automotive employer research',
      'Useful for applications & outreach',
      'Organised for career targeting',
    ],
  }),
  resourceItem({
    id: 'uk-finance-money-capital-companies-directory',
    categoryId: 'finance',
    title: 'UK Finance, Money & Capital Companies Directory',
    description:
      'A curated directory of UK finance, banking, and capital-markets employers to help you research companies and target applications.' +
      SPONSORED_LIST_DESCRIPTION_SUFFIX,
    fileName: 'Cafy_Careers_UK_Finance_Money_Capital_Companies_Directory.pdf',
    format: 'PDF',
    fileSizeBytes: 193329,
    fileSizeLabel: '189 KB',
    badge: 'UK · Finance',
    highlights: [
      'Finance & capital markets employers',
      'Useful for applications & outreach',
      'Organised for career targeting',
    ],
  }),
  resourceItem({
    id: 'uk-football-clubs-directory',
    categoryId: 'football',
    title: 'UK Football Clubs Directory',
    description:
      'A curated directory of UK football clubs to help you research employers and target applications in the football industry.' +
      SPONSORED_LIST_DESCRIPTION_SUFFIX,
    fileName: 'Cafy_Careers_UK_Football_Clubs_Directory.pdf',
    format: 'PDF',
    fileSizeBytes: 189177,
    fileSizeLabel: '185 KB',
    badge: 'UK · Football',
    highlights: [
      'Football club employer lists',
      'Useful for applications & outreach',
      'Organised for career research',
    ],
  }),
  resourceItem({
    id: 'uk-technology-engineering-companies-directory',
    categoryId: 'technology',
    title: 'UK Technology & Engineering Companies Directory',
    description:
      'A curated directory of UK technology and engineering employers to help you research companies, target applications, and plan your next move.' +
      SPONSORED_LIST_DESCRIPTION_SUFFIX,
    fileName: 'Cafy_Careers_UK_Technology_Engineering_Companies_Directory.pdf',
    format: 'PDF',
    fileSizeBytes: 191666,
    fileSizeLabel: '187 KB',
    badge: 'UK · Technology',
    highlights: [
      'Tech & engineering employer research',
      'Useful for applications & outreach',
      'Organised for career targeting',
    ],
  }),
  resourceItem({
    id: 'uk-supply-chain-employers-directory',
    categoryId: 'supply-chain',
    title: 'UK Supply Chain Employers Directory',
    description:
      'A curated directory of UK supply-chain and logistics employers to help you research companies and target applications.' +
      SPONSORED_LIST_DESCRIPTION_SUFFIX,
    fileName: 'Cafy_Careers_UK_Supply_Chain_Employers_Directory.pdf',
    format: 'PDF',
    fileSizeBytes: 179138,
    fileSizeLabel: '175 KB',
    badge: 'UK · Supply Chain',
    highlights: [
      'Logistics & supply-chain employers',
      'Useful for applications & outreach',
      'Organised for career targeting',
    ],
  }),
  resourceItem({
    id: 'uk-electronics-employers-directory',
    categoryId: 'electronics',
    title: 'UK Electronics Employers Directory',
    description:
      'A curated directory of UK electronics employers to help you research companies, target applications, and plan your next move.' +
      SPONSORED_LIST_DESCRIPTION_SUFFIX,
    fileName: 'Cafy_Careers_UK_Electronics_Employers_Directory.pdf',
    format: 'PDF',
    fileSizeBytes: 190322,
    fileSizeLabel: '186 KB',
    badge: 'UK · Electronics',
    highlights: [
      'Electronics employer research',
      'Useful for applications & outreach',
      'Organised for career targeting',
    ],
  }),
];

const byId = Object.fromEntries(FALLBACK_RESOURCES.map((r) => [r.id, r])) as Record<
  ResourceId,
  ResourceItem
>;

function categoryFromResource(
  id: ResourceCategoryId,
  label: string,
  resourceId: ResourceId
): ResourceCategoryItem {
  const r = byId[resourceId];
  return {
    id,
    label,
    status: 'available',
    title: r.title,
    description: r.description,
    badge: r.badge,
    highlights: r.highlights,
    resourceId,
    downloadCount: 72,
    uniqueDownloaderCount: 0,
  };
}

export const FALLBACK_CATEGORIES: ResourceCategoryItem[] = [
  categoryFromResource('council', 'Council', 'uk-council-careers-directory'),
  categoryFromResource('nhs', 'NHS', 'uk-nhs-organisations-directory'),
  categoryFromResource('manufacturing', 'Manufacturing', 'uk-manufacturing-companies-directory'),
  categoryFromResource('automobile', 'Automobile', 'uk-automobile-companies-directory'),
  categoryFromResource('finance', 'Finance', 'uk-finance-money-capital-companies-directory'),
  categoryFromResource('football', 'Football', 'uk-football-clubs-directory'),
  categoryFromResource('technology', 'Technology', 'uk-technology-engineering-companies-directory'),
  categoryFromResource('supply-chain', 'Supply Chain', 'uk-supply-chain-employers-directory'),
  categoryFromResource('electronics', 'Electronics', 'uk-electronics-employers-directory'),
];

export class ResourcesApiError extends Error {
  status: number;
  code?: string;

  constructor(message: string, status: number, code?: string) {
    super(message);
    this.name = 'ResourcesApiError';
    this.status = status;
    this.code = code;
  }
}

async function authHeaders(): Promise<HeadersInit> {
  const user = auth.currentUser;
  if (!user) throw new ResourcesApiError('Not authenticated', 401);
  const token = await user.getIdToken();
  return {
    Authorization: `Bearer ${token}`,
    Accept: 'application/json',
  };
}

async function parseError(res: Response): Promise<ResourcesApiError> {
  try {
    const body = (await res.json()) as { message?: string; error?: string };
    if (res.status === 429) {
      return new ResourcesApiError(
        body.message || 'Too many download requests. Please wait a moment.',
        429,
        body.error || 'RATE_LIMITED'
      );
    }
    return new ResourcesApiError(
      body.message || 'Request failed',
      res.status,
      body.error
    );
  } catch {
    return new ResourcesApiError('Request failed', res.status);
  }
}

export async function listResourcesCatalog(signal?: AbortSignal): Promise<{
  categories: ResourceCategoryItem[];
  resources: ResourceItem[];
}> {
  const res = await fetch(`${getBackendUrl()}/api/resources`, {
    headers: await authHeaders(),
    signal,
  });
  if (!res.ok) throw await parseError(res);
  const data = (await res.json()) as {
    categories?: ResourceCategoryItem[];
    resources?: ResourceItem[];
  };

  const resources = Array.isArray(data.resources) ? data.resources : [];
  const categories =
    Array.isArray(data.categories) && data.categories.length > 0
      ? sortCategories(data.categories)
      : FALLBACK_CATEGORIES;

  return { categories, resources };
}

export async function trackResourceDownload(
  resourceId: ResourceId
): Promise<ResourceItem & { ok: boolean }> {
  const res = await fetch(`${getBackendUrl()}/api/resources/${resourceId}/download`, {
    method: 'POST',
    headers: await authHeaders(),
  });
  if (!res.ok) throw await parseError(res);
  return res.json();
}

/** Authenticated PDF fetch → object URL (caller must revoke). */
export async function fetchResourceBlobUrl(
  resourceId: ResourceId,
  disposition: 'inline' | 'attachment' = 'inline',
  signal?: AbortSignal
): Promise<string> {
  const res = await fetch(
    `${getBackendUrl()}/api/resources/${encodeURIComponent(resourceId)}/file?disposition=${disposition}`,
    {
      method: 'GET',
      headers: await authHeaders(),
      cache: 'no-store',
      signal,
    }
  );
  if (!res.ok) throw await parseError(res);
  const blob = await res.blob();
  if (blob.size < 100) {
    throw new ResourcesApiError('File is temporarily unavailable', 502);
  }
  return URL.createObjectURL(blob);
}

export async function downloadResourceFile(
  resourceId: ResourceId,
  fileName: string,
  signal?: AbortSignal
): Promise<void> {
  const blobUrl = await fetchResourceBlobUrl(resourceId, 'attachment', signal);
  try {
    const a = document.createElement('a');
    a.href = blobUrl;
    a.download = fileName;
    a.rel = 'noopener';
    document.body.appendChild(a);
    a.click();
    a.remove();
  } finally {
    window.setTimeout(() => URL.revokeObjectURL(blobUrl), 2_000);
  }
}
