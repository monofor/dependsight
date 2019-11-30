using System;
using System.Collections.Generic;
using System.Reflection;
using System.Text.Json;
using System.Threading.Tasks;
using McMaster.Extensions.CommandLineUtils;
using MonoFor.DependSight.Engine;

namespace MonoFor.DependSight.Cli
{
    /// <summary>
    /// In this example, each sub command type inherits from <see cref="DependSightCommandBase"/>,
    /// which provides shared functionality between all the commands.
    /// This example also shows you how the subcommands can be linked to their parent types.
    /// </summary>
    [Command("dotnet-ds")]
    [VersionOptionFromMember("--version", MemberName = nameof(GetVersion))]
    [Subcommand(
        typeof(FindCommand))]
    class DependSight : DependSightCommandBase
    {
        private readonly IProcessor _processor;
        private readonly JsonSerializerOptions _jsonOptions;

        public DependSight() : base() {
            _processor = new Processor();
            _jsonOptions = new JsonSerializerOptions()
            {
                PropertyNamingPolicy = JsonNamingPolicy.CamelCase,
                WriteIndented = true
            };
        }

        public IProcessor Processor {
            get => this._processor;
        }

        public JsonSerializerOptions JsonOptions {
            get => this._jsonOptions;
        }

        public static int Main(string[] args)
        {
            return CommandLineApplication.Execute<DependSight>(args);
        }

        protected int OnExecute(CommandLineApplication app)
        {
            // this shows help even if the --help option isn't specified
            app.ShowHelp();

            return 1;
        }

        private static string GetVersion()
        {
            return typeof(DependSight).Assembly.GetCustomAttribute<AssemblyInformationalVersionAttribute>().InformationalVersion;
        }
    }

    [Command(Description = "Add file contents to the index")]
    class FindCommand : DependSightCommandBase
    {
        [Argument(0)]
        [DirectoryExists]
        public string Directory { get; set; }

        // You can use this pattern when the parent command may have options or methods you want to
        // use from sub-commands.
        // This will automatically be set before OnExecute is invoked
        private DependSight Parent { get; set; }

        protected async Task<int> OnExecute(CommandLineApplication app)
        {
            if (string.IsNullOrWhiteSpace(this.Directory)) {
                // this shows help even if the --help option isn't specified
                app.ShowHelp();

                return 1;
            }

            var value = new FindDependenciesModel();

			var result = await this.Parent.Processor.Find(value);

            Console.WriteLine(JsonSerializer.Serialize(result, this.Parent.JsonOptions));

            return 0;
        }
    }

    /// <summary>
    /// This base type provides shared functionality.
    /// Also, declaring <see cref="HelpOptionAttribute"/> on this type means all types that inherit from it
    /// will automatically support '--help'
    /// </summary>
    [HelpOption("--help")]
    abstract class DependSightCommandBase
    {
    }
}
