// File: Controllers/HomeController.cs
using Microsoft.AspNetCore.Mvc;

namespace UiOnlyApp.Controllers
{
    public class HomeController : Controller
    {
        // Landing page
        [HttpGet]
        public IActionResult Index() => View();

        // Role dashboards (UI-only pages)
        [HttpGet]
        public IActionResult Patient() => View();

        [HttpGet]
        public IActionResult Clinician() => View();

        [HttpGet]
        public IActionResult Admin() => View();

        // Reports (UI-only)
        [HttpGet]
        public IActionResult Reports() => View();

        // Simple login page (no auth logic; front-end only)
        [HttpGet]
        public IActionResult Login() => View();

        // Optional: keep the default Privacy page if you use the MVC template’s view
        [HttpGet]
        public IActionResult Privacy() => View();

        // Optional: default Error action from the MVC template (works with Views/Shared/Error.cshtml)
        [ResponseCache(Duration = 0, Location = ResponseCacheLocation.None, NoStore = true)]
        [HttpGet]
        public IActionResult Error() => View();
    }
}
