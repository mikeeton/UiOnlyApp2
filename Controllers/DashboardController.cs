using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace UiOnlyApp.Controllers
{
    [Authorize]
    public class DashboardController : Controller
    {
        [Authorize(Roles = "Patient")]
        public IActionResult Index()
        {
            return View();
        }

        [Authorize(Roles = "Clinician")]
        public IActionResult Clinician()
        {
            return View();
        }

        [Authorize(Roles = "Admin")]
        public IActionResult Admin()
        {
            return View();
        }

        [AllowAnonymous]
        public IActionResult NotFoundPage()
        {
            return View("NotFound");
        }
    }
}
