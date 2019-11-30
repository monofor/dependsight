using System.Collections.Generic;

namespace MonoFor.DependSight.Engine
{
    public class ProjectModel
	{
		public string File { get; set; }
		public string Name { get; set; }
		public List<DependencyModel> Dependencies { get; set; }
		public Dictionary<string, string> Parameters { get; set; }
		public string ParameterFile { get; set; }
	}
}
