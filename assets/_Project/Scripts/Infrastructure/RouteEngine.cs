using System;
using System.Collections.Generic;
using System.Linq;
using UnityEngine;

namespace KeralaRailTwin.Infrastructure
{
    public class StationInfo
    {
        public string code;
        public string stationName;
        public float km;
        public bool isMandatoryStop;
        public int platforms;
        public string category;
        public int dwellTimeSec;
    }

    public class SpeedLimitZone
    {
        public float startKm;
        public float endKm;
        public float speedKmh;
        public string reason;
    }

    public class GradientInfo
    {
        public float slope;
        public string label = "LEVEL";
        public float GradeResistancePerMille => slope * 1000f;
    }

    internal class GradientZone
    {
        public float startKm;
        public float endKm;
        public float slope;
        public string label;
    }

    public class CurveInfo
    {
        public float startKm;
        public float endKm;
        public float radiusMetres;
        public string direction;
        public float speedRestrictionKmh;
        public string curveName;
    }

    public class BridgeInfo
    {
        public string bridgeName;
        public float startKm;
        public float lengthKm;
        public float EndKm => startKm + lengthKm;
        public string bridgeType; // WATER or VIADUCT
        public int spans;
        public float speedRestrictionKmh;
    }

    public class RouteAheadReport
    {
        public float currentKm;
        public float lookAheadKm;
        public StationInfo nextStation;
        public float? distanceToNextStationKm;
        public List<BridgeInfo> bridgesAhead = new List<BridgeInfo>();
        public List<CurveInfo> curvesAhead = new List<CurveInfo>();
        public List<SpeedLimitZone> speedChangesAhead = new List<SpeedLimitZone>();
        public float currentSpeedLimitKmh;
        public float minSpeedLimitAheadKmh;
        public bool isOnBridge;
        public bool isInStationLimits;
    }

    public class RouteEngine : MonoBehaviour
    {
        public static RouteEngine Instance { get; private set; }

        private const float ROUTE_LENGTH_KM = 64.6f;
        private const float STATION_LIMITS_RADIUS_KM = 0.5f;

        private List<StationInfo> stations = new List<StationInfo>();
        private List<SpeedLimitZone> speedLimitZones = new List<SpeedLimitZone>();
        private List<GradientZone> gradientZones = new List<GradientZone>();
        private List<CurveInfo> curveZones = new List<CurveInfo>();
        private List<BridgeInfo> bridgeZones = new List<BridgeInfo>();

        private void Awake()
        {
            if (Instance == null)
            {
                Instance = this;
                DontDestroyOnLoad(gameObject);
                InitializeRouteData();
            }
            else
            {
                Destroy(gameObject);
            }
        }

        private void InitializeRouteData()
        {
            // 18 Stations ordered from Kollam to TVC Central
            stations = new List<StationInfo>
            {
                new StationInfo { code = "QLN", stationName = "Kollam Junction", km = 0.0f, isMandatoryStop = true, platforms = 5, category = "A1", dwellTimeSec = 300 },
                new StationInfo { code = "IRP", stationName = "Iravipuram", km = 4.6f, isMandatoryStop = false, platforms = 2, category = "HG-2", dwellTimeSec = 0 },
                new StationInfo { code = "MYY", stationName = "Mayyanad", km = 8.9f, isMandatoryStop = false, platforms = 2, category = "NSG-6", dwellTimeSec = 0 },
                new StationInfo { code = "PVU", stationName = "Paravur", km = 12.4f, isMandatoryStop = false, platforms = 2, category = "NSG-5", dwellTimeSec = 0 },
                new StationInfo { code = "KFI", stationName = "Kappil", km = 17.0f, isMandatoryStop = false, platforms = 2, category = "HG-3", dwellTimeSec = 0 },
                new StationInfo { code = "EVA", stationName = "Edavai", km = 19.9f, isMandatoryStop = false, platforms = 2, category = "NSG-6", dwellTimeSec = 0 },
                new StationInfo { code = "VAK", stationName = "Varkala Sivagiri", km = 23.7f, isMandatoryStop = true, platforms = 3, category = "NSG-4", dwellTimeSec = 120 },
                new StationInfo { code = "AKI", stationName = "Akathumuri", km = 30.1f, isMandatoryStop = false, platforms = 2, category = "HG-3", dwellTimeSec = 0 },
                new StationInfo { code = "KVU", stationName = "Kadakkavur", km = 32.8f, isMandatoryStop = false, platforms = 2, category = "NSG-6", dwellTimeSec = 0 },
                new StationInfo { code = "CRY", stationName = "Chirayinkeezhu", km = 35.9f, isMandatoryStop = false, platforms = 2, category = "NSG-5", dwellTimeSec = 0 },
                new StationInfo { code = "PGZ", stationName = "Perunguzhi", km = 40.0f, isMandatoryStop = false, platforms = 2, category = "HG-2", dwellTimeSec = 0 },
                new StationInfo { code = "MQU", stationName = "Murukkampuzha", km = 43.2f, isMandatoryStop = false, platforms = 2, category = "NSG-6", dwellTimeSec = 0 },
                new StationInfo { code = "KPY", stationName = "Kaniyapuram", km = 47.2f, isMandatoryStop = false, platforms = 2, category = "HG-2", dwellTimeSec = 0 },
                new StationInfo { code = "KZK", stationName = "Kazhakkuttam", km = 51.3f, isMandatoryStop = false, platforms = 3, category = "NSG-5", dwellTimeSec = 0 },
                new StationInfo { code = "VELI", stationName = "Veli", km = 55.3f, isMandatoryStop = false, platforms = 2, category = "HG-2", dwellTimeSec = 0 },
                new StationInfo { code = "TVCN", stationName = "Thiruvananthapuram North", km = 57.5f, isMandatoryStop = false, platforms = 4, category = "NSG-3", dwellTimeSec = 180 },
                new StationInfo { code = "PET", stationName = "TVM Pettah", km = 62.1f, isMandatoryStop = false, platforms = 2, category = "NSG-6", dwellTimeSec = 0 },
                new StationInfo { code = "TVC", stationName = "Trivandrum Central", km = 64.6f, isMandatoryStop = true, platforms = 5, category = "NSG-2", dwellTimeSec = 300 }
            };

            // Speed Limit Zones
            speedLimitZones = new List<SpeedLimitZone>
            {
                new SpeedLimitZone { startKm = 0.0f, endKm = 0.3f, speedKmh = 15f, reason = "Turnout – Kollam Jct yard exit" },
                new SpeedLimitZone { startKm = 0.3f, endKm = 0.8f, speedKmh = 50f, reason = "Kollam Jct station limits" },
                new SpeedLimitZone { startKm = 0.8f, endKm = 2.0f, speedKmh = 75f, reason = "Caution zone – Kollam approach" },
                new SpeedLimitZone { startKm = 2.0f, endKm = 2.1f, speedKmh = 110f, reason = "Open main line" },
                new SpeedLimitZone { startKm = 2.1f, endKm = 3.5f, speedKmh = 30f, reason = "Speed Board 30 km/h restriction" },
                new SpeedLimitZone { startKm = 3.5f, endKm = 4.3f, speedKmh = 110f, reason = "Open main line" },
                new SpeedLimitZone { startKm = 4.3f, endKm = 4.8f, speedKmh = 75f, reason = "Turnout curve near Eravipuram" },
                new SpeedLimitZone { startKm = 4.8f, endKm = 7.5f, speedKmh = 110f, reason = "Open main line" },
                new SpeedLimitZone { startKm = 7.5f, endKm = 9.5f, speedKmh = 50f, reason = "Speed Board 50 km/h restriction" },
                new SpeedLimitZone { startKm = 9.5f, endKm = 10.4f, speedKmh = 110f, reason = "Open main line" },
                new SpeedLimitZone { startKm = 10.4f, endKm = 12.3f, speedKmh = 75f, reason = "Paravur Lake Bridge crossing" },
                new SpeedLimitZone { startKm = 12.3f, endKm = 12.8f, speedKmh = 50f, reason = "Paravur station limits" },
                new SpeedLimitZone { startKm = 12.8f, endKm = 16.5f, speedKmh = 110f, reason = "Open main line" },
                new SpeedLimitZone { startKm = 16.5f, endKm = 17.5f, speedKmh = 75f, reason = "Kappil station approach" },
                new SpeedLimitZone { startKm = 17.5f, endKm = 18.5f, speedKmh = 110f, reason = "Open main line" },
                new SpeedLimitZone { startKm = 18.5f, endKm = 20.5f, speedKmh = 30f, reason = "Speed Board 30 km/h restriction" },
                new SpeedLimitZone { startKm = 20.5f, endKm = 22.5f, speedKmh = 110f, reason = "Open main line" },
                new SpeedLimitZone { startKm = 22.5f, endKm = 23.5f, speedKmh = 75f, reason = "Approach caution – Varkala" },
                new SpeedLimitZone { startKm = 23.5f, endKm = 24.0f, speedKmh = 50f, reason = "Varkala Sivagiri station limits" },
                new SpeedLimitZone { startKm = 24.0f, endKm = 27.5f, speedKmh = 110f, reason = "Open main line" },
                new SpeedLimitZone { startKm = 27.5f, endKm = 28.8f, speedKmh = 75f, reason = "Akathumuri Bridge and curve" },
                new SpeedLimitZone { startKm = 28.8f, endKm = 29.3f, speedKmh = 110f, reason = "Open main line" },
                new SpeedLimitZone { startKm = 29.3f, endKm = 31.0f, speedKmh = 50f, reason = "Speed Board 50 km/h restriction" },
                new SpeedLimitZone { startKm = 31.0f, endKm = 32.3f, speedKmh = 110f, reason = "Open main line" },
                new SpeedLimitZone { startKm = 32.3f, endKm = 33.2f, speedKmh = 50f, reason = "Kadakkavur station limits" },
                new SpeedLimitZone { startKm = 33.2f, endKm = 35.4f, speedKmh = 110f, reason = "Open main line" },
                new SpeedLimitZone { startKm = 35.4f, endKm = 36.4f, speedKmh = 50f, reason = "Chirayinkeezhu station limits" },
                new SpeedLimitZone { startKm = 36.4f, endKm = 39.5f, speedKmh = 110f, reason = "Open main line" },
                new SpeedLimitZone { startKm = 39.5f, endKm = 40.5f, speedKmh = 50f, reason = "Perunguzhi station limits" },
                new SpeedLimitZone { startKm = 40.5f, endKm = 41.5f, speedKmh = 110f, reason = "Open main line" },
                new SpeedLimitZone { startKm = 41.5f, endKm = 42.6f, speedKmh = 75f, reason = "Murukkampuzha Bridge and approach" },
                new SpeedLimitZone { startKm = 42.6f, endKm = 43.6f, speedKmh = 50f, reason = "Murukkampuzha station limits" },
                new SpeedLimitZone { startKm = 43.6f, endKm = 44.5f, speedKmh = 110f, reason = "Open main line" },
                new SpeedLimitZone { startKm = 44.5f, endKm = 46.5f, speedKmh = 30f, reason = "Speed Board 30 km/h restriction" },
                new SpeedLimitZone { startKm = 46.5f, endKm = 46.8f, speedKmh = 110f, reason = "Open main line" },
                new SpeedLimitZone { startKm = 46.8f, endKm = 47.6f, speedKmh = 50f, reason = "Kaniyapuram station limits" },
                new SpeedLimitZone { startKm = 47.6f, endKm = 50.8f, speedKmh = 110f, reason = "Open main line" },
                new SpeedLimitZone { startKm = 50.8f, endKm = 51.8f, speedKmh = 50f, reason = "Kazhakkuttam station limits" },
                new SpeedLimitZone { startKm = 51.8f, endKm = 54.8f, speedKmh = 110f, reason = "Open main line" },
                new SpeedLimitZone { startKm = 54.8f, endKm = 56.8f, speedKmh = 75f, reason = "Veli Creek Bridge and Veli station" },
                new SpeedLimitZone { startKm = 56.8f, endKm = 58.0f, speedKmh = 50f, reason = "Thiruvananthapuram North yard limits" },
                new SpeedLimitZone { startKm = 58.0f, endKm = 61.6f, speedKmh = 110f, reason = "Open main line" },
                new SpeedLimitZone { startKm = 61.6f, endKm = 62.6f, speedKmh = 50f, reason = "TVM Pettah station limits" },
                new SpeedLimitZone { startKm = 62.6f, endKm = 63.8f, speedKmh = 75f, reason = "Approach caution – TVC Central" },
                new SpeedLimitZone { startKm = 63.8f, endKm = 64.3f, speedKmh = 30f, reason = "Turnout – TVC yard entrance" },
                new SpeedLimitZone { startKm = 64.3f, endKm = 64.6f, speedKmh = 15f, reason = "Trivandrum Central terminal limits" }
            };

            // Gradient Zones
            gradientZones = new List<GradientZone>
            {
                new GradientZone { startKm = 12.0f, endKm = 15.0f, slope = 0.0067f, label = "UP 1:150" },
                new GradientZone { startKm = 18.0f, endKm = 22.0f, slope = -0.0050f, label = "DN 1:200" },
                new GradientZone { startKm = 22.0f, endKm = 25.0f, slope = 0.0100f, label = "UP 1:100" },
                new GradientZone { startKm = 30.0f, endKm = 35.0f, slope = -0.0067f, label = "DN 1:150" },
                new GradientZone { startKm = 35.0f, endKm = 45.0f, slope = 0.0040f, label = "UP 1:250" },
                new GradientZone { startKm = 52.0f, endKm = 58.0f, slope = -0.0083f, label = "DN 1:120" }
            };

            // Curve Zones
            curveZones = new List<CurveInfo>
            {
                new CurveInfo { startKm = 2.1f, endKm = 3.5f, radiusMetres = 50f, direction = "RIGHT", speedRestrictionKmh = CalcCurveSpeed(50f), curveName = "Kollam South curve" },
                new CurveInfo { startKm = 7.5f, endKm = 9.5f, radiusMetres = 150f, direction = "LEFT", speedRestrictionKmh = CalcCurveSpeed(150f), curveName = "Iravipuram approach curve" },
                new CurveInfo { startKm = 18.5f, endKm = 20.5f, radiusMetres = 50f, direction = "RIGHT", speedRestrictionKmh = CalcCurveSpeed(50f), curveName = "Edavai curve" },
                new CurveInfo { startKm = 29.3f, endKm = 31.0f, radiusMetres = 150f, direction = "LEFT", speedRestrictionKmh = CalcCurveSpeed(150f), curveName = "Akathumuri approach curve" },
                new CurveInfo { startKm = 44.5f, endKm = 46.5f, radiusMetres = 50f, direction = "RIGHT", speedRestrictionKmh = CalcCurveSpeed(50f), curveName = "Kaniyapuram curve" }
            };

            // Bridge Zones
            bridgeZones = new List<BridgeInfo>
            {
                new BridgeInfo { bridgeName = "Paravur Lake Bridge", startKm = 10.5f, lengthKm = 1.8f, bridgeType = "WATER", spans = 24, speedRestrictionKmh = 75f },
                new BridgeInfo { bridgeName = "Akathumuri Bridge", startKm = 28.0f, lengthKm = 0.8f, bridgeType = "WATER", spans = 10, speedRestrictionKmh = 75f },
                new BridgeInfo { bridgeName = "Murukkampuzha Bridge", startKm = 42.0f, lengthKm = 0.6f, bridgeType = "WATER", spans = 8, speedRestrictionKmh = 75f },
                new BridgeInfo { bridgeName = "Veli Creek Bridge", startKm = 56.5f, lengthKm = 0.5f, bridgeType = "WATER", spans = 6, speedRestrictionKmh = 75f }
            };
        }

        private float CalcCurveSpeed(float radiusMetres)
        {
            float raw = 4.35f * Mathf.Sqrt(radiusMetres);
            float floored = Mathf.Floor(raw / 5.0f) * 5.0f;
            return Mathf.Min(floored, 110.0f);
        }

        public float GetSpeedLimitAt(float km)
        {
            float minSpeed = 110.0f;
            foreach (var zone in speedLimitZones)
            {
                if (km >= zone.startKm && km <= zone.endKm)
                {
                    if (zone.speedKmh < minSpeed)
                        minSpeed = zone.speedKmh;
                }
            }
            return minSpeed;
        }

        public GradientInfo GetGradientAt(float km)
        {
            foreach (var zone in gradientZones)
            {
                if (km >= zone.startKm && km < zone.endKm)
                    return new GradientInfo { slope = zone.slope, label = zone.label };
            }
            return new GradientInfo { slope = 0.0f, label = "LEVEL" };
        }

        public List<BridgeInfo> GetBridgesInRange(float startKm, float endKm)
        {
            return bridgeZones.Where(b => b.startKm < endKm && b.EndKm > startKm).ToList();
        }

        public StationInfo GetNextStation(float currentKm)
        {
            return stations.Where(s => s.km > currentKm).OrderBy(s => s.km).FirstOrDefault();
        }

        public StationInfo GetStationNear(float km, float tolerance = 0.5f)
        {
            return stations.FirstOrDefault(s => Mathf.Abs(s.km - km) <= tolerance);
        }
    }
}
