using System;
using System.Collections.Generic;
using System.Linq;
using UnityEngine;

namespace KeralaRailTwin.AI
{
    public enum TrainDirection
    {
        DOWN, // Kollam (km 0) -> TVC (km 64.6)
        UP    // TVC (km 64.6) -> Kollam (km 0)
    }

    [System.Serializable]
    public class ServiceStop
    {
        public string stationCode = "";
        public int arrivalMin;
        public int departureMin;
        public float kmFromOrigin;
    }

    [System.Serializable]
    public class TrainService
    {
        public string serviceId = "";
        public string trainNo = "";
        public string name = "";
        public TrainDirection direction;
        public string locoType = "";
        public string rakeType = "";
        public int coachCount;
        public ServiceStop[] stops = Array.Empty<ServiceStop>();
        public int originDepartureClockMin;
    }

    [System.Serializable]
    public class ActiveTrain
    {
        public string serviceId = "";
        public string trainNo = "";
        public string name = "";
        public float positionKm;
        public float speedKmh;
        public string locoType = "";
        public string rakeType = "";
        public int coachCount;
        public TrainDirection direction;
    }

    [System.Serializable]
    public class MeetInfo
    {
        public string serviceId = "";
        public string trainNo = "";
        public string name = "";
        public float meetAtKm;
        public float meetInSeconds;
        public string meetAtStationCode = "";
    }

    [System.Serializable]
    public class SpawnInfo
    {
        public string serviceId = "";
        public string trainNo = "";
        public string name = "";
        public float spawnKm;
        public float speedKmh;
        public TrainDirection direction;
        public string locoType = "";
        public string rakeType = "";
        public int coachCount;
        public string reason = "";
    }

    public class AIScheduler : MonoBehaviour
    {
        public static AIScheduler Instance { get; private set; }

        private const float CorridorLengthKm = 64.6f;
        private const float ActiveWindowKm = 40.0f;
        private const float DefaultLineSpeedKmh = 90.0f;

        private static readonly Dictionary<string, float> StationKm = new Dictionary<string, float>
        {
            ["QLN"]  =  0.0f,
            ["IRP"]  =  4.6f,
            ["MYY"]  =  8.9f,
            ["PVU"]  = 12.4f,
            ["KFI"]  = 17.0f,
            ["EVA"]  = 19.9f,
            ["VAK"]  = 23.7f,
            ["AKI"]  = 30.1f,
            ["KVU"]  = 32.8f,
            ["CRY"]  = 35.9f,
            ["PGZ"]  = 40.0f,
            ["MQU"]  = 43.2f,
            ["KPY"]  = 47.2f,
            ["KZK"]  = 51.3f,
            ["VELI"] = 55.3f,
            ["TVCN"] = 57.5f,
            ["PET"]  = 62.1f,
            ["TVC"]  = 64.6f
        };

        private List<TrainService> services = new List<TrainService>();

        private void Awake()
        {
            if (Instance == null)
            {
                Instance = this;
                DontDestroyOnLoad(gameObject);
                services = BuildTimetable();
            }
            else
            {
                Destroy(gameObject);
            }
        }

        private static List<TrainService> BuildTimetable()
        {
            var list = new List<TrainService>();

            // 16301 Venad Express (DOWN)
            list.Add(new TrainService
            {
                serviceId  = "SVC_16301",
                trainNo    = "16301",
                name       = "Venad Express",
                direction  = TrainDirection.DOWN,
                locoType   = "WAP-7",
                rakeType   = "LHB",
                coachCount = 12,
                originDepartureClockMin = 6 * 60 + 15,
                stops = new[]
                {
                    MkStop("QLN",   0,  0.0f),
                    MkStop("IRP",   6,  4.6f),
                    MkStop("EVA",  23, 19.9f),
                    MkStop("VAK",  30, 23.7f),
                    MkStop("AKI",  44, 30.1f),
                    MkStop("CRY",  55, 35.9f),
                    MkStop("PGZ",  65, 40.0f),
                    MkStop("KPY",  80, 47.2f),
                    MkStop("VELI", 93, 55.3f),
                    MkStop("TVC", 105, 64.6f),
                }
            });

            // 16348 Trivandrum Mail (UP)
            list.Add(new TrainService
            {
                serviceId  = "SVC_16348",
                trainNo    = "16348",
                name       = "Trivandrum Mail",
                direction  = TrainDirection.UP,
                locoType   = "WAP-4",
                rakeType   = "ICF",
                coachCount = 18,
                originDepartureClockMin = 22 * 60 + 30,
                stops = new[]
                {
                    MkStop("TVC",   0, 64.6f),
                    MkStop("VELI", 12, 55.3f),
                    MkStop("KPY",  24, 47.2f),
                    MkStop("PGZ",  37, 40.0f),
                    MkStop("CRY",  47, 35.9f),
                    MkStop("AKI",  58, 30.1f),
                    MkStop("VAK",  72, 23.7f),
                    MkStop("EVA",  79, 19.9f),
                    MkStop("IRP",  97,  4.6f),
                    MkStop("QLN", 105,  0.0f),
                }
            });

            // 12201 Sampark Kranti (DOWN)
            list.Add(new TrainService
            {
                serviceId  = "SVC_12201",
                trainNo    = "12201",
                name       = "Kerala Sampark Kranti",
                direction  = TrainDirection.DOWN,
                locoType   = "WAP-7",
                rakeType   = "LHB",
                coachCount = 22,
                originDepartureClockMin = 13 * 60 + 45,
                stops = new[]
                {
                    MkStop("QLN",   0,  0.0f),
                    MkStop("VAK",  28, 23.7f),
                    MkStop("CRY",  52, 35.9f),
                    MkStop("KPY",  72, 47.2f),
                    MkStop("TVC",  90, 64.6f),
                }
            });

            // 56376 Passenger (DOWN)
            list.Add(new TrainService
            {
                serviceId  = "SVC_56376",
                trainNo    = "56376",
                name       = "QLN-TVC Passenger",
                direction  = TrainDirection.DOWN,
                locoType   = "WDM-3A",
                rakeType   = "ICF",
                coachCount = 8,
                originDepartureClockMin = 8 * 60 + 0,
                stops = new[]
                {
                    MkStop("QLN",   0,  0.0f),
                    MkStop("IRP",  10,  4.6f),
                    MkStop("MYY",  20,  8.9f),
                    MkStop("PVU",  30, 12.4f),
                    MkStop("KFI",  42, 17.0f),
                    MkStop("EVA",  50, 19.9f),
                    MkStop("VAK",  62, 23.7f),
                    MkStop("AKI",  80, 30.1f),
                    MkStop("KVU",  88, 32.8f),
                    MkStop("CRY",  98, 35.9f),
                    MkStop("PGZ", 110, 40.0f),
                    MkStop("MQU", 120, 43.2f),
                    MkStop("KPY", 132, 47.2f),
                    MkStop("KZK", 144, 51.3f),
                    MkStop("VELI",155, 55.3f),
                    MkStop("TVCN",162, 57.5f),
                    MkStop("PET", 172, 62.1f),
                    MkStop("TVC", 182, 64.6f),
                }
            });

            // 56377 Passenger (UP)
            list.Add(new TrainService
            {
                serviceId  = "SVC_56377",
                trainNo    = "56377",
                name       = "TVC-QLN Passenger",
                direction  = TrainDirection.UP,
                locoType   = "WDM-3A",
                rakeType   = "ICF",
                coachCount = 8,
                originDepartureClockMin = 10 * 60 + 30,
                stops = new[]
                {
                    MkStop("TVC",   0, 64.6f),
                    MkStop("PET",  10, 62.1f),
                    MkStop("TVCN", 18, 57.5f),
                    MkStop("VELI", 25, 55.3f),
                    MkStop("KZK",  35, 51.3f),
                    MkStop("KPY",  47, 47.2f),
                    MkStop("MQU",  58, 43.2f),
                    MkStop("PGZ",  68, 40.0f),
                    MkStop("CRY",  80, 35.9f),
                    MkStop("KVU",  89, 32.8f),
                    MkStop("AKI",  97, 30.1f),
                    MkStop("VAK", 115, 23.7f),
                    MkStop("EVA", 126, 19.9f),
                    MkStop("KFI", 133, 17.0f),
                    MkStop("PVU", 143, 12.4f),
                    MkStop("MYY", 153,  8.9f),
                    MkStop("IRP", 162,  4.6f),
                    MkStop("QLN", 172,  0.0f),
                }
            });

            // 66301 MEMU (DOWN)
            list.Add(new TrainService
            {
                serviceId  = "SVC_66301",
                trainNo    = "66301",
                name       = "QLN-TVC MEMU",
                direction  = TrainDirection.DOWN,
                locoType   = "WAG-9",
                rakeType   = "ICF",
                coachCount = 8,
                originDepartureClockMin = 7 * 60 + 0,
                stops = new[]
                {
                    MkStop("QLN",   0,  0.0f),
                    MkStop("IRP",   8,  4.6f),
                    MkStop("MYY",  17,  8.9f),
                    MkStop("PVU",  25, 12.4f),
                    MkStop("KFI",  35, 17.0f),
                    MkStop("EVA",  42, 19.9f),
                    MkStop("VAK",  52, 23.7f),
                    MkStop("AKI",  67, 30.1f),
                    MkStop("KVU",  73, 32.8f),
                    MkStop("CRY",  82, 35.9f),
                    MkStop("PGZ",  92, 40.0f),
                    MkStop("MQU", 100, 43.2f),
                    MkStop("KPY", 110, 47.2f),
                    MkStop("KZK", 120, 51.3f),
                    MkStop("VELI",130, 55.3f),
                    MkStop("TVCN",136, 57.5f),
                    MkStop("PET", 144, 62.1f),
                    MkStop("TVC", 152, 64.6f),
                }
            });

            // 66302 MEMU (UP)
            list.Add(new TrainService
            {
                serviceId  = "SVC_66302",
                trainNo    = "66302",
                name       = "TVC-QLN MEMU",
                direction  = TrainDirection.UP,
                locoType   = "WAG-9",
                rakeType   = "ICF",
                coachCount = 8,
                originDepartureClockMin = 8 * 60 + 30,
                stops = new[]
                {
                    MkStop("TVC",   0, 64.6f),
                    MkStop("PET",   8, 62.1f),
                    MkStop("TVCN", 14, 57.5f),
                    MkStop("VELI", 22, 55.3f),
                    MkStop("KZK",  31, 51.3f),
                    MkStop("KPY",  41, 47.2f),
                    MkStop("MQU",  51, 43.2f),
                    MkStop("PGZ",  60, 40.0f),
                    MkStop("CRY",  70, 35.9f),
                    MkStop("KVU",  78, 32.8f),
                    MkStop("AKI",  85, 30.1f),
                    MkStop("VAK", 100, 23.7f),
                    MkStop("EVA", 110, 19.9f),
                    MkStop("KFI", 116, 17.0f),
                    MkStop("PVU", 125, 12.4f),
                    MkStop("MYY", 134,  8.9f),
                    MkStop("IRP", 142,  4.6f),
                    MkStop("QLN", 152,  0.0f),
                }
            });

            // 22638 West Coast Express (UP)
            list.Add(new TrainService
            {
                serviceId  = "SVC_22638",
                trainNo    = "22638",
                name       = "West Coast Express",
                direction  = TrainDirection.UP,
                locoType   = "WAP-7",
                rakeType   = "LHB",
                coachCount = 14,
                originDepartureClockMin = 16 * 60 + 45,
                stops = new[]
                {
                    MkStop("TVC",   0, 64.6f),
                    MkStop("VELI", 13, 55.3f),
                    MkStop("KPY",  26, 47.2f),
                    MkStop("PGZ",  38, 40.0f),
                    MkStop("CRY",  48, 35.9f),
                    MkStop("AKI",  60, 30.1f),
                    MkStop("VAK",  74, 23.7f),
                    MkStop("EVA",  81, 19.9f),
                    MkStop("IRP",  98,  4.6f),
                    MkStop("QLN", 107,  0.0f),
                }
            });

            return list;
        }

        private static ServiceStop MkStop(string code, int depMin, float km)
        {
            int arr = depMin == 0 ? 0 : Math.Max(0, depMin - 2);
            return new ServiceStop
            {
                stationCode  = code,
                arrivalMin   = arr,
                departureMin = depMin,
                kmFromOrigin = km
            };
        }

        public List<ActiveTrain> GetActiveTrains(float playerKm, float gameTimeMinutes)
        {
            var result = new List<ActiveTrain>();

            foreach (var svc in services)
            {
                float? pos = InterpolatePosition(svc, gameTimeMinutes);
                if (pos == null) continue;

                float km = pos.Value;
                if (Mathf.Abs(km - playerKm) > ActiveWindowKm) continue;

                float speed = EstimateSpeed(svc, gameTimeMinutes);

                result.Add(new ActiveTrain
                {
                    serviceId  = svc.serviceId,
                    trainNo    = svc.trainNo,
                    name       = svc.name,
                    positionKm = (float)Math.Round(km, 2),
                    speedKmh   = (float)Math.Round(speed, 1),
                    locoType   = svc.locoType,
                    rakeType   = svc.rakeType,
                    coachCount = svc.coachCount,
                    direction  = svc.direction
                });
            }

            return result;
        }

        public MeetInfo GetNextMeet(float playerKm, float playerSpeedKmh, float gameTimeMinutes)
        {
            MeetInfo best = null;
            float bestSecs = float.MaxValue;

            foreach (var svc in services)
            {
                float? pos = InterpolatePosition(svc, gameTimeMinutes);
                if (pos == null) continue;

                float aiKm = pos.Value;
                float aiSpeed = EstimateSpeed(svc, gameTimeMinutes);

                float aiSpeedKmMin = aiSpeed / 60.0f;
                float playerSpeedKmMin = playerSpeedKmh / 60.0f;
                float relativeSpeed = aiSpeedKmMin + playerSpeedKmMin;

                if (svc.direction == TrainDirection.DOWN) continue; // Same direction

                if (aiKm <= playerKm) continue; // Passed already

                float gap = aiKm - playerKm;
                float meetInMin = gap / relativeSpeed;
                if (meetInMin < 0 || meetInMin > 180f) continue;

                float meetInSec = meetInMin * 60.0f;
                if (meetInSec >= bestSecs) continue;

                float meetKm = playerKm + playerSpeedKmMin * meetInMin;
                string station = NearestStation(meetKm);

                bestSecs = meetInSec;
                best = new MeetInfo
                {
                    serviceId         = svc.serviceId,
                    trainNo           = svc.trainNo,
                    name              = svc.name,
                    meetAtKm          = (float)Math.Round(meetKm, 2),
                    meetInSeconds     = (float)Math.Round(meetInSec, 1),
                    meetAtStationCode = station
                };
            }

            return best;
        }

        public SpawnInfo GetSpawnRecommendation(float playerKm, float playerSpeedKmh)
        {
            const float spawnAheadKm = 15.0f;
            float targetKm = Mathf.Min(playerKm + spawnAheadKm, CorridorLengthKm - 2.0f);

            foreach (var svc in services.Where(s => s.direction == TrainDirection.UP))
            {
                float speed = TypicalSpeed(svc);

                return new SpawnInfo
                {
                    serviceId  = svc.serviceId,
                    trainNo    = svc.trainNo,
                    name       = svc.name,
                    spawnKm    = (float)Math.Round(targetKm, 2),
                    speedKmh   = (float)Math.Round(speed, 1),
                    direction  = TrainDirection.UP,
                    locoType   = svc.locoType,
                    rakeType   = svc.rakeType,
                    coachCount = svc.coachCount,
                    reason     = $"Oncoming traffic spawn ~{spawnAheadKm} km ahead of player"
                };
            }

            return null;
        }

        public bool IsOnComingTrain(float playerKm, float gameTimeMinutes)
        {
            const float alertRadiusKm = 3.0f;

            foreach (var svc in services.Where(s => s.direction == TrainDirection.UP))
            {
                float? pos = InterpolatePosition(svc, gameTimeMinutes);
                if (pos == null) continue;

                if (pos.Value > playerKm && (pos.Value - playerKm) <= alertRadiusKm)
                    return true;
            }

            return false;
        }

        public int GetTrafficDensity(float km)
        {
            // Use local system time hours and minutes as reference
            float now = DateTime.Now.Hour * 60.0f + DateTime.Now.Minute;
            const float sectionHalfKm = 5.0f;
            int count = 0;

            foreach (var svc in services)
            {
                float? pos = InterpolatePosition(svc, now);
                if (pos == null) continue;
                if (Mathf.Abs(pos.Value - km) <= sectionHalfKm) count++;
            }

            return count;
        }

        private static float? InterpolatePosition(TrainService svc, float gameTimeMin)
        {
            float elapsed = gameTimeMin - svc.originDepartureClockMin;

            if (elapsed < -60f)  elapsed += 1440f;
            if (elapsed > 1440f) elapsed -= 1440f;

            var stops = svc.stops;
            if (stops.Length == 0) return null;

            if (elapsed < stops[0].departureMin) return null;

            if (elapsed > stops[stops.Length - 1].arrivalMin + 5f) return null;

            for (int i = 0; i < stops.Length; i++)
            {
                if (elapsed >= stops[i].arrivalMin && elapsed <= stops[i].departureMin)
                    return stops[i].kmFromOrigin;
            }

            for (int i = 0; i < stops.Length - 1; i++)
            {
                var from = stops[i];
                var to   = stops[i + 1];

                if (elapsed > from.departureMin && elapsed < to.arrivalMin)
                {
                    float segElapsed = elapsed - from.departureMin;
                    float segTotal   = to.arrivalMin - from.departureMin;
                    float t          = segElapsed / segTotal;

                    float km = from.kmFromOrigin + t * (to.kmFromOrigin - from.kmFromOrigin);
                    return km;
                }
            }

            return null;
        }

        private static float EstimateSpeed(TrainService svc, float gameTimeMin)
        {
            float elapsed = gameTimeMin - svc.originDepartureClockMin;
            if (elapsed < -60f)  elapsed += 1440f;
            if (elapsed > 1440f) elapsed -= 1440f;

            var stops = svc.stops;

            for (int i = 0; i < stops.Length - 1; i++)
            {
                var from = stops[i];
                var to   = stops[i + 1];

                if (elapsed > from.departureMin && elapsed < to.arrivalMin)
                {
                    float distKm  = Mathf.Abs(to.kmFromOrigin - from.kmFromOrigin);
                    float timeMins = to.arrivalMin - from.departureMin;
                    if (timeMins <= 0) return DefaultLineSpeedKmh;
                    return distKm / (timeMins / 60.0f);
                }
            }

            return 0.0f;
        }

        private static float TypicalSpeed(TrainService svc) =>
            svc.locoType switch
            {
                "WAP-7" => 110.0f,
                "WAP-4" =>  90.0f,
                "WAG-9" =>  75.0f,
                "WDM-3A" => 60.0f,
                _ => DefaultLineSpeedKmh
            };

        private static string NearestStation(float km)
        {
            string best = "QLN";
            float bestDist = float.MaxValue;

            foreach (var kvp in StationKm)
            {
                float d = Mathf.Abs(kvp.Value - km);
                if (d < bestDist) { bestDist = d; best = kvp.Key; }
            }

            return best;
        }
    }
}
