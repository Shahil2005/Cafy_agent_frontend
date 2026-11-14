import React from 'react';
import { CheckCircle2, AlertCircle, Shield } from 'lucide-react';
import type { SocOccupationData, SocSalaryRate } from '../../types/soc';
import { POINTS_OPTION_LABELS } from './socDisplay';

/**
 * Renders the "Sponsorship & Pay" detail for one SOC 2020 occupation from the
 * UK government dataset (uk_soc_master.json). This is the same rendering the
 * Career Path "Sponsorship & Salary" tab does — status banner, skill level,
 * going-rate / national-pay-scale tables with the A–K Skilled Worker
 * points-option badges, visa routes and the Immigration Salary List.
 */

function RateRow({ label, rate, isOnImmigrationSalaryList, phdEligible }: {
    label: string;
    rate?: SocSalaryRate;
    isOnImmigrationSalaryList: boolean;
    phdEligible: boolean | null;
}) {
    const hasValue = rate && rate.annual !== null;
    // D/I require the job to actually be on the Immigration Salary List; C/H require the job to be
    // flagged "eligible for PhD points" - showing them when the per-code fact says otherwise would
    // point the user at an option the government's own rules say gets an application refused.
    const visibleOptions = rate?.pointsOptions?.filter(p => {
        if (p === 'D' || p === 'I') return isOnImmigrationSalaryList;
        if (p === 'C' || p === 'H') return phdEligible === true;
        return true;
    });
    return (
        <div className="flex items-start justify-between gap-3 py-1.5 border-b border-slate-100 last:border-0">
            <span className="text-xs font-medium text-slate-600 flex-shrink-0 pt-0.5">{label}</span>
            {hasValue ? (
                <div className="text-right">
                    <div className="text-sm font-semibold text-slate-900">
                        £{rate!.annual!.toLocaleString()}<span className="text-xs font-normal text-slate-400">/yr</span>
                        {rate!.hourly !== null && <span className="text-xs font-normal text-slate-400"> · £{rate!.hourly!.toFixed(2)}/hr</span>}
                    </div>
                    {visibleOptions && visibleOptions.length > 0 && (
                        <div className="flex flex-wrap justify-end gap-1 mt-1">
                            {visibleOptions.map(p => (
                                <span key={p} className="px-1.5 py-0.5 bg-slate-50 border border-slate-200 rounded text-[10px] font-medium text-slate-500" title={POINTS_OPTION_LABELS[p] || 'unlabeled'}>
                                    {p}: {POINTS_OPTION_LABELS[p] || 'unlabeled'}
                                </span>
                            ))}
                        </div>
                    )}
                </div>
            ) : (
                <span className="text-xs text-slate-400 pt-0.5">Not applicable for this route</span>
            )}
        </div>
    );
}

interface SocSponsorshipPanelProps {
    socData: SocOccupationData;
    /** Shown in the heading — e.g. "SOC 2134". */
    socCode?: string;
}

const SocSponsorshipPanel: React.FC<SocSponsorshipPanelProps> = ({ socData, socCode }) => {
    const isOnIsl = !!socData.sponsorship.immigrationSalaryList;
    const phdEligible = socData.sponsorship.phdEligible;

    return (
        <div className="space-y-4">
            <h4 className="text-xs font-medium text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
                <Shield className="w-3.5 h-3.5 text-indigo-500" />
                <span>Sponsorship &amp; Salary: UK Government Data{socCode ? ` · SOC ${socCode}` : ''}</span>
            </h4>
            <p className="-mt-1 text-xs text-slate-500 font-medium">Sourced from UK government SOC 2020 records and subject to change. Verify against official sources.</p>

            {/* Status banner */}
            {(() => {
                const status = socData.sponsorship.applicantStatus;
                const statusStyle = status === 'open_to_new_applicants'
                    ? 'bg-emerald-50 border-emerald-200 text-emerald-900'
                    : status === 'legacy_only_existing_visa_holders'
                        ? 'bg-amber-50 border-amber-200 text-amber-900'
                        : 'bg-rose-50 border-rose-200 text-rose-900';
                const statusLabel = status === 'open_to_new_applicants'
                    ? 'Open to new sponsorship applicants'
                    : status === 'legacy_only_existing_visa_holders'
                        ? 'Existing visa-holders only. Not open to new applicants'
                        : 'Not eligible for UK sponsorship';
                return (
                    <div className={`p-3 rounded-xl border flex items-center gap-2.5 text-sm font-semibold ${statusStyle}`}>
                        {status === 'open_to_new_applicants'
                            ? <CheckCircle2 className="w-4 h-4 flex-shrink-0" />
                            : <AlertCircle className="w-4 h-4 flex-shrink-0" />}
                        <span>{statusLabel}</span>
                    </div>
                );
            })()}

            {/* Skill level + PhD discount */}
            <div className="flex flex-wrap gap-2">
                <span className="px-3 py-1.5 bg-indigo-50 border border-indigo-200 rounded-lg text-xs font-semibold text-indigo-700">
                    Skill level: {socData.skillLevel || 'Not stated for this occupation'}
                </span>
                <span className="px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs font-medium text-slate-600">
                    {phdEligible === null
                        ? 'PhD eligibility: not stated for this occupation type'
                        : phdEligible
                            ? 'PhD in STEM qualifies for reduced salary'
                            : 'Not PhD-eligible (confirmed)'}
                </span>
            </div>

            {/* Salary card — going rate */}
            {socData.salary.type === 'going_rate' && (
                <div className="rounded-xl border border-slate-200 bg-white overflow-hidden">
                    <div className="p-4 space-y-4">
                        {socData.salary.median ? (
                            <div>
                                <p className="text-xs font-semibold text-slate-700 mb-1">
                                    Median-based going rate <span className="font-normal text-slate-400">({socData.salary.median.source})</span>
                                </p>
                                <RateRow label="Full rate" rate={socData.salary.median.rate100} isOnImmigrationSalaryList={isOnIsl} phdEligible={phdEligible} />
                                <RateRow label="90%" rate={socData.salary.median.rate90} isOnImmigrationSalaryList={isOnIsl} phdEligible={phdEligible} />
                                <RateRow label="80%" rate={socData.salary.median.rate80} isOnImmigrationSalaryList={isOnIsl} phdEligible={phdEligible} />
                                <RateRow label="70%" rate={socData.salary.median.rate70} isOnImmigrationSalaryList={isOnIsl} phdEligible={phdEligible} />
                            </div>
                        ) : (
                            <p className="text-xs text-slate-500">Median-based going rate: not published for this occupation.</p>
                        )}
                        {socData.salary.percentile25 ? (
                            <div className="pt-3 border-t border-slate-100">
                                <p className="text-xs font-semibold text-slate-700 mb-1">
                                    25th-percentile going rate <span className="font-normal text-slate-400">({socData.salary.percentile25.source})</span>
                                </p>
                                <RateRow label="Full rate" rate={socData.salary.percentile25.rate100} isOnImmigrationSalaryList={isOnIsl} phdEligible={phdEligible} />
                                <RateRow label="90%" rate={socData.salary.percentile25.rate90} isOnImmigrationSalaryList={isOnIsl} phdEligible={phdEligible} />
                                <RateRow label="80%" rate={socData.salary.percentile25.rate80} isOnImmigrationSalaryList={isOnIsl} phdEligible={phdEligible} />
                                <RateRow label="70%" rate={socData.salary.percentile25.rate70} isOnImmigrationSalaryList={isOnIsl} phdEligible={phdEligible} />
                                <p className="text-xs text-slate-500 pt-1.5">
                                    {socData.salary.percentile25.equivalentSoc2010
                                        ? `Equivalent old SOC 2010 code(s): ${socData.salary.percentile25.equivalentSoc2010}`
                                        : 'No equivalent old SOC 2010 code stated.'}
                                </p>
                            </div>
                        ) : (
                            <p className="text-xs text-slate-500 pt-3 border-t border-slate-100">25th-percentile going rate: not published for this occupation.</p>
                        )}
                    </div>
                </div>
            )}

            {/* National pay scale card */}
            {socData.salary.type === 'national_pay_scale' && socData.salary.nationalPayScale && (
                <div className="rounded-xl border border-slate-200 bg-white p-4 space-y-4">
                    <span className="text-xs font-medium uppercase tracking-widest text-slate-400 block">Pay Scale: NHS / National Pay Scale</span>
                    {Object.entries(socData.salary.nationalPayScale.byNation).map(([nation, entry]) => (
                        <div key={nation} className="text-xs text-slate-700 bg-slate-50 border border-slate-100 rounded-lg p-3">
                            <p className="font-semibold text-slate-800 mb-1">{nation} <span className="font-normal text-slate-400">({entry.source})</span></p>
                            <p className="whitespace-pre-wrap leading-relaxed">{entry.rawText.replace(/\|/g, '\n')}</p>
                        </div>
                    ))}

                    {socData.salary.nationalPayScale.payBandReference && (
                        <div className="pt-3 border-t border-slate-100">
                            <p className="text-xs font-semibold text-slate-700 mb-1">
                                Real figures for {socData.salary.nationalPayScale.payBandReference.table}
                            </p>
                            <p className="text-xs text-slate-500 mb-2">Which exact band applies depends on seniority/grade (not specified per-job by the government source), so all bands are shown.</p>
                            <div className="max-h-52 overflow-y-auto space-y-1 rounded-lg border border-slate-100">
                                {Object.entries(socData.salary.nationalPayScale.payBandReference.data).map(([band, nations], i) => (
                                    <div key={band} className={`text-xs text-slate-700 flex flex-wrap gap-x-4 px-2.5 py-2 ${i % 2 === 0 ? 'bg-slate-50' : 'bg-white'}`}>
                                        <span className="font-semibold text-slate-800 w-16 flex-shrink-0">{band}</span>
                                        {Object.entries(nations).map(([n, v]) => (
                                            <span key={n}><span className="text-slate-400">{n}</span> <span className="font-medium">{v}</span></span>
                                        ))}
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                    {socData.salary.nationalPayScale.teacherPayReference && (
                        <div className="pt-3 border-t border-slate-100">
                            <p className="text-xs font-semibold text-slate-700 mb-1">
                                Real figures for {socData.salary.nationalPayScale.teacherPayReference.table}
                            </p>
                            <p className="text-xs text-slate-500 mb-2">Which exact role/grade applies isn't specified per-job by the government source, so all roles are shown.</p>
                            <div className="max-h-52 overflow-y-auto space-y-1 rounded-lg border border-slate-100">
                                {Object.entries(socData.salary.nationalPayScale.teacherPayReference.data).map(([role, regions], i) => (
                                    <div key={role} className={`text-xs text-slate-700 px-2.5 py-2 ${i % 2 === 0 ? 'bg-slate-50' : 'bg-white'}`}>
                                        <span className="font-semibold text-slate-800 block">{role}</span>
                                        <span className="flex flex-wrap gap-x-4 mt-0.5">
                                            {Object.entries(regions).map(([r, v]) => (
                                                <span key={r}><span className="text-slate-400">{r}</span> <span className="font-medium">{v}</span></span>
                                            ))}
                                        </span>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}
                </div>
            )}

            {socData.salary.type === 'not_eligible' && (
                <div className="p-4 bg-rose-50 border border-rose-200 rounded-xl text-sm font-semibold text-rose-800">
                    Not eligible. No UK sponsorship salary threshold published for this occupation.
                </div>
            )}

            {/* Visa routes + Immigration Salary List card */}
            <div className="rounded-xl border border-slate-200 bg-white p-4 space-y-3">
                <span className="text-xs font-medium uppercase tracking-widest text-slate-400 block">Visa Routes &amp; Immigration Salary List</span>

                {socData.sponsorship.routes ? (
                    <div className="flex flex-wrap gap-2">
                        {(['skilledWorker', 'globalBusinessMobility', 'scaleUp'] as const).map(routeKey => {
                            const eligible = socData.sponsorship.routes![routeKey];
                            const label = routeKey === 'skilledWorker' ? 'Skilled Worker' : routeKey === 'globalBusinessMobility' ? 'Global Business Mobility' : 'Scale-up';
                            return (
                                <span
                                    key={routeKey}
                                    className={`px-3 py-1.5 border rounded-lg text-xs font-medium flex items-center gap-1.5 ${eligible ? 'bg-emerald-50 border-emerald-200 text-emerald-700' : 'bg-slate-50 border-slate-200 text-slate-400 line-through'}`}
                                >
                                    {eligible ? <CheckCircle2 className="w-3.5 h-3.5" /> : <AlertCircle className="w-3.5 h-3.5" />}
                                    {label}
                                </span>
                            );
                        })}
                    </div>
                ) : (
                    <p className="text-xs font-medium text-slate-500">No visa route applies. Not eligible for sponsorship.</p>
                )}

                {socData.sponsorship.immigrationSalaryList ? (
                    <div className="space-y-2">
                        {socData.sponsorship.immigrationSalaryList.map((entry, i) => (
                            <div key={i} className="p-3 bg-indigo-50 border border-indigo-200 rounded-lg text-xs font-medium text-indigo-900 leading-relaxed">
                                On the Immigration Salary List ({entry.criteria}). Applies in: {Object.entries(entry.nations).filter(([, v]) => v).map(([n]) => n).join(', ') || 'none specified'}. Removal date: {entry.removalDate}.
                            </div>
                        ))}
                    </div>
                ) : (
                    <p className="text-xs font-medium text-slate-500">Not on the Immigration Salary List.</p>
                )}
            </div>
        </div>
    );
};

export default SocSponsorshipPanel;
