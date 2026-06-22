using UnityEngine;

namespace KeralaRailTwin.Rendering
{
    public class ParallaxEngine : MonoBehaviour
    {
        [Header("Parallax Settings")]
        [Tooltip("Factor by which this layer scrolls relative to the camera (0.0 = fixed with camera, 1.0 = scrolls with track)")]
        [Range(0f, 1f)] public float parallaxFactor = 0.5f;
        
        [Header("Tiling (Optional)")]
        public bool repeatHorizontal = true;
        public float textureWidth = 20.48f; // Width of the texture sprite in world units

        private Transform cameraTransform;
        private Vector3 lastCameraPosition;

        private void Start()
        {
            if (Camera.main != null)
            {
                cameraTransform = Camera.main.transform;
                lastCameraPosition = cameraTransform.position;
            }
        }

        private void LateUpdate()
        {
            if (cameraTransform == null) return;

            // Calculate camera movement delta
            float deltaX = cameraTransform.position.x - lastCameraPosition.x;
            
            // Move this object backwards by a fraction of the camera movement
            transform.position += Vector3.right * (deltaX * (1f - parallaxFactor));
            
            lastCameraPosition = cameraTransform.position;

            // Optional horizontal wrapping/tiling for continuous parallax backgrounds
            if (repeatHorizontal)
            {
                float relativeCameraDist = cameraTransform.position.x * parallaxFactor;
                if (Mathf.Abs(cameraTransform.position.x - transform.position.x) >= textureWidth)
                {
                    float offsetPositionX = (cameraTransform.position.x - transform.position.x) % textureWidth;
                    transform.position = new Vector3(cameraTransform.position.x + offsetPositionX, transform.position.y, transform.position.z);
                }
            }
        }
    }
}
