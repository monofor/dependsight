using System.Collections.Generic;
using System.Threading.Tasks;

namespace MonoFor.DependSight.Engine
{
    public interface IProcessor
	{
		Task<List<PVersion>> Check(DependencyCheck value);
		object Update(UpdateDependenciesModel value);
		Task<object> Post(FindDependenciesModel value);
	}
}
