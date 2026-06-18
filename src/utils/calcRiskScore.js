export const calcRiskScore = (zone, hour) => {
  const timeFactor =
    hour >= 22 || hour < 6 ? 30 :
    hour >= 19              ? 15 : 0;

  const crowdMap = { busy: 0, moderate: 10, isolated: 25 };
  const infraMap = { full: 0, mixed: 10,    poor: 20     };

  const riskScore =
    (zone.crimeLevel           * 0.40) +
    (timeFactor                * 0.25) +
    (crowdMap[zone.crowdLevel] * 0.20) +
    (infraMap[zone.infraLevel] * 0.15);

  const finalRisk = Math.min(100, Math.round(riskScore));

  return {
    riskScore:   finalRisk,
    safetyScore: Math.max(0, 100 - finalRisk),
    riskLevel:   finalRisk >= 60 ? 'HIGH' :
                 finalRisk >= 35 ? 'MODERATE' : 'LOW',
    timeFactor,
    factors: {
      crime: Math.round(zone.crimeLevel                    * 0.40),
      time:  Math.round(timeFactor                         * 0.25),
      crowd: Math.round((crowdMap[zone.crowdLevel] ?? 10)  * 0.20),
      infra: Math.round((infraMap[zone.infraLevel] ?? 10)  * 0.15),
    },
  };
};
