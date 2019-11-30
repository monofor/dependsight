using System.Threading.Tasks;
using Microsoft.AspNetCore.Mvc;
using Microsoft.Extensions.Logging;
using MonoFor.DependSight.Engine;

namespace MonoFor.DependSight.Controllers
{
    [ApiController]
	[Route("api/[controller]")]
	public class DependenciesController : ControllerBase
	{
		private readonly ILogger<DependenciesController> _logger;
		private readonly IProcessor _processor;

		public DependenciesController(ILogger<DependenciesController> logger, IProcessor processor)
		{
			_logger = logger;
			_processor = processor;
		}

		[HttpPost("check")]
		public async Task<IActionResult> Check(DependencyCheck value)
		{
			if (value == null) return BadRequest();

			var result = await _processor.Check(value);

			return Ok(result);
		}


		[HttpPost("update")]
		public async Task<IActionResult> Update(UpdateDependenciesModel value)
		{
			var result = _processor.Update(value);

			return await Task.Run(() => Ok(result));
		}

		[HttpPost]
		public async Task<object> Post(FindDependenciesModel value)
		{
			var result = await _processor.Post(value);

			return value;
		}
	}
}
