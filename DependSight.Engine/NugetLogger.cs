using System.Threading.Tasks;
using NuGet.Common;

namespace MonoFor.DependSight.Engine
{
    public class NugetLogger : NuGet.Common.ILogger
	{
		public void LogDebug(string data) { }
		public void LogVerbose(string data) { }
		public void LogInformation(string data) { }
		public void LogMinimal(string data) { }
		public void LogWarning(string data) { }
		public void LogError(string data) { }
		public void LogSummary(string data) { }

		public void LogInformationSummary(string data)
		{
		}

		public void Log(NuGet.Common.LogLevel level, string data)
		{
		}

		public Task LogAsync(NuGet.Common.LogLevel level, string data)
		{
			return Task.CompletedTask;
		}

		public void Log(ILogMessage message)
		{
		}

		public Task LogAsync(ILogMessage message)
		{
			return Task.CompletedTask;
		}
	}
}
