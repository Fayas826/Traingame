using UnityEngine;

namespace KeralaRailTwin.Rendering
{
    [RequireComponent(typeof(SpriteRenderer))]
    public class DynamicDepthSorter : MonoBehaviour
    {
        [Header("Sorting Settings")]
        public int baseSortingOrder = 5000;
        public float positionScale = 100f; // Scale multiplier to convert position to int order
        public bool isStatic = false;

        private SpriteRenderer spriteRenderer;

        private void Start()
        {
            spriteRenderer = GetComponent<SpriteRenderer>();
            UpdateSortingOrder();
            if (isStatic)
            {
                enabled = false; // Disable update for static objects (performance optimization)
            }
        }

        private void Update()
        {
            UpdateSortingOrder();
        }

        private void UpdateSortingOrder()
        {
            if (spriteRenderer == null) return;

            // In 2.5D space, lower Y values (closer to the bottom of the screen) should be rendered in front
            // We subtract the Y coordinate multiplied by a scaling factor from the base sorting order
            spriteRenderer.sortingOrder = baseSortingOrder - Mathf.RoundToInt(transform.position.y * positionScale);
        }
    }
}
