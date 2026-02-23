/**
 * Australian DV Legislation Seed Data
 *
 * Covers all states/territories and federal family law legislation
 * relevant to domestic violence protection and evidence gathering.
 */

import { Legislation } from '../types';

export const LEGISLATION_SEED_DATA: Omit<Legislation, 'createdAt' | 'updatedAt'>[] = [
  // ---- FEDERAL ----
  {
    id: 'fed-family-law-act',
    jurisdiction: 'Federal',
    title: 'Family Law Act 1975 (Cth)',
    shortTitle: 'Family Law Act',
    category: 'family_law',
    description: 'Primary federal legislation governing family law matters including parenting orders, property settlement, divorce, and family violence considerations in parenting proceedings.',
    url: 'https://www.legislation.gov.au/Details/C2024C00223',
    lastAmended: '2024-06',
    keyProvisions: JSON.stringify([
      'Part VII - Children (s60B-s70Q): Parenting orders, best interests of the child',
      'Division 11 - Family violence (s4AB): Definition of family violence',
      's60CC: Best interests factors including family violence',
      's60CG: Court must consider family violence orders',
      's67ZBA: Power to make location/recovery orders',
    ]),
    lastChecked: '2025-01-15',
  },
  {
    id: 'fed-family-violence-act',
    jurisdiction: 'Federal',
    title: 'Family Law Amendment (Federal Family Violence Orders) Act 2021 (Cth)',
    shortTitle: 'Federal FVO Act',
    category: 'dv_protection',
    description: 'Enables the Federal Circuit and Family Court to make family violence orders to protect parties and children in family law proceedings.',
    url: 'https://www.legislation.gov.au/Details/C2021A00167',
    lastAmended: '2021-12',
    keyProvisions: JSON.stringify([
      'Part XIIIAB: Federal family violence orders',
      'Power to make orders protecting parties and children',
      'Interaction with state/territory DV protection orders',
    ]),
    lastChecked: '2025-01-15',
  },
  {
    id: 'fed-child-support',
    jurisdiction: 'Federal',
    title: 'Child Support (Assessment) Act 1989 (Cth)',
    shortTitle: 'Child Support Act',
    category: 'family_law',
    description: 'Governs child support assessments, including provisions relevant when family violence impacts financial arrangements.',
    url: 'https://www.legislation.gov.au/Details/C2024C00077',
    lastAmended: '2024-03',
    keyProvisions: JSON.stringify([
      'Part 5: Administrative assessment of child support',
      'Part 6A: Departure from assessment in special circumstances',
      's117: Reason 9 - financial circumstances affected by violence',
    ]),
    lastChecked: '2025-01-15',
  },

  // ---- NEW SOUTH WALES ----
  {
    id: 'nsw-crimes-dv',
    jurisdiction: 'NSW',
    title: 'Crimes (Domestic and Personal Violence) Act 2007 (NSW)',
    shortTitle: 'NSW DV Act',
    category: 'dv_protection',
    description: 'Primary NSW legislation for apprehended domestic violence orders (ADVOs) and apprehended personal violence orders (APVOs). Defines domestic violence offences and protection order framework.',
    url: 'https://legislation.nsw.gov.au/view/html/inforce/current/act-2007-080',
    lastAmended: '2024-07',
    keyProvisions: JSON.stringify([
      'Part 4: Apprehended domestic violence orders (ADVOs)',
      'Part 5: Apprehended personal violence orders (APVOs)',
      's14: Making of interim orders',
      'ss36-38: Conditions of orders including exclusion from premises',
      's49: Stalking or intimidation offence',
      'ss13-14: Standard conditions (must not assault, threaten, stalk, harass, intimidate)',
    ]),
    lastChecked: '2025-01-15',
  },
  {
    id: 'nsw-crimes-act',
    jurisdiction: 'NSW',
    title: 'Crimes Act 1900 (NSW) - Part 3 Div 10',
    shortTitle: 'NSW Crimes Act (DV)',
    category: 'criminal',
    description: 'Criminal offences relevant to domestic violence including assault, sexual assault, stalking, and coercive control provisions.',
    url: 'https://legislation.nsw.gov.au/view/html/inforce/current/act-1900-040',
    lastAmended: '2024-07',
    keyProvisions: JSON.stringify([
      's54D: Coercive control offence (commenced 1 July 2024)',
      'ss59-61: Assault offences',
      'ss61I-61JA: Sexual assault offences',
      's13: Strangulation offence',
    ]),
    lastChecked: '2025-01-15',
  },
  {
    id: 'nsw-child-protection',
    jurisdiction: 'NSW',
    title: 'Children and Young Persons (Care and Protection) Act 1998 (NSW)',
    shortTitle: 'NSW Child Protection Act',
    category: 'child_protection',
    description: 'Governs child protection in NSW including mandatory reporting of children at risk of significant harm, relevant in DV contexts.',
    url: 'https://legislation.nsw.gov.au/view/html/inforce/current/act-1998-157',
    lastAmended: '2024-06',
    keyProvisions: JSON.stringify([
      's23: Mandatory reporters must report risk of significant harm',
      's24: Exposure to domestic violence as risk factor',
      'Part 2: Principles for child protection',
    ]),
    lastChecked: '2025-01-15',
  },

  // ---- VICTORIA ----
  {
    id: 'vic-fv-act',
    jurisdiction: 'VIC',
    title: 'Family Violence Protection Act 2008 (Vic)',
    shortTitle: 'Vic FV Act',
    category: 'dv_protection',
    description: 'Primary Victorian legislation for family violence intervention orders (FVIOs). Broad definition of family violence including economic abuse and coercive control.',
    url: 'https://www.legislation.vic.gov.au/in-force/acts/family-violence-protection-act-2008',
    lastAmended: '2024-07',
    keyProvisions: JSON.stringify([
      's5: Definition of family violence (includes economic abuse, emotional/psychological abuse, coercive behaviour)',
      'Part 4: Family violence intervention orders',
      'Part 5: Family violence safety notices (police-issued)',
      'ss81-82: Breach of intervention order offence',
      's77: Conditions available for orders',
    ]),
    lastChecked: '2025-01-15',
  },
  {
    id: 'vic-fv-amendment',
    jurisdiction: 'VIC',
    title: 'Justice Legislation Amendment (Family Violence Protection and Other Matters) Act 2024 (Vic)',
    shortTitle: 'Vic FV Amendment 2024',
    category: 'dv_protection',
    description: 'Implements recommendations from the Royal Commission into Family Violence, strengthening protections and court processes.',
    url: 'https://www.legislation.vic.gov.au/in-force/acts/justice-legislation-amendment-family-violence-protection-and-other-matters-act-2024',
    lastAmended: '2024-06',
    keyProvisions: JSON.stringify([
      'Strengthened FVIO processes',
      'Enhanced information sharing between agencies',
      'Improved risk assessment framework',
    ]),
    lastChecked: '2025-01-15',
  },
  {
    id: 'vic-child-wellbeing',
    jurisdiction: 'VIC',
    title: 'Children, Youth and Families Act 2005 (Vic)',
    shortTitle: 'Vic CYF Act',
    category: 'child_protection',
    description: 'Victoria\'s child protection legislation with provisions for children exposed to family violence.',
    url: 'https://www.legislation.vic.gov.au/in-force/acts/children-youth-and-families-act-2005',
    lastAmended: '2024-03',
    keyProvisions: JSON.stringify([
      's162: Mandatory reporting by specified professionals',
      'Family violence as a factor in assessing risk',
      'Information sharing provisions between agencies',
    ]),
    lastChecked: '2025-01-15',
  },

  // ---- QUEENSLAND ----
  {
    id: 'qld-dv-act',
    jurisdiction: 'QLD',
    title: 'Domestic and Family Violence Protection Act 2012 (Qld)',
    shortTitle: 'Qld DFV Act',
    category: 'dv_protection',
    description: 'Primary Queensland legislation for domestic violence protection orders. Defines domestic violence broadly including coercive control, economic abuse, and technology-facilitated abuse.',
    url: 'https://www.legislation.qld.gov.au/view/html/inforce/current/act-2012-005',
    lastAmended: '2024-10',
    keyProvisions: JSON.stringify([
      's8: Meaning of domestic violence (includes coercive behaviour)',
      'Part 3: Domestic violence orders',
      'Part 3A: Police protection notices',
      's177: Breach of domestic violence order - criminal offence',
      'ss43-56: Conditions that may be imposed',
    ]),
    lastChecked: '2025-01-15',
  },
  {
    id: 'qld-coercive-control',
    jurisdiction: 'QLD',
    title: 'Criminal Code (Coercive Control) and Other Legislation Amendment Act 2023 (Qld)',
    shortTitle: 'Qld Coercive Control Act',
    category: 'criminal',
    description: 'Criminalises coercive control in domestic relationships in Queensland. Commenced in stages from 2024.',
    url: 'https://www.legislation.qld.gov.au/view/html/asmade/act-2023-020',
    lastAmended: '2023-06',
    keyProvisions: JSON.stringify([
      's334C: Coercive control offence (max 14 years)',
      'Pattern of behaviour that is abusive towards a partner',
      'Includes financial, emotional, psychological, technological abuse',
    ]),
    lastChecked: '2025-01-15',
  },
  {
    id: 'qld-child-protection',
    jurisdiction: 'QLD',
    title: 'Child Protection Act 1999 (Qld)',
    shortTitle: 'Qld Child Protection Act',
    category: 'child_protection',
    description: 'Queensland child protection legislation with mandatory reporting provisions relevant to DV contexts.',
    url: 'https://www.legislation.qld.gov.au/view/html/inforce/current/act-1999-010',
    lastAmended: '2024-06',
    keyProvisions: JSON.stringify([
      's13E: Mandatory reporting by specified professionals',
      'Family violence as a factor in assessing harm to children',
    ]),
    lastChecked: '2025-01-15',
  },

  // ---- WESTERN AUSTRALIA ----
  {
    id: 'wa-rv-act',
    jurisdiction: 'WA',
    title: 'Restraining Orders Act 1997 (WA)',
    shortTitle: 'WA Restraining Orders Act',
    category: 'dv_protection',
    description: 'Primary Western Australian legislation for family violence restraining orders (FVROs) and violence restraining orders (VROs).',
    url: 'https://www.legislation.wa.gov.au/legislation/statutes.nsf/main_mrtitle_821_homepage.html',
    lastAmended: '2024-07',
    keyProvisions: JSON.stringify([
      'Part 1B: Family violence restraining orders (FVROs)',
      'Part 2: Violence restraining orders (VROs)',
      's61A: Breach of FVRO - criminal offence',
      's49: Police orders (72-hour interim protection)',
      'ss10A-10F: Conditions of FVROs',
    ]),
    lastChecked: '2025-01-15',
  },
  {
    id: 'wa-fv-act',
    jurisdiction: 'WA',
    title: 'Family Violence Legislation Reform Act 2020 (WA)',
    shortTitle: 'WA FV Reform Act',
    category: 'dv_protection',
    description: 'Comprehensive reform of WA family violence laws, broadening definitions and strengthening protections.',
    url: 'https://www.legislation.wa.gov.au/legislation/statutes.nsf/main_mrtitle_13738_homepage.html',
    lastAmended: '2020-08',
    keyProvisions: JSON.stringify([
      'Broadened definition of family violence',
      'Includes economic abuse, technology-facilitated abuse',
      'Enhanced serial family violence offence provisions',
    ]),
    lastChecked: '2025-01-15',
  },
  {
    id: 'wa-child-protection',
    jurisdiction: 'WA',
    title: 'Children and Community Services Act 2004 (WA)',
    shortTitle: 'WA Children Act',
    category: 'child_protection',
    description: 'WA child protection legislation with provisions for children exposed to family violence.',
    url: 'https://www.legislation.wa.gov.au/legislation/statutes.nsf/main_mrtitle_132_homepage.html',
    lastAmended: '2024-01',
    keyProvisions: JSON.stringify([
      's124B: Mandatory reporting of child sexual abuse',
      'Family violence exposure as risk factor',
    ]),
    lastChecked: '2025-01-15',
  },

  // ---- SOUTH AUSTRALIA ----
  {
    id: 'sa-iv-act',
    jurisdiction: 'SA',
    title: 'Intervention Orders (Prevention of Abuse) Act 2009 (SA)',
    shortTitle: 'SA Intervention Orders Act',
    category: 'dv_protection',
    description: 'Primary South Australian legislation for domestic violence intervention orders, with broad definition of abuse including emotional and economic abuse.',
    url: 'https://www.legislation.sa.gov.au/lz?path=%2FC%2FA%2FIntervention%20Orders%20(Prevention%20of%20Abuse)%20Act%202009',
    lastAmended: '2024-06',
    keyProvisions: JSON.stringify([
      's8: Definition of abuse (physical, sexual, emotional, economic)',
      'Part 2: Interim intervention orders (police-issued)',
      'Part 3: Intervention orders (court-issued)',
      's31: Breach of intervention order - criminal offence',
      'ss12-13: Conditions that may be imposed',
    ]),
    lastChecked: '2025-01-15',
  },
  {
    id: 'sa-criminal-strang',
    jurisdiction: 'SA',
    title: 'Criminal Law Consolidation Act 1935 (SA) - s20A',
    shortTitle: 'SA Strangulation Offence',
    category: 'criminal',
    description: 'Standalone strangulation offence in SA, a key indicator of escalating family violence lethality risk.',
    url: 'https://www.legislation.sa.gov.au/lz?path=%2FC%2FA%2FCriminal%20Law%20Consolidation%20Act%201935',
    lastAmended: '2024-03',
    keyProvisions: JSON.stringify([
      's20A: Choking, suffocation or strangulation in a domestic setting',
      'Maximum penalty: 15 years imprisonment',
    ]),
    lastChecked: '2025-01-15',
  },

  // ---- TASMANIA ----
  {
    id: 'tas-fv-act',
    jurisdiction: 'TAS',
    title: 'Family Violence Act 2004 (Tas)',
    shortTitle: 'Tas FV Act',
    category: 'dv_protection',
    description: 'Primary Tasmanian legislation for family violence orders. Tasmania was the first Australian state to introduce specific family violence legislation with an economic abuse definition.',
    url: 'https://www.legislation.tas.gov.au/view/html/inforce/current/act-2004-067',
    lastAmended: '2024-06',
    keyProvisions: JSON.stringify([
      's4: Definition of family violence',
      'Part 3: Family violence orders (FVOs)',
      'Part 4: Police family violence orders (PFVOs)',
      's35: Breach of FVO - criminal offence',
      'ss16-17: Conditions of orders',
    ]),
    lastChecked: '2025-01-15',
  },
  {
    id: 'tas-child-young',
    jurisdiction: 'TAS',
    title: 'Children, Young Persons and Their Families Act 1997 (Tas)',
    shortTitle: 'Tas Child Protection Act',
    category: 'child_protection',
    description: 'Tasmanian child protection legislation with mandatory reporting provisions relevant to family violence.',
    url: 'https://www.legislation.tas.gov.au/view/html/inforce/current/act-1997-028',
    lastAmended: '2024-01',
    keyProvisions: JSON.stringify([
      'ss3-4: Mandatory reporters (broad range of professionals)',
      'Family violence exposure as risk of harm',
    ]),
    lastChecked: '2025-01-15',
  },

  // ---- ACT ----
  {
    id: 'act-fv-act',
    jurisdiction: 'ACT',
    title: 'Family Violence Act 2016 (ACT)',
    shortTitle: 'ACT FV Act',
    category: 'dv_protection',
    description: 'Primary ACT legislation for family violence orders. Includes broad definition of family violence with specific provisions for technology-facilitated abuse.',
    url: 'https://www.legislation.act.gov.au/a/2016-42',
    lastAmended: '2024-07',
    keyProvisions: JSON.stringify([
      's8: Meaning of family violence (broad, includes technology-facilitated abuse)',
      'Part 3: Family violence orders',
      'Part 5: Consent orders',
      's43: Breach of family violence order - criminal offence',
      'ss30-32: Conditions including exclusion, no-contact, surrender of weapons',
    ]),
    lastChecked: '2025-01-15',
  },
  {
    id: 'act-child-young',
    jurisdiction: 'ACT',
    title: 'Children and Young People Act 2008 (ACT)',
    shortTitle: 'ACT Child Protection Act',
    category: 'child_protection',
    description: 'ACT child and young people protection legislation with mandatory reporting for family violence contexts.',
    url: 'https://www.legislation.act.gov.au/a/2008-19',
    lastAmended: '2024-06',
    keyProvisions: JSON.stringify([
      'Part 6.1: Mandatory reporting by certain people',
      'Family violence as factor in assessing risk',
    ]),
    lastChecked: '2025-01-15',
  },

  // ---- NORTHERN TERRITORY ----
  {
    id: 'nt-dfv-act',
    jurisdiction: 'NT',
    title: 'Domestic and Family Violence Act 2007 (NT)',
    shortTitle: 'NT DFV Act',
    category: 'dv_protection',
    description: 'Primary Northern Territory legislation for domestic violence orders (DVOs). Includes specific provisions for Aboriginal and Torres Strait Islander communities.',
    url: 'https://legislation.nt.gov.au/Legislation/DOMESTIC-AND-FAMILY-VIOLENCE-ACT-2007',
    lastAmended: '2024-06',
    keyProvisions: JSON.stringify([
      's5: Meaning of domestic violence',
      'Part 2.2: Domestic violence orders (DVOs)',
      'Part 2.3: Police domestic violence orders',
      's120: Breach of DVO - criminal offence',
      'ss22-28: Conditions of orders',
      'Part 5: Special provisions for Aboriginal communities',
    ]),
    lastChecked: '2025-01-15',
  },
  {
    id: 'nt-care-protection',
    jurisdiction: 'NT',
    title: 'Care and Protection of Children Act 2007 (NT)',
    shortTitle: 'NT Child Protection Act',
    category: 'child_protection',
    description: 'NT child protection legislation. NT has the broadest mandatory reporting requirements — everyone is a mandatory reporter.',
    url: 'https://legislation.nt.gov.au/Legislation/CARE-AND-PROTECTION-OF-CHILDREN-ACT-2007',
    lastAmended: '2024-01',
    keyProvisions: JSON.stringify([
      's26: Universal mandatory reporting (every person must report)',
      'Exposure to domestic violence as harm/exploitation',
    ]),
    lastChecked: '2025-01-15',
  },
];

/**
 * Seeds the database with Australian DV legislation data.
 * Uses upsert so it's safe to call multiple times.
 */
export async function seedLegislationData(): Promise<void> {
  const { upsertLegislation } = await import('./legislationRepository');
  for (const item of LEGISLATION_SEED_DATA) {
    await upsertLegislation(item);
  }
}
