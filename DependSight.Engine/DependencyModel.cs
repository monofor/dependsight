namespace MonoFor.DependSight.Engine
{
    public class DependencyModel
    {
        public string Name { get; set; }
        public string CurrentVersion { get; set; }
        public string LatestVersion { get; set; }
        public bool IsChecked { get; set; }
        public bool IsLatest { get; set; }
        public object Source { get; set; }
        public bool IsParameter { get; set; }
        public string ParameterName { get; set; }
        public ProjectModel Project { get; set; }
    }
}
