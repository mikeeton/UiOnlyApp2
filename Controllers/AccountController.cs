using System.Security.Claims;
using Microsoft.AspNetCore.Authentication;
using Microsoft.AspNetCore.Authentication.Cookies;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace UiOnlyApp.Controllers
{
    public class AccountController : Controller
    {
        [HttpGet]
        [AllowAnonymous]
        public IActionResult Login(string? returnUrl = null)
        {
            ViewData["ReturnUrl"] = returnUrl;
            return View();
        }

        [HttpPost]
        [AllowAnonymous]
        [ValidateAntiForgeryToken]
        public async Task<IActionResult> Login(string displayName, string role, string? returnUrl = null)
        {
            if (string.IsNullOrWhiteSpace(role))
            {
                ModelState.AddModelError(string.Empty, "Please select a role.");
                ViewData["ReturnUrl"] = returnUrl;
                return View();
            }

            if (string.IsNullOrWhiteSpace(displayName))
            {
                displayName = role switch
                {
                    "Clinician" => "Clinician Demo",
                    "Admin" => "Admin Demo",
                    _ => "Patient Demo"
                };
            }

            var claims = new List<Claim>
            {
                new(ClaimTypes.Name, displayName),
                new(ClaimTypes.Role, role)
            };

            var identity = new ClaimsIdentity(claims, CookieAuthenticationDefaults.AuthenticationScheme);
            var principal = new ClaimsPrincipal(identity);

            await HttpContext.SignInAsync(CookieAuthenticationDefaults.AuthenticationScheme, principal);

            if (!string.IsNullOrWhiteSpace(returnUrl) && Url.IsLocalUrl(returnUrl))
                return Redirect(returnUrl);

            return role switch
            {
                "Admin" => RedirectToAction("Admin", "Dashboard"),
                "Clinician" => RedirectToAction("Clinician", "Dashboard"),
                _ => RedirectToAction("Index", "Dashboard")
            };
        }

        [Authorize]
        public async Task<IActionResult> Logout()
        {
            await HttpContext.SignOutAsync();
            return RedirectToAction("Login");
        }

        [HttpGet]
        [AllowAnonymous]
        public IActionResult Denied()
        {
            return View();
        }
    }
}
