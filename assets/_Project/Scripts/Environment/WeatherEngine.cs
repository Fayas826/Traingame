using System;
using System.Collections.Generic;
using UnityEngine;
using KeralaRailTwin.Physics;

namespace KeralaRailTwin.Environment
{
    public enum WeatherType
    {
        Clear,
        LightRain,
        HeavyRain,
        Mist,
        Fog,
        Thunderstorm
    }

    [System.Serializable]
    public class WeatherZone
    {
        public string name;
        public float startKm;
        public float endKm;
        public float baseRainProbability;
        public float baseMistProbability;
        public bool isCoastal;
        public bool isBackwater;
    }

    public class WeatherEngine : MonoBehaviour
    {
        public static WeatherEngine Instance { get; private set; }

        [Header("Current Weather State")]
        [ReadOnly] public WeatherType currentWeather = WeatherType.LightRain;
        [ReadOnly, Range(0f, 1f)] public float rainfallIntensity = 0.3f;
        [ReadOnly] public float visibility = 4000f;
        [ReadOnly] public float windSpeed = 22.0f;
        [ReadOnly] public float humidity = 88f;
        [ReadOnly] public float temperature = 28.5f;

        [Header("Tuned Constants")]
        public float defaultLineSpeedKmh = 110f;

        private readonly List<WeatherZone> zones = new List<WeatherZone>();
        private readonly System.Random rng = new System.Random();
        private float lastUpdateTime = -1.0f;
        private float transitionTimer = 0.0f;

        public float AdhesionCoefficient
        {
            get
            {
                return currentWeather switch
                {
                    WeatherType.Clear        => 0.30f,
                    WeatherType.Mist         => 0.25f,
                    WeatherType.Fog          => 0.25f,
                    WeatherType.LightRain    => 0.22f,
                    WeatherType.HeavyRain    => 0.15f,
                    WeatherType.Thunderstorm => 0.14f,
                    _                        => 0.30f
                };
            }
        }

        public float BrakingDistanceMultiplier
        {
            get
            {
                return currentWeather switch
                {
                    WeatherType.Clear        => 1.00f,
                    WeatherType.Mist         => 1.15f,
                    WeatherType.Fog          => 1.20f,
                    WeatherType.LightRain    => 1.40f,
                    WeatherType.HeavyRain    => 1.80f,
                    WeatherType.Thunderstorm => 1.90f,
                    _                        => 1.00f
                };
            }
        }

        public float WheelSlipRisk
        {
            get
            {
                float baseRisk = Mathf.Max(0.0f, (0.30f - AdhesionCoefficient) / 0.30f);
                return Mathf.Clamp01(baseRisk + rainfallIntensity * 0.15f);
            }
        }

        private void Awake()
        {
            if (Instance == null)
            {
                Instance = this;
                DontDestroyOnLoad(gameObject);
                BuildZones();
            }
            else
            {
                Destroy(gameObject);
            }
        }

        private void BuildZones()
        {
            zones.Clear();
            zones.AddRange(new[]
            {
                new WeatherZone
                {
                    name = "Coastal Rain Belt",
                    startKm = 0.0f,
                    endKm = 25.0f,
                    baseRainProbability = 0.65f,
                    baseMistProbability = 0.10f,
                    isCoastal = true,
                    isBackwater = false
                },
                new WeatherZone
                {
                    name = "Backwater Mist Corridor",
                    startKm = 10.0f,
                    endKm = 20.0f,
                    baseRainProbability = 0.55f,
                    baseMistProbability = 0.40f,
                    isCoastal = true,
                    isBackwater = true
                },
                new WeatherZone
                {
                    name = "Inland Transitional",
                    startKm = 25.0f,
                    endKm = 50.0f,
                    baseRainProbability = 0.45f,
                    baseMistProbability = 0.15f,
                    isCoastal = false,
                    isBackwater = false
                },
                new WeatherZone
                {
                    name = "Thiruvananthapuram Urban",
                    startKm = 50.0f,
                    endKm = 65.0f,
                    baseRainProbability = 0.30f,
                    baseMistProbability = 0.08f,
                    isCoastal = false,
                    isBackwater = false
                }
            });
        }

        public WeatherZone GetWeatherZoneAt(float km)
        {
            WeatherZone best = null;
            float bestWidth = float.MaxValue;

            foreach (var zone in zones)
            {
                if (km >= zone.startKm && km <= zone.endKm)
                {
                    float width = zone.endKm - zone.startKm;
                    if (width < bestWidth)
                    {
                        bestWidth = width;
                        best = zone;
                    }
                }
            }

            return best ?? (zones.Count > 0 ? zones[0] : null);
        }

        public float GetAdhesionAt(float km)
        {
            var zone = GetWeatherZoneAt(km);
            float mu = AdhesionCoefficient;

            if (zone != null)
            {
                if (zone.isBackwater && (currentWeather == WeatherType.LightRain || currentWeather == WeatherType.HeavyRain))
                    mu -= 0.03f;

                if (zone.isCoastal && currentWeather == WeatherType.Clear)
                    mu -= 0.01f;
            }

            return Mathf.Clamp(mu, 0.08f, 0.33f);
        }

        public float GetVisibilityAt(float km)
        {
            var zone = GetWeatherZoneAt(km);
            float vis = visibility;

            if (zone != null)
            {
                if (zone.isBackwater && (currentWeather == WeatherType.Mist || currentWeather == WeatherType.Fog))
                    vis *= 0.5f;
            }

            return Mathf.Max(50.0f, vis);
        }

        public void UpdateWeather(float km, float timeOfDay)
        {
            var zone = GetWeatherZoneAt(km);
            if (zone == null) return;

            if (lastUpdateTime >= 0)
            {
                float elapsed = Mathf.Abs(timeOfDay - lastUpdateTime) * 24.0f * 60.0f; // minutes
                transitionTimer -= elapsed;
            }
            lastUpdateTime = timeOfDay;

            if (transitionTimer > 0) return;

            bool isMorning   = timeOfDay >= 0.167f && timeOfDay <= 0.333f; // 04:00-08:00
            bool isAfternoon = timeOfDay >= 0.542f && timeOfDay <= 0.708f; // 13:00-17:00
            bool isNight     = timeOfDay < 0.167f || timeOfDay > 0.875f;   // 21:00-04:00

            float rainProb = zone.baseRainProbability;
            float mistProb = zone.baseMistProbability;
            float stormProb = 0.0f;

            if (isAfternoon)
            {
                rainProb *= 1.35f;
                stormProb = zone.baseRainProbability * 0.25f;
            }

            if (isMorning && (zone.isBackwater || zone.isCoastal))
            {
                mistProb *= 2.0f;
            }

            if (isNight && zone.isBackwater)
            {
                mistProb *= 1.5f;
            }

            double roll = rng.NextDouble();

            WeatherType newWeather;
            float newRainfall;
            float newVis;

            if (roll < stormProb)
            {
                newWeather = WeatherType.Thunderstorm;
                newRainfall = 0.85f + (float)rng.NextDouble() * 0.15f;
                newVis = 800f + (float)rng.NextDouble() * 400f;
            }
            else if (roll < stormProb + rainProb * 0.4f)
            {
                newWeather = WeatherType.HeavyRain;
                newRainfall = 0.60f + (float)rng.NextDouble() * 0.25f;
                newVis = 1200f + (float)rng.NextDouble() * 800f;
            }
            else if (roll < stormProb + rainProb)
            {
                newWeather = WeatherType.LightRain;
                newRainfall = 0.15f + (float)rng.NextDouble() * 0.35f;
                newVis = 2500f + (float)rng.NextDouble() * 1500f;
            }
            else if (roll < stormProb + rainProb + mistProb && isMorning)
            {
                bool denseFog = zone.isBackwater && rng.NextDouble() < 0.35;
                newWeather = denseFog ? WeatherType.Fog : WeatherType.Mist;
                newRainfall = 0.0f;
                newVis = denseFog
                    ? 60f + (float)rng.NextDouble() * 80f
                    : 300f + (float)rng.NextDouble() * 300f;
            }
            else
            {
                newWeather = WeatherType.Clear;
                newRainfall = 0.0f;
                newVis = 8000f + (float)rng.NextDouble() * 2000f;
            }

            ApplyWeather(newWeather, newRainfall, newVis, timeOfDay, zone);

            transitionTimer = 8.0f + (float)rng.NextDouble() * 17.0f;
        }

        private void ApplyWeather(WeatherType type, float rainfall, float vis, float timeOfDay, WeatherZone zone)
        {
            currentWeather = type;
            rainfallIntensity = rainfall;
            visibility = vis;

            float baseTemp = zone.isCoastal ? 29.0f : 31.0f;
            float diurnal = Mathf.Sin((timeOfDay - 0.25f) * 2.0f * Mathf.PI) * 4.0f;
            temperature = baseTemp + diurnal - (type == WeatherType.Thunderstorm ? 4.0f : 0.0f) - (rainfall * 3.0f);

            humidity = type switch
            {
                WeatherType.Clear        => 65f + rng.Next(0, 10),
                WeatherType.Mist         => 92f + rng.Next(0, 6),
                WeatherType.Fog          => 96f + rng.Next(0, 4),
                WeatherType.LightRain    => 88f + rng.Next(0, 8),
                WeatherType.HeavyRain    => 95f + rng.Next(0, 4),
                WeatherType.Thunderstorm => 97f + rng.Next(0, 3),
                _                        => 75f
            };
            float baseWind = zone.isCoastal ? 18.0f : 10.0f;
            windSpeed = type switch
            {
                WeatherType.Clear        => baseWind + rng.Next(0, 8),
                WeatherType.Mist         => 2f + rng.Next(0, 4),
                WeatherType.Fog          => 1f + rng.Next(0, 3),
                WeatherType.LightRain    => baseWind + rng.Next(5, 15),
                WeatherType.HeavyRain    => baseWind + rng.Next(15, 30),
                WeatherType.Thunderstorm => 45f + rng.Next(10, 35),
                _                        => baseWind
            };
        }
    }
}
