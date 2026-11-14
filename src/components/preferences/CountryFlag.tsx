import React from 'react';
import type { TargetCountryId } from '../../utils/sponsorshipHubRouting';

const FLAG_SRC: Record<TargetCountryId, string> = {
  UK: '/flags/gb.svg',
  Ireland: '/flags/ie.svg',
};

interface CountryFlagProps {
  countryId: TargetCountryId;
  label: string;
  className?: string;
  /** Pixel size for square-ish flag display */
  size?: number;
}

const CountryFlag: React.FC<CountryFlagProps> = ({
  countryId,
  label,
  className = '',
  size = 24,
}) => {
  const height = Math.round(size * 0.75);
  return (
    <img
      src={FLAG_SRC[countryId]}
      alt=""
      aria-hidden
      title={label}
      width={size}
      height={height}
      className={`inline-block object-cover rounded-sm shadow-sm ring-1 ring-black/10 shrink-0 ${className}`}
      draggable={false}
    />
  );
};

export default CountryFlag;
