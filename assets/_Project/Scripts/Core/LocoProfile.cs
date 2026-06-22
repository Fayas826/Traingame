using UnityEngine;

namespace KeralaRailTwin.Core
{
    [CreateAssetMenu(fileName = "NewLocoProfile", menuName = "KeralaRailTwin/Loco Profile")]
    public class LocoProfile : ScriptableObject
    {
        [Header("Locomotive Identity")]
        public string id;
        public string locoName;
        public string type;
        public Color themeColor = Color.red;

        [Header("Physics Properties")]
        public float mass = 1200f; // tons
        public float maxSpeed = 11.5f; // unit speed
        public float throttlePower = 0.006f;
        public float brakeFactor = 0.008f;

        [Header("Davis Drag Coefficients")]
        public float dragA = 0.003f;
        public float dragB = 0.001f;
        public float dragC = 0.0001f;
        
        [Header("Visual Configuration")]
        public bool isElectric = true;
    }
}
