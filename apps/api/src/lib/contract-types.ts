export const CONTRACT_TYPES = {
  FULLTIME:  { label: "Vollzeit",   hoursPerDay: 8.0,  hoursPerWeek: 40.0, vacationDays: 28 },
  PARTTIME:  { label: "Teilzeit",   hoursPerDay: 4.0,  hoursPerWeek: 20.0, vacationDays: 14 },
  MINIJOB:   { label: "Minijob",    hoursPerDay: 2.0,  hoursPerWeek: 10.0, vacationDays: 10 },
  INTERN:    { label: "Praktikant", hoursPerDay: 8.0,  hoursPerWeek: 40.0, vacationDays: 10 },
  FREELANCE: { label: "Freelancer", hoursPerDay: 8.0,  hoursPerWeek: 40.0, vacationDays: 0  },
} as const;
export type ContractType = keyof typeof CONTRACT_TYPES;
