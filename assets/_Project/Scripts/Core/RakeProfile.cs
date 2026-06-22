using UnityEngine;

namespace KeralaRailTwin.Core
{
    [CreateAssetMenu(fileName = "NewRakeProfile", menuName = "KeralaRailTwin/Rake Profile")]
    public class RakeProfile : ScriptableObject
    {
        [Header("Rake Identity")]
        public string id;
        public string rakeName;
        public string style;

        [Header("Physics Properties")]
        public int coachCount = 4;
        public float massPerCoach = 50f; // tons
        public float dragMultiplier = 1.0f;
    }
}
