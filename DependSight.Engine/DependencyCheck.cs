using System.Collections.Generic;

namespace MonoFor.DependSight.Engine
{
    public class DependencyCheck
    {
        public string PackageName { get; set; }
        public List<ConfigFile> Sources { get; set; }
        public bool IncludePrerelease { get; set; }
    }
}
