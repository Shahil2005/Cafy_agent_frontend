import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import type { SocMasterOccupation, VisaSalaryRules } from '../../types/soc';
import { buildOfferMarket, parseOfferAnnual } from './offerMarket';

const occupation = {
    code: '1137',
    title: 'Information technology directors',
    salary: {
        type: 'going_rate',
        currency: 'GBP',
        median: {
            source: 'Table 1',
            rate100: { annual: 86000, hourly: 44.1, pointsOptions: ['A'] },
            rate70: { annual: 60200, hourly: 30.87, pointsOptions: ['E'] },
        },
        percentile25: null,
        nationalPayScale: null,
    },
} as SocMasterOccupation;

const rules = {
    pointsOptions: { A: { floorSalary: 41700 } },
} as unknown as VisaSalaryRules;

describe('parseOfferAnnual', () => {
    it('reads a single yearly amount', () => {
        assert.deepEqual(parseOfferAnnual('£90,000'), {
            low: 90000,
            high: 90000,
            hourly: false,
            upperBound: false,
        });
    });

    it('reads a yearly range and a thousands shorthand', () => {
        assert.deepEqual(parseOfferAnnual('£90,000 - £110,000'), {
            low: 90000,
            high: 110000,
            hourly: false,
            upperBound: false,
        });
        assert.deepEqual(parseOfferAnnual('£75K - £110k')?.low, 75000);
        assert.equal(parseOfferAnnual('£85-125,000')?.low, 85000);
        assert.equal(parseOfferAnnual('£85-125,000')?.high, 125000);
        assert.equal(parseOfferAnnual('38000-44000 GBP per year')?.high, 44000);
    });

    it('turns an hourly rate into a year using the stated weekly hours', () => {
        const offer = parseOfferAnnual('£25 per hour, 40 hours a week');
        assert.deepEqual(offer, { low: 52000, high: 52000, hourly: true, upperBound: false });
    });

    it('uses a 37.5 hour week when the advert does not state the hours', () => {
        assert.equal(parseOfferAnnual('£25 per hour')?.low, 48750);
        assert.equal(parseOfferAnnual('65-75 GBP per hour')?.low, 126750);
        assert.equal(parseOfferAnnual('65-75 GBP per hour')?.high, 146250);
        assert.equal(parseOfferAnnual('Salary: 13.56-14.50 per hour')?.low, 26442);
    });

    it('ignores a bonus, holiday days, empty pay, and non-pound currencies', () => {
        assert.equal(parseOfferAnnual('£60,000 plus £5,000 bonus')?.low, 60000);
        assert.equal(parseOfferAnnual('£60,000 plus £5,000 bonus')?.high, 60000);
        assert.equal(parseOfferAnnual('£60,000 plus 25 days holiday')?.low, 60000);
        assert.equal(parseOfferAnnual('Pay Basis: Hourly Rate'), null);
        assert.equal(parseOfferAnnual('£0.00 - £0.00'), null);
        assert.equal(parseOfferAnnual('$80k-$90k'), null);
        assert.equal(parseOfferAnnual('€90K – €140K'), null);
    });

    it('treats a zero lower bound as an upper limit', () => {
        assert.deepEqual(parseOfferAnnual('£0 - £70,000'), {
            low: 70000,
            high: 70000,
            hourly: false,
            upperBound: true,
        });
    });
});

describe('buildOfferMarket offer sentence', () => {
    it('compares the yearly hourly pay with the going rate', () => {
        const view = buildOfferMarket(occupation, rules, '£25 per hour, 40 hours a week');
        assert.equal(view?.offer, '£52,000 a year');
        assert.equal(view?.goingRate, '£86,000');
        assert.equal(view?.rateSource, 'Table 1');
        assert.equal(
            view?.sentence,
            'This offer clears the general threshold of £41,700, and it is below the going rate of £86,000.',
        );
    });

    it('does not treat an upper bound as a salary that clears the route', () => {
        const view = buildOfferMarket(occupation, rules, '£0 - £70,000');
        assert.equal(view?.offer, 'Up to £70,000');
        assert.equal(view?.sentence.includes('clears'), false);
    });
});
