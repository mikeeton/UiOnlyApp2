using Microsoft.AspNetCore.Identity;
using Microsoft.EntityFrameworkCore;
using UiOnlyApp.Data;

var builder = WebApplication.CreateBuilder(args);

// ====================================
// MVC + Razor Pages
// ====================================
builder.Services.AddControllersWithViews();
builder.Services.AddRazorPages();

// ====================================
// Use EF Core InMemory DB instead of SQL Server
// ====================================
builder.Services.AddDbContext<AppDBContext>(options =>
    options.UseInMemoryDatabase("PatientDemoDb"));

// ====================================
// Identity + Roles (no extra custom cookie auth)
// ====================================
builder.Services
    .AddDefaultIdentity<IdentityUser>(options =>
    {
        // For demo: no email confirmation required
        options.SignIn.RequireConfirmedAccount = false;
    })
    .AddRoles<IdentityRole>()
    .AddEntityFrameworkStores<AppDBContext>();

// Configure Identity application cookie
builder.Services.ConfigureApplicationCookie(options =>
{
    options.LoginPath = "/Identity/Account/Login";
    options.LogoutPath = "/Identity/Account/Logout";
    options.AccessDeniedPath = "/Identity/Account/AccessDenied";
});

var app = builder.Build();

// ====================================
// Seed roles + demo users on startup
// (no migrations needed with InMemory)
// ====================================
using (var scope = app.Services.CreateScope())
{
    var services = scope.ServiceProvider;

    try
    {
        await SeedIdentityDataAsync(services);
    }
    catch (Exception ex)
    {
        Console.WriteLine("Startup seed error: " + ex.Message);
    }
}

// ====================================
// Middleware pipeline
// ====================================
if (!app.Environment.IsDevelopment())
{
    app.UseExceptionHandler("/Home/Error");
    app.UseHsts();
}
else
{
    app.UseDeveloperExceptionPage();
}

app.UseHttpsRedirection();
app.UseStaticFiles();

app.UseRouting();

app.UseAuthentication();
app.UseAuthorization();

// ====================================
// Identity Razor Pages (login/register/logout)
// ====================================
app.MapRazorPages();

// ====================================
// Root (/) → Login page
// ====================================
app.MapGet("/", () => Results.Redirect("/Identity/Account/Login"));

// ====================================
// MVC Controller routes (Dashboard, etc.)
// ====================================
app.MapControllerRoute(
    name: "default",
    pattern: "{controller=Dashboard}/{action=Index}/{id?}");

app.Run();


// ====== Local function for seeding roles + demo users ======
static async Task SeedIdentityDataAsync(IServiceProvider services)
{
    var roleManager = services.GetRequiredService<RoleManager<IdentityRole>>();
    var userManager = services.GetRequiredService<UserManager<IdentityUser>>();

    string[] roles = { "Admin", "Clinician", "Patient" };

    // Ensure roles exist
    foreach (var role in roles)
    {
        if (!await roleManager.RoleExistsAsync(role))
        {
            await roleManager.CreateAsync(new IdentityRole(role));
        }
    }

    // ---- Admin demo user ----
    var adminEmail = "admin@example.com";
    var adminUser = await userManager.FindByEmailAsync(adminEmail);
    if (adminUser == null)
    {
        adminUser = new IdentityUser
        {
            UserName = adminEmail,
            Email = adminEmail,
            EmailConfirmed = true
        };

        await userManager.CreateAsync(adminUser, "Admin123!");
        await userManager.AddToRoleAsync(adminUser, "Admin");
    }

    // ---- Clinician demo user ----
    var clinicianEmail = "clinician@example.com";
    var clinicianUser = await userManager.FindByEmailAsync(clinicianEmail);
    if (clinicianUser == null)
    {
        clinicianUser = new IdentityUser
        {
            UserName = clinicianEmail,
            Email = clinicianEmail,
            EmailConfirmed = true
        };

        await userManager.CreateAsync(clinicianUser, "Clinician123!");
        await userManager.AddToRoleAsync(clinicianUser, "Clinician");
    }

    // ---- Patient demo users (from your JSON) ----
    var patientPassword = "Demo123!";

    var patientDefs = new[]
    {
        new { Id = "1c0fd777", Name = "Michael Eton",   Email = "michael.eton@patient.demo" },
        new { Id = "71e66ab3", Name = "Jason Ghanian",  Email = "jason.ghanian@patient.demo" },
        new { Id = "543d4676", Name = "Alex Jenkins",   Email = "alex.jenkins@patient.demo" },
        new { Id = "d13043b3", Name = "Richard Afana",  Email = "richard.afana@patient.demo" },
        new { Id = "de0e9b2c", Name = "De Luca",        Email = "de.luca@patient.demo" }
    };

    foreach (var p in patientDefs)
    {
        var user = await userManager.FindByEmailAsync(p.Email);
        if (user == null)
        {
            user = new IdentityUser
            {
                UserName = p.Email,
                Email = p.Email,
                EmailConfirmed = true
            };

            var createResult = await userManager.CreateAsync(user, patientPassword);
            if (createResult.Succeeded)
            {
                await userManager.AddToRoleAsync(user, "Patient");

                // Optional link to your JSON/CSV id
                await userManager.AddClaimAsync(user,
                    new System.Security.Claims.Claim("PatientId", p.Id));
            }
        }
    }
}
