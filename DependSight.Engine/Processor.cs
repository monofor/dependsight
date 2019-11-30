using System;
using System.Collections.Generic;
using System.Diagnostics.Contracts;
using System.IO;
using System.Linq;
using System.Text.RegularExpressions;
using System.Threading;
using System.Threading.Tasks;
using System.Xml;
using Newtonsoft.Json;
using NuGet.Configuration;
using NuGet.Protocol;
using NuGet.Protocol.Core.Types;

namespace MonoFor.DependSight.Engine
{
    public class Processor : IProcessor
	{
		public async Task<List<PVersion>> Check(DependencyCheck value)
		{
            Contract.Ensures(value != null);

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

			return versions;
		}

		public object Update(UpdateDependenciesModel value)
		{
			foreach (var dependency in value.Dependencies)
			{
				if (dependency.IsParameter)
				{
					if (string.IsNullOrEmpty(dependency.Project.ParameterFile)) continue;
					var parameterFileXml = new XmlDocument();
					using (var sr = new StreamReader(dependency.Project.ParameterFile))
					{
						parameterFileXml.Load(sr);
						var packageReference = parameterFileXml.SelectSingleNode($"//{dependency.ParameterName}");
						packageReference.InnerText = dependency.LatestVersion;
						parameterFileXml.Save(dependency.Project.ParameterFile);
					}
					continue;
				}
				var projectFileXml = new XmlDocument();
				using (var sr = new StreamReader(dependency.Project.File))
				{
					projectFileXml.Load(sr);
					var packageReference = projectFileXml.SelectSingleNode($"//PackageReference[@Include='{dependency.Name}']");
					packageReference.Attributes["Version"].Value = dependency.LatestVersion;
					projectFileXml.Save(dependency.Project.File);
				}
			}

			return new { Success = true, Message = "Dependencies are updated." };
		}

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

					var dependencies = new List<DependencyModel>();

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

						dependencies.Add(new DependencyModel
						{
							Name = nameAttribute.Value,
							CurrentVersion = versionValue,
							LatestVersion = string.Empty,
							IsChecked = false,
							IsLatest = false,
							Source = default(object),
							IsParameter = parameterMatch.Success,
							ParameterName = parameterName,
							Project = default(ProjectModel)
						});
					}

					projects.Add(new ProjectModel
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
