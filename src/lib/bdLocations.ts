export interface BdArea {
  name: string;
  postalCode?: string;
}

export interface BdUpazila {
  name: string;
  areas: BdArea[];
}

export interface BdDistrict {
  name: string;
  isDhakaMetro?: boolean;
  upazilas: BdUpazila[];
}

export interface BdDivision {
  name: string;
  districts: BdDistrict[];
}

export const BD_DIVISIONS: BdDivision[] = [
  {
    name: 'Dhaka',
    districts: [
      {
        name: 'Dhaka',
        isDhakaMetro: true,
        upazilas: [
          {
            name: 'Dhanmondi',
            areas: [
              { name: 'Dhanmondi 27 / Sobhanbag', postalCode: '1209' },
              { name: 'Dhanmondi 15 / Rayer Bazar', postalCode: '1209' },
              { name: 'Kalabagan', postalCode: '1205' },
              { name: 'Green Road', postalCode: '1205' },
              { name: 'Jigatola', postalCode: '1209' },
            ],
          },
          {
            name: 'Gulshan',
            areas: [
              { name: 'Gulshan 1', postalCode: '1212' },
              { name: 'Gulshan 2', postalCode: '1212' },
              { name: 'Banani', postalCode: '1213' },
              { name: 'Baridhara', postalCode: '1212' },
              { name: 'Niketan', postalCode: '1212' },
            ],
          },
          {
            name: 'Mirpur',
            areas: [
              { name: 'Mirpur 1', postalCode: '1216' },
              { name: 'Mirpur 2', postalCode: '1216' },
              { name: 'Mirpur 10', postalCode: '1216' },
              { name: 'Mirpur 11', postalCode: '1216' },
              { name: 'Mirpur 12', postalCode: '1216' },
              { name: 'Pallabi', postalCode: '1216' },
            ],
          },
          {
            name: 'Uttara',
            areas: [
              { name: 'Sector 1 - 4', postalCode: '1230' },
              { name: 'Sector 5 - 9', postalCode: '1230' },
              { name: 'Sector 10 - 14', postalCode: '1230' },
              { name: 'Uttarkhan', postalCode: '1230' },
            ],
          },
          {
            name: 'Mohammadpur',
            areas: [
              { name: 'Lalmatia', postalCode: '1207' },
              { name: 'Asad Gate', postalCode: '1207' },
              { name: 'Adabor', postalCode: '1207' },
              { name: 'Bosila', postalCode: '1207' },
            ],
          },
          {
            name: 'Motijheel',
            areas: [
              { name: 'Motijheel Commercial Area', postalCode: '1000' },
              { name: 'Arambagh', postalCode: '1000' },
              { name: 'Fakirapool', postalCode: '1000' },
            ],
          },
          {
            name: 'Savar',
            areas: [
              { name: 'Savar Pourashava', postalCode: '1340' },
              { name: 'Ashulia', postalCode: '1341' },
              { name: 'Hemayetpur', postalCode: '1340' },
            ],
          },
        ],
      },
      {
        name: 'Gazipur',
        upazilas: [
          {
            name: 'Gazipur Sadar',
            areas: [
              { name: 'Joydebpur', postalCode: '1700' },
              { name: 'Tongi', postalCode: '1710' },
              { name: 'Konabari', postalCode: '1700' },
            ],
          },
          {
            name: 'Sreepur',
            areas: [
              { name: 'Sreepur Pourashava', postalCode: '1740' },
              { name: 'Mawna', postalCode: '1740' },
            ],
          },
        ],
      },
      {
        name: 'Narayanganj',
        upazilas: [
          {
            name: 'Narayanganj Sadar',
            areas: [
              { name: 'Chashara', postalCode: '1400' },
              { name: 'Fatullah', postalCode: '1420' },
              { name: 'Siddhirganj', postalCode: '1430' },
            ],
          },
          {
            name: 'Rupganj',
            areas: [
              { name: 'Bhulta', postalCode: '1462' },
              { name: 'Purbachal Sector 1-10', postalCode: '1460' },
            ],
          },
        ],
      },
      {
        name: 'Tangail',
        upazilas: [
          {
            name: 'Tangail Sadar',
            areas: [
              { name: 'Tangail Pourashava', postalCode: '1900' },
              { name: 'Santosh', postalCode: '1902' },
            ],
          },
        ],
      },
    ],
  },
  {
    name: 'Chattogram',
    districts: [
      {
        name: 'Chattogram',
        upazilas: [
          {
            name: 'Panchlaish',
            areas: [
              { name: 'GEC Circle', postalCode: '4000' },
              { name: 'Nasirabad', postalCode: '4000' },
              { name: 'Muradpur', postalCode: '4000' },
            ],
          },
          {
            name: 'Kotwali',
            areas: [
              { name: 'Agrabad', postalCode: '4100' },
              { name: 'New Market', postalCode: '4000' },
              { name: 'Jamal Khan', postalCode: '4000' },
            ],
          },
          {
            name: 'Halishahar',
            areas: [
              { name: 'Halishahar Housing Estate', postalCode: '4216' },
              { name: 'Pahartali', postalCode: '4202' },
            ],
          },
        ],
      },
      {
        name: "Cox's Bazar",
        upazilas: [
          {
            name: "Cox's Bazar Sadar",
            areas: [
              { name: 'Kolatoli', postalCode: '4700' },
              { name: 'Sugandha Point', postalCode: '4700' },
              { name: 'Link Road', postalCode: '4700' },
            ],
          },
        ],
      },
      {
        name: 'Cumilla',
        upazilas: [
          {
            name: 'Cumilla Adarsha Sadar',
            areas: [
              { name: 'Kandirpar', postalCode: '3500' },
              { name: 'Ranir Bazar', postalCode: '3500' },
            ],
          },
        ],
      },
    ],
  },
  {
    name: 'Rajshahi',
    districts: [
      {
        name: 'Rajshahi',
        upazilas: [
          {
            name: 'Boalia',
            areas: [
              { name: 'Shaheb Bazar', postalCode: '6100' },
              { name: 'Uposhohor', postalCode: '6202' },
              { name: 'Padma Residential', postalCode: '6207' },
            ],
          },
          {
            name: 'Motihar',
            areas: [
              { name: 'Binodpur', postalCode: '6206' },
              { name: 'Kazla', postalCode: '6204' },
            ],
          },
        ],
      },
      {
        name: 'Bogura',
        upazilas: [
          {
            name: 'Bogura Sadar',
            areas: [
              { name: 'Satmatha', postalCode: '5800' },
              { name: 'Jaleswaritola', postalCode: '5800' },
            ],
          },
        ],
      },
    ],
  },
  {
    name: 'Khulna',
    districts: [
      {
        name: 'Khulna',
        upazilas: [
          {
            name: 'Sonadanga',
            areas: [
              { name: 'Sonadanga Residential', postalCode: '9100' },
              { name: 'Nirala', postalCode: '9100' },
            ],
          },
          {
            name: 'Khalishpur',
            areas: [
              { name: 'Khalishpur Housing', postalCode: '9000' },
              { name: 'Daulatpur', postalCode: '9202' },
            ],
          },
        ],
      },
      {
        name: 'Jashore',
        upazilas: [
          {
            name: 'Jashore Sadar',
            areas: [
              { name: 'Doratana', postalCode: '7400' },
              { name: 'Arabpur', postalCode: '7400' },
            ],
          },
        ],
      },
    ],
  },
  {
    name: 'Sylhet',
    districts: [
      {
        name: 'Sylhet',
        upazilas: [
          {
            name: 'Sylhet Sadar',
            areas: [
              { name: 'Zindabazar', postalCode: '3100' },
              { name: 'Amberkhana', postalCode: '3100' },
              { name: 'Shahjalal Upashahar', postalCode: '3100' },
              { name: 'Modina Market', postalCode: '3100' },
            ],
          },
        ],
      },
      {
        name: 'Moulvibazar',
        upazilas: [
          {
            name: 'Sreemangal',
            areas: [
              { name: 'Sreemangal Town', postalCode: '3210' },
              { name: 'Kalighat Road', postalCode: '3210' },
            ],
          },
        ],
      },
    ],
  },
  {
    name: 'Barishal',
    districts: [
      {
        name: 'Barishal',
        upazilas: [
          {
            name: 'Barishal Sadar',
            areas: [
              { name: 'Sadar Road', postalCode: '8200' },
              { name: 'Nathullabad', postalCode: '8200' },
              { name: 'Rupatali', postalCode: '8207' },
            ],
          },
        ],
      },
    ],
  },
  {
    name: 'Rangpur',
    districts: [
      {
        name: 'Rangpur',
        upazilas: [
          {
            name: 'Rangpur Sadar',
            areas: [
              { name: 'Jahaj Company More', postalCode: '5400' },
              { name: 'Dhap', postalCode: '5400' },
              { name: 'Modern More', postalCode: '5402' },
            ],
          },
        ],
      },
    ],
  },
  {
    name: 'Mymensingh',
    districts: [
      {
        name: 'Mymensingh',
        upazilas: [
          {
            name: 'Mymensingh Sadar',
            areas: [
              { name: 'Ganginar Par', postalCode: '2200' },
              { name: 'Charpara', postalCode: '2200' },
              { name: 'Maskanda', postalCode: '2200' },
            ],
          },
        ],
      },
    ],
  },
];

export function getDivisionNames(): string[] {
  return BD_DIVISIONS.map((d) => d.name);
}

export function getDistrictsForDivision(divisionName: string): BdDistrict[] {
  const div = BD_DIVISIONS.find((d) => d.name === divisionName);
  return div ? div.districts : [];
}

export function getUpazilasForDistrict(divisionName: string, districtName: string): BdUpazila[] {
  const districts = getDistrictsForDivision(divisionName);
  const dist = districts.find((d) => d.name === districtName);
  return dist ? dist.upazilas : [];
}

export function getAreasForUpazila(
  divisionName: string,
  districtName: string,
  upazilaName: string,
): BdArea[] {
  const upazilas = getUpazilasForDistrict(divisionName, districtName);
  const upa = upazilas.find((u) => u.name === upazilaName);
  return upa ? upa.areas : [];
}

export function validateBangladeshAddressHierarchy(input: {
  division: string;
  district: string;
  upazila: string;
  area: string;
}): { valid: boolean; reason?: string } {
  const div = BD_DIVISIONS.find((d) => d.name === input.division);
  if (!div) {
    return { valid: false, reason: `Unknown division: ${input.division}` };
  }
  const dist = div.districts.find((d) => d.name === input.district);
  if (!dist) {
    return { valid: false, reason: `District "${input.district}" does not belong to ${input.division}` };
  }
  const upa = dist.upazilas.find((u) => u.name === input.upazila);
  if (!upa) {
    return { valid: false, reason: `Upazila/Thana "${input.upazila}" does not belong to ${input.district}` };
  }
  const area = upa.areas.find((a) => a.name === input.area);
  if (!area) {
    return { valid: false, reason: `Area/Union "${input.area}" does not belong to ${input.upazila}` };
  }
  return { valid: true };
}

export interface ShippingConfig {
  dhakaMetroCharge: number;
  dhakaSuburbCharge: number;
  nationwideCharge: number;
  freeShippingThreshold: number;
  expressSurcharge: number;
}

export interface DeliveryZoneConfig {
  name: string;
  divisions: string[];
  charge: number;
  freeAbove: number;
  estimatedDays: string;
  isActive: boolean;
}

export const DEFAULT_SHIPPING_CONFIG: ShippingConfig = {
  dhakaMetroCharge: 60,
  dhakaSuburbCharge: 90,
  nationwideCharge: 120,
  freeShippingThreshold: 999,
  expressSurcharge: 80,
};

export function calculateShippingCharge(params: {
  division: string;
  district: string;
  upazila: string;
  subtotal: number;
  deliveryMethod?: 'standard' | 'express';
  config?: Partial<ShippingConfig>;
  deliveryZones?: DeliveryZoneConfig[];
}): {
  charge: number;
  freeShippingApplied: boolean;
  zone: 'dhaka_metro' | 'dhaka_suburb' | 'nationwide';
  zoneName?: string;
  estimatedDays: string;
} {
  const cfg: ShippingConfig = { ...DEFAULT_SHIPPING_CONFIG, ...params.config };
  const isDhakaDistrict = params.division === 'Dhaka' && params.district === 'Dhaka';
  const isSavar = isDhakaDistrict && params.upazila === 'Savar';

  let zone: 'dhaka_metro' | 'dhaka_suburb' | 'nationwide' = 'nationwide';
  let baseCharge = cfg.nationwideCharge;
  let estimatedDays = '3-5 business days';
  let effectiveThreshold = cfg.freeShippingThreshold;
  let zoneName: string | undefined;

  if (isDhakaDistrict && !isSavar) {
    zone = 'dhaka_metro';
    baseCharge = cfg.dhakaMetroCharge;
    estimatedDays = '1-2 business days';
  } else if (isSavar || (params.division === 'Dhaka' && (params.district === 'Gazipur' || params.district === 'Narayanganj'))) {
    zone = 'dhaka_suburb';
    baseCharge = cfg.dhakaSuburbCharge;
    estimatedDays = '2-3 business days';
  }

  const normalizedDivision = params.division.trim().toLowerCase();
  const matchedZone = (params.deliveryZones || []).find(
    (z) =>
      z &&
      z.isActive !== false &&
      Array.isArray(z.divisions) &&
      z.divisions.some((d) => {
        const clean = d.trim().toLowerCase();
        return clean === normalizedDivision || clean === 'all';
      }),
  );

  if (matchedZone) {
    baseCharge = Math.max(0, Number(matchedZone.charge) || 0);
    if (matchedZone.estimatedDays?.trim()) {
      estimatedDays = matchedZone.estimatedDays.trim();
    }
    if (Number(matchedZone.freeAbove) > 0) {
      effectiveThreshold = Number(matchedZone.freeAbove);
    }
    if (matchedZone.name?.trim()) {
      zoneName = matchedZone.name.trim();
    }
  }

  const freeShippingApplied = effectiveThreshold > 0 && params.subtotal >= effectiveThreshold;
  let charge = freeShippingApplied ? 0 : baseCharge;

  if (params.deliveryMethod === 'express') {
    charge += cfg.expressSurcharge;
    estimatedDays = zone === 'dhaka_metro' ? 'Same day / Next day' : '1-2 business days';
  }

  return {
    charge,
    freeShippingApplied,
    zone,
    ...(zoneName ? { zoneName } : {}),
    estimatedDays,
  };
}
