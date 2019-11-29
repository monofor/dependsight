using System;
using System.Collections.Generic;
using System.IO;
using System.Linq;
using System.Text.RegularExpressions;
using System.Threading;
using System.Threading.Tasks;
using System.Xml;
using Microsoft.AspNetCore.Mvc;
using Microsoft.Extensions.Logging;
using Newtonsoft.Json;
using NuGet.Common;
using NuGet.Configuration;
using NuGet.Protocol;
using NuGet.Protocol.Core.Types;
using NuGet.Versioning;

namespace MonoFor.DependSight.Controllers
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

	[ApiController]
	[Route("api/[controller]")]
	public class DependenciesController : ControllerBase
	{
		private readonly ILogger<DependenciesController> _logger;

		public DependenciesController(ILogger<DependenciesController> logger)
		{
			_logger = logger;
		}

		public class ConfigFile
		{
			public string Key { get; set; }
			public string ProtocolVersion { get; set; }
			public string Url { get; set; }
		}

		public class DependencyCheck
		{
			public string PackageName { get; set; }
			public List<ConfigFile> Sources { get; set; }
			public bool IncludePrerelease { get; set; }
		}

		public class EndpointCredentialInfo
		{
			public List<EndpointCredential> EndpointCredentials { get; set; } = new List<EndpointCredential>();
		}

		public class EndpointCredential
		{
			public string Endpoint { get; set; }
			public string UserName { get; set; }
			public string Password { get; set; }
		}

		[HttpPost("check")]
		public async Task<IActionResult> Check(DependencyCheck value)
		{
			if (value == null) return BadRequest();

			if (value.Sources == null) value.Sources = new List<ConfigFile>();

			if (!value.Sources.Any()) value.Sources.Add(new ConfigFile
			{
				Key = "nuget",
				Url = "https://api.nuget.org/v3/index.json"
			});

			var versions = new List<PVersion>();
			var nugetLogger = new NugetLogger();
			var cacheContext = new NullSourceCacheContext();
			var providers = new List<Lazy<INuGetResourceProvider>>();
			providers.AddRange(Repository.Provider.GetCoreV3());

			var credentials = new EndpointCredentialInfo();

			var authentications = Environment.GetEnvironmentVariable("VSS_NUGET_EXTERNAL_FEED_ENDPOINTS");
			if (authentications != null)
			{
				credentials = JsonConvert.DeserializeObject<EndpointCredentialInfo>(authentications);
			}

			foreach (var source in value.Sources)
			{
				var packageSource = new PackageSource(source.Url);
				if (credentials != null && credentials.EndpointCredentials != null && credentials.EndpointCredentials.Any())
				{
					var credential = credentials.EndpointCredentials.FirstOrDefault(x => x.Endpoint.Equals(source.Url));
					if (credential != null)
						packageSource.Credentials = new PackageSourceCredential(source.Url, credential.UserName, credential.Password, true, "basic");
				}
				var sourceRepository = new SourceRepository(packageSource, providers);
				var metadataResource = await sourceRepository.GetResourceAsync<MetadataResource>();
				// var findPackageById = await sourceRepository.GetResourceAsync<FindPackageByIdResource>();

				var latest = await metadataResource.GetLatestVersion(value.PackageName, value.IncludePrerelease, false, cacheContext, nugetLogger, CancellationToken.None);

				if (latest == null) continue;

				versions.Add(new PVersion
				{
					Source = source,
					Version = latest.ToString(),
					Major = latest.Major,
					Minor = latest.Minor,
					Patch = latest.Patch,
					Revision = latest.Revision,
					IsSemVer2 = latest.IsSemVer2,
					Metadata = latest.Metadata,
					IsPrerelease = latest.IsPrerelease,
					IsLegacy = latest.IsLegacyVersion
				});
			}

			versions = versions
				.OrderByDescending(x => x.Major)
				.ThenByDescending(x => x.Minor)
				.ThenByDescending(x => x.Patch)
				.ThenByDescending(x => x.Revision)
				.ToList();

			return Ok(versions);
		}

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

		public class FindDependenciesModel
		{
			public string ProjectPath { get; set; }
		}

		[HttpPost]
		public async Task<object> Post(FindDependenciesModel value)
		{
			var path = value?.ProjectPath ?? "";
			if (string.IsNullOrEmpty(path)) path = "./";
			var currentDirectory = new System.IO.DirectoryInfo(path);

			var projectFiles = currentDirectory.GetFiles("*.csproj", System.IO.SearchOption.AllDirectories);
			var nugetConfigFiles = currentDirectory.GetFiles("nuget.config", System.IO.SearchOption.TopDirectoryOnly);

			var configFiles = new List<ConfigFile>();
			foreach (var fileInfo in nugetConfigFiles)
			{
				var xmlDoc = new System.Xml.XmlDocument();
				using (var sr = new StreamReader(fileInfo.FullName))
				{
					var xml = await sr.ReadToEndAsync();
					xmlDoc.LoadXml(xml);

					var packageSources = xmlDoc.SelectNodes("//packageSources/add");
					foreach (XmlNode packageSource in packageSources)
					{
						var keyAttribute = packageSource.Attributes["key"];
						var protocolVersionAttribute = packageSource.Attributes["protocolVersion"];
						var valueAttribute = packageSource.Attributes["value"];

						if (configFiles.Any(x => x.Key.Equals(keyAttribute.Value))) continue;

						configFiles.Add(new ConfigFile
						{
							Key = keyAttribute.Value,
							ProtocolVersion = protocolVersionAttribute?.Value,
							Url = valueAttribute.Value,
						});
					}
				}
			}

			var projects = new List<object>();
			var parameterRegex = new Regex(@"^\$\((.+)\)$");

			foreach (var fileInfo in projectFiles)
			{
				var xmlDoc = new System.Xml.XmlDocument();
				using (var sr = new StreamReader(fileInfo.FullName))
				{
					var xml = await sr.ReadToEndAsync();
					xmlDoc.LoadXml(xml);

					var dependencies = new List<object>();

					var parameters = new Dictionary<string, string>();
					var parameterFile = string.Empty;

					var importProperties = xmlDoc.SelectNodes("//Project/Import");
					foreach (XmlNode importProperty in importProperties)
					{
						var projectValue = importProperty.Attributes["Project"];
						if (projectValue == null) continue;

						var propsFile = new FileInfo(Path.Combine(fileInfo.Directory.FullName, projectValue.Value));
						if (!propsFile.Exists)
						{
							parameterFile = $"(NOT FOUND!) {propsFile.FullName}";
							continue;
						}

						parameterFile = propsFile.FullName;

						using (var srProperties = new StreamReader(propsFile.FullName))
						{
							var propsXml = await srProperties.ReadToEndAsync();
							var xmlDocProps = new System.Xml.XmlDocument();
							xmlDocProps.LoadXml(propsXml);

							foreach (XmlNode prop in xmlDocProps.FirstChild.FirstChild.ChildNodes)
							{
								parameters.TryAdd(prop.Name, prop.InnerText);
							}
						}
					}

					var packageReferences = xmlDoc.SelectNodes("//ItemGroup/PackageReference");

					foreach (XmlNode packageReference in packageReferences)
					{
						var versionAttribute = packageReference.Attributes["Version"];
						var nameAttribute = packageReference.Attributes["Include"];

						if (versionAttribute == null) continue;

						var parameterMatch = parameterRegex.Match(versionAttribute.Value);

						var parameterName = string.Empty;
						var versionValue = versionAttribute.Value;

						if (parameterMatch.Success)
						{
							parameterName = parameterMatch.Groups[1].Value;
							if (parameters.ContainsKey(parameterName))
								versionValue = parameters[parameterName];
							else
								versionValue = "-No Parameter-";
						}

						dependencies.Add(new
						{
							Name = nameAttribute.Value,
							CurrentVersion = versionValue,
							LatestVersion = string.Empty,
							IsChecked = false,
							IsLatest = false,
							Source = default(object),
							IsParameter = parameterMatch.Success,
							ParameterName = parameterName
						});
					}

					projects.Add(new
					{
						File = fileInfo.FullName,
						Name = fileInfo.Name,
						Dependencies = dependencies,
						Parameters = parameters,
						ParameterFile = parameterFile
					});
				}
			}

			return new
			{
				CurrentDirectory = currentDirectory.FullName,
				Projects = projects,
				NugetConfig = configFiles
			};
		}
	}
}
