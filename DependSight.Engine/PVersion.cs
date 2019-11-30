namespace MonoFor.DependSight.Engine
{
    public class PVersion
    {
        public ConfigFile Source { get; set; }
        public string Version { get; set; }
        public int Major { get; set; }
        public int Minor { get; set; }
        public int Patch { get; set; }
        public int Revision { get; set; }
        public bool IsSemVer2 { get; set; }
        public string Metadata { get; set; }
        public bool IsPrerelease { get; set; }
        public bool IsLegacy { get; set; }
    }
}
