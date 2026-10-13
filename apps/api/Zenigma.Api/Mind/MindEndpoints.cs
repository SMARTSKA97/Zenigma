using System.Security.Claims;
using System.Text.RegularExpressions;
using Microsoft.EntityFrameworkCore;
using Npgsql;
using Zenigma.Api.Auth;
using Zenigma.Api.Data;

namespace Zenigma.Api.Mind;

public record MindScoreDto(string? Game, string? Skill, int Pct, int Plays);
public record MindScoresRequest(List<MindScoreDto>? Scores);
public record SkillCompareDto(string Skill, int? Mine, int? Average, int? Percentile);
public record GroupCompareDto(string Name, int Players, bool Ready, List<SkillCompareDto> Skills);
public record MindCompareDto(string? AgeGroup, string? Gender, bool Sharing, List<GroupCompareDto> Groups);

/// <summary>
/// Mind-training comparison. Each player's best mark per game (0 to 100) is stored; only players who opted in (Settings, Profile)
/// count towards the groups, and a group is shown only once it has enough players that nobody can be picked out.
/// </summary>
public static partial class MindEndpoints
{
    public const int MinGroup = 5;
    public static readonly string[] Skills = ["memory", "focus", "speed", "maths", "language", "reasoning"];

    [GeneratedRegex("^[a-z0-9-]{1,32}$")]
    private static partial Regex GamePattern();

    public static void MapMind(this IEndpointRouteBuilder app)
    {
        var group = app.MapGroup("/mind").RequireAuthorization();

        group.MapPut("/scores", async (MindScoresRequest request, ClaimsPrincipal principal, AppDbContext db, CancellationToken ct) =>
        {
            var userId = UserIds.Get(principal);
            var scores = request.Scores ?? [];
            if (scores.Count > 40)
                return Results.ValidationProblem(new Dictionary<string, string[]> { ["scores"] = ["At most 40 scores per request."] });

            foreach (var s in scores)
            {
                if (s.Game is null || !GamePattern().IsMatch(s.Game) || s.Skill is null || !Skills.Contains(s.Skill) || s.Pct is < 0 or > 100 || s.Plays is < 0 or > 1_000_000) continue;
                await db.Database.ExecuteSqlRawAsync(
                    """
                    INSERT INTO mind_scores (user_id, game, skill, pct, plays) VALUES (@u, @g, @s, @p, @n)
                    ON CONFLICT (user_id, game) DO UPDATE SET skill = EXCLUDED.skill, pct = GREATEST(mind_scores.pct, EXCLUDED.pct), plays = GREATEST(mind_scores.plays, EXCLUDED.plays), updated_at = now()
                    """,
                    [new NpgsqlParameter("u", userId), new NpgsqlParameter("g", s.Game), new NpgsqlParameter("s", s.Skill), new NpgsqlParameter("p", s.Pct), new NpgsqlParameter("n", s.Plays)],
                    ct);
            }
            return Results.NoContent();
        });

        group.MapGet("/compare", async (ClaimsPrincipal principal, AppDbContext db, CancellationToken ct) =>
        {
            var userId = UserIds.Get(principal);
            var me = await db.UserProfiles.AsNoTracking().FirstOrDefaultAsync(p => p.UserId == userId, ct);

            // My own mark per skill (the average of my games in it).
            var mine = (await db.MindScores.AsNoTracking().Where(s => s.UserId == userId).ToListAsync(ct))
                .GroupBy(s => s.Skill)
                .ToDictionary(g => g.Key, g => (int)Math.Round(g.Average(s => s.Pct)));

            // Everyone who shares: one mark per player and skill.
            var shared = await (from s in db.MindScores.AsNoTracking()
                                join p in db.UserProfiles.AsNoTracking() on s.UserId equals p.UserId
                                where p.ShareCohort
                                select new { s.UserId, s.Skill, s.Pct, p.AgeGroup, p.Gender }).ToListAsync(ct);
            var perPlayer = shared
                .GroupBy(r => (r.UserId, r.Skill, r.AgeGroup, r.Gender))
                .Select(g => (g.Key.UserId, g.Key.Skill, g.Key.AgeGroup, g.Key.Gender, Pct: g.Average(r => r.Pct)))
                .ToList();

            GroupCompareDto Group(string name, Func<(string UserId, string Skill, string? AgeGroup, string? Gender, double Pct), bool> include)
            {
                var rows = perPlayer.Where(include).ToList();
                var players = rows.Select(r => r.UserId).Distinct().Count();
                var ready = players >= MinGroup;
                var skills = Skills.Select(skill =>
                {
                    mine.TryGetValue(skill, out var my);
                    var marks = rows.Where(r => r.Skill == skill).Select(r => r.Pct).ToList();
                    if (!ready || marks.Count < MinGroup) return new SkillCompareDto(skill, mine.ContainsKey(skill) ? my : null, null, null);
                    int? percentile = null;
                    if (mine.ContainsKey(skill))
                    {
                        var below = marks.Count(m => m < my) + marks.Count(m => Math.Abs(m - my) < 0.5) / 2.0;
                        percentile = (int)Math.Round(100.0 * below / marks.Count);
                    }
                    return new SkillCompareDto(skill, mine.ContainsKey(skill) ? my : null, (int)Math.Round(marks.Average()), percentile);
                }).ToList();
                return new GroupCompareDto(name, players, ready, skills);
            }

            var groups = new List<GroupCompareDto> { Group("Everyone", _ => true) };
            if (me?.AgeGroup is { } age) groups.Add(Group($"Ages {age}", r => r.AgeGroup == age));
            if (me?.Gender is { } gender) groups.Add(Group(gender switch { "female" => "Women", "male" => "Men", _ => "Others" }, r => r.Gender == gender));
            return Results.Ok(new MindCompareDto(me?.AgeGroup, me?.Gender, me?.ShareCohort ?? false, groups));
        });
    }
}
