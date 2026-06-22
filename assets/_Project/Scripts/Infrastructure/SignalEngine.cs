using System;
using System.Collections.Generic;
using System.Linq;
using UnityEngine;

namespace KeralaRailTwin.Infrastructure
{
    public enum SignalAspect
    {
        Danger = 0,             // Red
        Caution = 1,            // Single Yellow
        AttentionRequired = 2,  // Double Yellow
        Clear = 3               // Green
    }

    [System.Serializable]
    public class Signal
    {
        public string id;
        public string signalName;
        public float positionKm;
        public SignalAspect aspect = SignalAspect.Danger;
        public bool isStarter;
        public bool isHome;
        public bool isAutomatic;
        public bool isRouteLocked;
    }

    [System.Serializable]
    public class SignalViolation
    {
        public string signalId;
        public float speedKmh;
        public float positionKm;
        public string timestamp;
    }

    public class SignalEngine : MonoBehaviour
    {
        public static SignalEngine Instance { get; private set; }

        [Header("Route Constants")]
        public float autoSignalSpacingKm = 2.0f;
        public float stationSignalOffsetKm = 0.2f;
        public float routeLockRadiusKm = 0.5f;

        [Header("Signals List")]
        public List<Signal> signals = new List<Signal>();
        
        [Header("Violations Log")]
        public List<SignalViolation> violations = new List<SignalViolation>();

        private float lastTrainKm = -1f;

        private static readonly (float Km, string Code, string Name)[] StationsData = new[]
        {
            ( 0.0f,  "QLN",  "Kollam Junction" ),
            ( 4.6f,  "IRP",  "Iravipuram" ),
            ( 8.9f,  "MYY",  "Mayyanad" ),
            ( 12.4f, "PVU",  "Paravur" ),
            ( 17.0f, "KFI",  "Kappil" ),
            ( 19.9f, "EVA",  "Edavai" ),
            ( 23.7f, "VAK",  "Varkala Sivagiri" ),
            ( 30.1f, "AKI",  "Akathumuri" ),
            ( 32.8f, "KVU",  "Kadakkavur" ),
            ( 35.9f, "CRY",  "Chirayinkeezhu" ),
            ( 40.0f, "PGZ",  "Perunguzhi" ),
            ( 43.2f, "MQU",  "Murukkampuzha" ),
            ( 47.2f, "KPY",  "Kaniyapuram" ),
            ( 51.3f, "KZK",  "Kazhakkuttam" ),
            ( 55.3f, "VELI", "Veli" ),
            ( 57.5f, "TVCN", "Thiruvananthapuram North" ),
            ( 62.1f, "PET",  "TVM Pettah" ),
            ( 64.6f, "TVC",  "Trivandrum Central" )
        };

        private void Awake()
        {
            if (Instance == null)
            {
                Instance = this;
                DontDestroyOnLoad(gameObject);
                BuildSignalsRoute();
            }
            else
            {
                Destroy(gameObject);
            }
        }

        private void BuildSignalsRoute()
        {
            signals.Clear();

            // 1. Station signals
            for (int i = 0; i < StationsData.Length; i++)
            {
                var (km, code, name) = StationsData[i];

                // Home signal
                signals.Add(new Signal
                {
                    id = $"{code}-HOME",
                    signalName = $"{name} Home",
                    positionKm = km - stationSignalOffsetKm,
                    isHome = true,
                    aspect = SignalAspect.Danger
                });

                // Starter signal
                signals.Add(new Signal
                {
                    id = $"{code}-STR",
                    signalName = $"{name} Starter",
                    positionKm = km + stationSignalOffsetKm,
                    isStarter = true,
                    aspect = SignalAspect.Danger
                });
            }

            // 2. Automatic block signals
            for (float pos = autoSignalSpacingKm; pos < 64.6f; pos += autoSignalSpacingKm)
            {
                bool nearStation = StationsData.Any(s => Mathf.Abs(s.Km - pos) < 0.5f);
                if (nearStation) continue;

                signals.Add(new Signal
                {
                    id = $"AUTO-KM-{pos:F1}",
                    signalName = $"Automatic Block {pos:F1} km",
                    positionKm = pos,
                    isAutomatic = true,
                    aspect = SignalAspect.Clear
                });
            }

            signals.Sort((a, b) => a.positionKm.CompareTo(b.positionKm));
        }

        public void UpdateSignals(float trainKm, float trainSpeedKmh)
        {
            // SPAD detection
            if (lastTrainKm >= 0)
            {
                foreach (var sig in signals)
                {
                    if (sig.aspect == SignalAspect.Danger
                        && sig.positionKm > lastTrainKm
                        && sig.positionKm <= trainKm
                        && trainSpeedKmh > 5.0f)
                    {
                        violations.Add(new SignalViolation
                        {
                            signalId = sig.id,
                            speedKmh = trainSpeedKmh,
                            positionKm = trainKm,
                            timestamp = DateTime.UtcNow.ToString("o")
                        });
                    }
                }
            }
            lastTrainKm = trainKm;

            // Route locking
            foreach (var sig in signals)
            {
                sig.isRouteLocked = sig.aspect == SignalAspect.Danger
                                && sig.positionKm > trainKm
                                && sig.positionKm - trainKm <= routeLockRadiusKm;
            }

            // block propagation
            int aheadIdx = -1;
            for (int i = 0; i < signals.Count; i++)
            {
                if (signals[i].positionKm >= trainKm)
                {
                    aheadIdx = i;
                    break;
                }
            }

            if (aheadIdx == -1)
            {
                foreach (var s in signals) s.aspect = SignalAspect.Clear;
                return;
            }

            // Current ahead is Danger
            signals[aheadIdx].aspect = SignalAspect.Danger;

            // Ahead of that is Clear
            for (int i = aheadIdx + 1; i < signals.Count; i++)
                signals[i].aspect = SignalAspect.Clear;

            // Propagate backwards
            if (aheadIdx - 1 >= 0)
                signals[aheadIdx - 1].aspect = SignalAspect.Caution;

            if (aheadIdx - 2 >= 0)
                signals[aheadIdx - 2].aspect = SignalAspect.AttentionRequired;

            for (int i = aheadIdx - 3; i >= 0; i--)
                signals[i].aspect = SignalAspect.Clear;
        }

        public Signal GetNextSignal(float km)
        {
            return signals.FirstOrDefault(s => s.positionKm >= km);
        }

        public SignalAspect GetAspectAt(float km)
        {
            var next = GetNextSignal(km);
            return next != null ? next.aspect : SignalAspect.Clear;
        }

        public List<Signal> GetSignalsInRange(float startKm, float endKm)
        {
            return signals
                .Where(s => s.positionKm >= startKm && s.positionKm <= endKm)
                .ToList();
        }

        public bool ActivateStarter(string stationCode)
        {
            string targetId = $"{stationCode.ToUpperInvariant()}-STR";
            var sig = signals.FirstOrDefault(s => s.id == targetId);
            if (sig == null) return false;

            sig.aspect = SignalAspect.Clear;
            return true;
        }

        public float GetRestrictiveSpeed(float km)
        {
            var next = GetNextSignal(km);
            if (next == null) return 110f; // clear line

            return next.aspect switch
            {
                SignalAspect.Clear            => 110f,
                SignalAspect.AttentionRequired => 75f,
                SignalAspect.Caution          => 30f,
                SignalAspect.Danger           => 0f,
                _                             => 110f
            };
        }

        public string GetCallout(float km, float speedKmh)
        {
            var next = GetNextSignal(km);
            if (next == null)
                return "Line clear. Approaching destination.";

            float distKm = next.positionKm - km;
            string distText = distKm < 1.0f
                ? $"{(int)(distKm * 1000f)} metres"
                : $"{distKm:F1} km";

            string speedText = $"{(int)Mathf.Round(speedKmh)} km/h";

            return next.aspect switch
            {
                SignalAspect.Clear => $"GREEN. {next.signalName} at {distText}. Proceed at line speed.",
                SignalAspect.AttentionRequired => $"DOUBLE YELLOW. {next.signalName} at {distText}. Next signal at caution. Prepare to reduce speed. Current speed {speedText}.",
                SignalAspect.Caution => $"SINGLE YELLOW. {next.signalName} at {distText}. Prepare to stop at next signal. Reduce speed to 30 km/h. Current speed {speedText}.",
                SignalAspect.Danger => $"RED SIGNAL! {next.signalName} at {distText}. STOP before signal. Apply brakes immediately! Current speed {speedText}.",
                _ => "Signal status unknown."
            };
        }
    }
}
