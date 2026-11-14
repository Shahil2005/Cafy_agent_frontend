/**
 * Official UK cities for the part-time jobs filter.
 * Kept in step with ProductBackend/jobs-portal/partTimeCities.ts.
 */

export const PART_TIME_UK_CITIES = [
    'Aberdeen',
    'Armagh',
    'Bangor',
    'Bath',
    'Belfast',
    'Birmingham',
    'Bradford',
    'Brighton & Hove',
    'Bristol',
    'Cambridge',
    'Canterbury',
    'Cardiff',
    'Carlisle',
    'Chelmsford',
    'Chester',
    'Chichester',
    'Colchester',
    'Coventry',
    'Derby',
    'Doncaster',
    'Dundee',
    'Dunfermline',
    'Durham',
    'Edinburgh',
    'Ely',
    'Exeter',
    'Glasgow',
    'Gloucester',
    'Hereford',
    'Inverness',
    'Kingston-upon-Hull',
    'Lancaster',
    'Leeds',
    'Leicester',
    'Lichfield',
    'Lincoln',
    'Lisburn',
    'Liverpool',
    'London',
    'Londonderry',
    'Manchester',
    'Milton Keynes',
    'Newcastle-upon-Tyne',
    'Newport',
    'Newry',
    'Norwich',
    'Nottingham',
    'Oxford',
    'Perth',
    'Peterborough',
    'Plymouth',
    'Portsmouth',
    'Preston',
    'Ripon',
    'Salford',
    'Salisbury',
    'Sheffield',
    'Southampton',
    'Southend-on-Sea',
    'St Albans',
    'St Asaph',
    'St Davids',
    'Stirling',
    'Stoke on Trent',
    'Sunderland',
    'Swansea',
    'Truro',
    'Wakefield',
    'Wells',
    'Westminster',
    'Winchester',
    'Wolverhampton',
    'Worcester',
    'Wrexham',
    'York',
] as const;

export type PartTimeUkCity = (typeof PART_TIME_UK_CITIES)[number];

const PART_TIME_UK_CITY_SET = new Set<string>(PART_TIME_UK_CITIES);

const PART_TIME_UK_CITY_ALIASES: Record<string, PartTimeUkCity> = {
    Brighton: 'Brighton & Hove',
    'Brighton and Hove': 'Brighton & Hove',
    Hull: 'Kingston-upon-Hull',
    'Kingston upon Hull': 'Kingston-upon-Hull',
    Newcastle: 'Newcastle-upon-Tyne',
    'Newcastle upon Tyne': 'Newcastle-upon-Tyne',
    Southend: 'Southend-on-Sea',
    'Southend on Sea': 'Southend-on-Sea',
    'St. Albans': 'St Albans',
    'Saint Albans': 'St Albans',
    'Stoke-on-Trent': 'Stoke on Trent',
    Derry: 'Londonderry',
    'St. Asaph': 'St Asaph',
    'Saint Asaph': 'St Asaph',
    'St. Davids': 'St Davids',
    "St David's": 'St Davids',
    'Saint Davids': 'St Davids',
};

/** Canonical official city name, or null when the value is not a UK city. */
export function officialPartTimeCity(raw: string): string | null {
    const trimmed = raw.trim();
    if (!trimmed) return null;
    if (PART_TIME_UK_CITY_SET.has(trimmed)) return trimmed;
    return PART_TIME_UK_CITY_ALIASES[trimmed] ?? null;
}

export function isOfficialPartTimeCity(raw: string): boolean {
    return officialPartTimeCity(raw) !== null;
}
