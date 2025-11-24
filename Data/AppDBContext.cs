using Microsoft.EntityFrameworkCore;
using UiOnlyApp.Models;
using Microsoft.AspNetCore.Identity.EntityFrameworkCore;



namespace UiOnlyApp.Data
{
    public class AppDBContext : IdentityDbContext
    {
        public AppDBContext(DbContextOptions<AppDBContext> options) : base(options)
        {
        }

        //*come back and change to DbSet<Item> Items { get; set; } if needed later
        public DbSet<Patient> Patients { get; set; }
    }
}
