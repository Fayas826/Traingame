using UnityEngine;

namespace KeralaRailTwin.Rendering
{
    public class IsometricCameraControl : MonoBehaviour
    {
        [Header("Target Tracking")]
        public Transform target; // The train transform
        public Vector3 offset = new Vector3(0f, 4f, -10f); // 3/4 isometric offset

        [Header("2.5D Isometric Settings")]
        public float cameraPitch = 35f;
        public float cameraYaw = 45f;

        [Header("Smoothness & Speed")]
        public float smoothSpeed = 0.125f;
        
        [Header("Dynamic Zoom")]
        public float baseOrthographicSize = 5f;
        public float speedZoomFactor = 0.1f;
        public float maxZoomOut = 8f;
        
        private Camera cam;
        private Rigidbody rb;

        private void Start()
        {
            cam = GetComponent<Camera>();
            if (cam == null) cam = Camera.main;

            if (target != null)
            {
                rb = target.GetComponent<Rigidbody>();
            }

            // Set oblique / 3/4 isometric rotation
            transform.rotation = Quaternion.Euler(cameraPitch, cameraYaw, 0f);
        }

        private void LateUpdate()
        {
            if (target == null) return;

            // Track target position with smooth lerp
            Vector3 desiredPosition = target.position + offset;
            Vector3 smoothedPosition = Vector3.Lerp(transform.position, desiredPosition, smoothSpeed);
            transform.position = smoothedPosition;

            // Dynamic Orthographic Zoom based on speed
            if (cam != null && cam.orthographic)
            {
                float currentSpeed = 0f;
                if (rb != null)
                {
                    currentSpeed = rb.linearVelocity.magnitude;
                }
                
                float targetZoom = baseOrthographicSize + currentSpeed * speedZoomFactor;
                cam.orthographicSize = Mathf.Lerp(cam.orthographicSize, Mathf.Min(targetZoom, maxZoomOut), smoothSpeed);
            }
        }
    }
}
