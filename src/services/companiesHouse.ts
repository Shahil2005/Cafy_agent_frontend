import { auth } from './firebase';
import { getBackendUrl } from './apiConfig';

export async function getCompaniesHouseData(companyName: string) {
    const user = auth.currentUser;
    if (!user) return null;

    try {
        const token = await user.getIdToken();
        const url = `${getBackendUrl()}/api/jobs-portal/companies-house/search?q=${encodeURIComponent(companyName)}`;

        const response = await fetch(url, {
            headers: { Authorization: `Bearer ${token}` },
            signal: AbortSignal.timeout(15_000),
        });

        if (!response.ok) {
            if (response.status === 429) {
                throw new Error('Too many organisation lookups. Please wait a minute and try again.');
            }
            return null;
        }

        const { data } = await response.json();
        return data ?? null;
    } catch (err) {
        if (err instanceof Error) throw err;
        return null;
    }
}
