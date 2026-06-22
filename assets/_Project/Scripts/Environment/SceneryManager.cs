using System;
using System.Collections.Generic;
using UnityEngine;
using KeralaRailTwin.Physics;
using KeralaRailTwin.Rendering;

namespace KeralaRailTwin.Environment
{
    public enum ZoneType
    {
        Coastal,
        Backwater,
        Inland,
        Urban
    }

    public class SceneryManager : MonoBehaviour
    {
        public static SceneryManager Instance { get; private set; }

        [Header("Engine Reference")]
        public PhysicsEngine physicsEngine;

        [Header("Procedural Spawning Settings")]
        public float chunkSize = 300f; // Width of a streaming chunk in world units
        public int spawnAheadChunks = 3;
        public int spawnBehindChunks = 1;
        
        [Header("Y Bounds relative to Track")]
        public float trackY = 0f;
        public float backgroundMinY = 2f;
        public float backgroundMaxY = 12f;
        public float tracksideMinY = -3f;
        public float tracksideMaxY = -0.5f;

        [Header("Asset Prefabs")]
        public GameObject[] coconutPrefabs;
        public GameObject[] bananaPrefabs;
        public GameObject[] compoundWallPrefabs;
        public GameObject[] localHousePrefabs;
        public GameObject[] urbanBuildingPrefabs;
        public GameObject[] fishingBoatPrefabs;
        public GameObject[] waterTilePrefabs;
        public GameObject[] levelCrossingPrefabs;

        // Active spawned chunks tracking
        private readonly Dictionary<int, List<GameObject>> spawnedChunks = new Dictionary<int, List<GameObject>>();
        private int lastPlayerChunkIndex = -99;

        private void Awake()
        {
            if (Instance == null)
            {
                Instance = this;
                DontDestroyOnLoad(gameObject);
            }
            else
            {
                Destroy(gameObject);
            }
        }

        private void Start()
        {
            if (physicsEngine == null)
            {
                physicsEngine = FindFirstObjectByType<PhysicsEngine>();
            }

            // Generate default placeholders if arrays are empty, to prevent runtime exceptions
            EnsureDefaultAssets();
        }

        private void Update()
        {
            if (physicsEngine == null) return;

            float playerX = physicsEngine.worldDistance * 4.8f; // Scale to match scrolling multiplier
            int currentChunkIdx = Mathf.FloorToInt(playerX / chunkSize);

            if (currentChunkIdx != lastPlayerChunkIndex)
            {
                lastPlayerChunkIndex = currentChunkIdx;
                UpdateStreamedChunks(currentChunkIdx);
            }
        }

        private void UpdateStreamedChunks(int centerChunkIdx)
        {
            int startChunk = centerChunkIdx - spawnBehindChunks;
            int endChunk = centerChunkIdx + spawnAheadChunks;

            // 1. Spawn new chunks
            for (int i = startChunk; i <= endChunk; i++)
            {
                if (!spawnedChunks.ContainsKey(i) && i >= 0 && i * chunkSize / (3000.0f * 4.8f) <= 65f)
                {
                    SpawnChunk(i);
                }
            }

            // 2. Clean up old chunks
            List<int> keysToRemove = new List<int>();
            foreach (var key in spawnedChunks.Keys)
            {
                if (key < startChunk || key > endChunk)
                {
                    keysToRemove.Add(key);
                }
            }

            foreach (var key in keysToRemove)
            {
                DespawnChunk(key);
            }
        }

        private void SpawnChunk(int chunkIdx)
        {
            float startX = chunkIdx * chunkSize;
            float endX = startX + chunkSize;
            float chunkKm = startX / (3000.0f * 4.8f); // Convert coordinate to real-route km

            List<GameObject> chunkObjects = new List<GameObject>();
            ZoneType zone = GetZoneAt(chunkKm);

            // Spawn background vegetation & landscapes
            SpawnBackgroundScenery(startX, endX, zone, chunkObjects);

            // Spawn trackside structures
            SpawnTracksideScenery(startX, endX, zone, chunkKm, chunkObjects);

            // Specific zone overrides (e.g. Kappil Beach causeway water)
            if (zone == ZoneType.Backwater)
            {
                SpawnBackwaterElements(startX, endX, chunkObjects);
            }

            // Level Crossing gate checks
            // Level crossings are located near km 15.2 and 48.6
            if (Mathf.Abs(chunkKm - 15.2f) < (chunkSize / (3000.0f * 4.8f)) ||
                Mathf.Abs(chunkKm - 48.6f) < (chunkSize / (3000.0f * 4.8f)))
            {
                SpawnLevelCrossing(startX, endX, chunkObjects);
            }

            spawnedChunks.Add(chunkIdx, chunkObjects);
        }

        private void DespawnChunk(int chunkIdx)
        {
            if (spawnedChunks.TryGetValue(chunkIdx, out List<GameObject> objects))
            {
                foreach (var obj in objects)
                {
                    if (obj != null)
                    {
                        Destroy(obj);
                    }
                }
                spawnedChunks.Remove(chunkIdx);
            }
        }

        private ZoneType GetZoneAt(float km)
        {
            if (km >= 10f && km <= 20f) return ZoneType.Backwater;
            if (km >= 50f && km <= 65f) return ZoneType.Urban;
            if (km >= 25f && km < 50f) return ZoneType.Inland;
            return ZoneType.Coastal;
        }

        private void SpawnBackgroundScenery(float startX, float endX, ZoneType zone, List<GameObject> list)
        {
            int treeCount = zone switch
            {
                ZoneType.Coastal => 8,
                ZoneType.Backwater => 2, // Sparse tree cover in backwater sections
                ZoneType.Inland => 12, // Lush vegetation
                ZoneType.Urban => 3,
                _ => 6
            };

            for (int i = 0; i < treeCount; i++)
            {
                float x = UnityEngine.Random.Range(startX, endX);
                float y = UnityEngine.Random.Range(backgroundMinY, backgroundMaxY);
                Vector3 pos = new Vector3(x, y, y); // Z position matches Y for depth sort

                GameObject prefab = GetVegetationPrefab(zone);
                if (prefab != null)
                {
                    GameObject spawned = Instantiate(prefab, pos, Quaternion.identity, transform);
                    Configure25DObject(spawned, true);
                    list.Add(spawned);
                }
            }
        }

        private void SpawnTracksideScenery(float startX, float endX, ZoneType zone, float km, List<GameObject> list)
        {
            // Spawn compound walls & houses
            int houseCount = zone == ZoneType.Urban ? 4 : zone == ZoneType.Coastal || zone == ZoneType.Inland ? 2 : 0;
            for (int i = 0; i < houseCount; i++)
            {
                float x = UnityEngine.Random.Range(startX, endX);
                float y = UnityEngine.Random.Range(tracksideMinY, tracksideMaxY);
                Vector3 pos = new Vector3(x, y, y);

                GameObject prefab = GetBuildingPrefab(zone);
                if (prefab != null)
                {
                    GameObject spawned = Instantiate(prefab, pos, Quaternion.identity, transform);
                    Configure25DObject(spawned, false);
                    list.Add(spawned);
                }
            }

            // Spawn compound walls along the track sides
            if (zone != ZoneType.Backwater)
            {
                int wallCount = 3;
                float wallSpacing = chunkSize / wallCount;
                for (int i = 0; i < wallCount; i++)
                {
                    float x = startX + i * wallSpacing;
                    float y = tracksideMaxY; // Just below the rails
                    Vector3 pos = new Vector3(x, y, y);

                    GameObject prefab = GetRandomItem(compoundWallPrefabs);
                    if (prefab != null)
                    {
                        GameObject spawned = Instantiate(prefab, pos, Quaternion.identity, transform);
                        Configure25DObject(spawned, true);
                        list.Add(spawned);
                    }
                }
            }
        }

        private void SpawnBackwaterElements(float startX, float endX, List<GameObject> list)
        {
            // Spawn water causeway tiles in the background
            int waterTiles = 2;
            float spacing = chunkSize / waterTiles;
            for (int i = 0; i < waterTiles; i++)
            {
                float x = startX + i * spacing;
                float y = backgroundMinY;
                Vector3 pos = new Vector3(x, y, y);

                GameObject prefab = GetRandomItem(waterTilePrefabs);
                if (prefab != null)
                {
                    GameObject spawned = Instantiate(prefab, pos, Quaternion.identity, transform);
                    Configure25DObject(spawned, true);
                    list.Add(spawned);
                }
            }

            // Spawn bobbing fishing boats on the water
            int boatCount = UnityEngine.Random.Range(1, 3);
            for (int i = 0; i < boatCount; i++)
            {
                float x = UnityEngine.Random.Range(startX, endX);
                float y = backgroundMinY + UnityEngine.Random.Range(0.5f, 2f);
                Vector3 pos = new Vector3(x, y, y);

                GameObject prefab = GetRandomItem(fishingBoatPrefabs);
                if (prefab != null)
                {
                    GameObject spawned = Instantiate(prefab, pos, Quaternion.identity, transform);
                    Configure25DObject(spawned, false);
                    
                    // Add bobbing animation script
                    spawned.AddComponent<BobbingObject>();
                    list.Add(spawned);
                }
            }
        }

        private void SpawnLevelCrossing(float startX, float endX, List<GameObject> list)
        {
            float center = (startX + endX) / 2.0f;
            Vector3 pos = new Vector3(center, tracksideMaxY, tracksideMaxY);

            GameObject prefab = GetRandomItem(levelCrossingPrefabs);
            if (prefab != null)
            {
                GameObject spawned = Instantiate(prefab, pos, Quaternion.identity, transform);
                Configure25DObject(spawned, false);
                list.Add(spawned);
            }
        }

        private void Configure25DObject(GameObject obj, bool isStatic)
        {
            var sr = obj.GetComponent<SpriteRenderer>();
            if (sr == null)
            {
                sr = obj.AddComponent<SpriteRenderer>();
            }

            // Attach dynamic sorting order scripts
            var sorter = obj.GetComponent<DynamicDepthSorter>();
            if (sorter == null)
            {
                sorter = obj.AddComponent<DynamicDepthSorter>();
            }
            sorter.isStatic = isStatic;
            sorter.baseSortingOrder = isStatic ? 3000 : 5000;
        }

        private GameObject GetVegetationPrefab(ZoneType zone)
        {
            if (zone == ZoneType.Inland && bananaPrefabs.Length > 0 && UnityEngine.Random.value < 0.4f)
            {
                return GetRandomItem(bananaPrefabs);
            }
            return GetRandomItem(coconutPrefabs);
        }

        private GameObject GetBuildingPrefab(ZoneType zone)
        {
            if (zone == ZoneType.Urban)
            {
                return GetRandomItem(urbanBuildingPrefabs);
            }
            return GetRandomItem(localHousePrefabs);
        }

        private GameObject GetRandomItem(GameObject[] array)
        {
            if (array == null || array.Length == 0) return null;
            int idx = UnityEngine.Random.Range(0, array.Length);
            return array[idx];
        }

        private void EnsureDefaultAssets()
        {
            // Populate defaults if empty to prevent inspector reference warnings
            if (coconutPrefabs == null || coconutPrefabs.Length == 0) coconutPrefabs = CreateDefaultSpritePrefabs("CoconutTree");
            if (bananaPrefabs == null || bananaPrefabs.Length == 0) bananaPrefabs = CreateDefaultSpritePrefabs("BananaGrove");
            if (compoundWallPrefabs == null || compoundWallPrefabs.Length == 0) compoundWallPrefabs = CreateDefaultSpritePrefabs("CompoundWall");
            if (localHousePrefabs == null || localHousePrefabs.Length == 0) localHousePrefabs = CreateDefaultSpritePrefabs("KeralaHouse");
            if (urbanBuildingPrefabs == null || urbanBuildingPrefabs.Length == 0) urbanBuildingPrefabs = CreateDefaultSpritePrefabs("ApartmentBlock");
            if (fishingBoatPrefabs == null || fishingBoatPrefabs.Length == 0) fishingBoatPrefabs = CreateDefaultSpritePrefabs("FishingBoat");
            if (waterTilePrefabs == null || waterTilePrefabs.Length == 0) waterTilePrefabs = CreateDefaultSpritePrefabs("BackwaterTile");
            if (levelCrossingPrefabs == null || levelCrossingPrefabs.Length == 0) levelCrossingPrefabs = CreateDefaultSpritePrefabs("LCGate");
        }

        private GameObject[] CreateDefaultSpritePrefabs(string name)
        {
            GameObject defaultObj = new GameObject(name);
            defaultObj.transform.parent = transform;
            defaultObj.AddComponent<SpriteRenderer>();
            defaultObj.SetActive(false);
            return new GameObject[] { defaultObj };
        }
    }

    // Helper script to add gentle floating bobbing animation to backwater elements
    public class BobbingObject : MonoBehaviour
    {
        public float speed = 1.8f;
        public float heightRange = 0.15f;
        
        private float baseY;

        private void Start()
        {
            baseY = transform.position.y;
            speed = UnityEngine.Random.Range(1.2f, 2.4f);
        }

        private void Update()
        {
            float newY = baseY + Mathf.Sin(Time.time * speed) * heightRange;
            transform.position = new Vector3(transform.position.x, newY, transform.position.z);
        }
    }
}
