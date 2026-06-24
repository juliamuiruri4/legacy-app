using System.Net;
using System.Net.Http.Json;
using System.Text.Json;
using Microsoft.AspNetCore.Mvc.Testing;
using Xunit;

namespace Contoso.Assets.Tests;

public class AssetEndpointsTests
{
    [Fact]
    public async Task Create_and_get_by_id_round_trip()
    {
        using var factory = new AssetApiFactory();
        using var client = factory.CreateClient();
        var payload = NewAsset("create-read", status: "available");

        var createResponse = await client.PostAsJsonAsync("/assets", payload);

        Assert.Equal(HttpStatusCode.Created, createResponse.StatusCode);
        Assert.NotNull(createResponse.Headers.Location);

        var created = await createResponse.Content.ReadFromJsonAsync<CreateAssetResponse>();
        Assert.NotNull(created);

        var getResponse = await client.GetAsync($"/assets/{created!.Id}");

        Assert.Equal(HttpStatusCode.OK, getResponse.StatusCode);
        var asset = await getResponse.Content.ReadFromJsonAsync<AssetDto>();
        Assert.NotNull(asset);
        Assert.Equal(payload.AssetTag, asset!.AssetTag);
        Assert.Equal(payload.Manufacturer, asset.Manufacturer);
        Assert.Equal(payload.Status, asset.Status);
    }

    [Fact]
    public async Task Get_by_unknown_id_returns_not_found()
    {
        using var factory = new AssetApiFactory();
        using var client = factory.CreateClient();

        var response = await client.GetAsync("/assets/999999");

        Assert.Equal(HttpStatusCode.NotFound, response.StatusCode);
    }

    [Fact]
    public async Task Update_persists_changes()
    {
        using var factory = new AssetApiFactory();
        using var client = factory.CreateClient();
        var createdId = await CreateAssetAsync(client, NewAsset("update-target", status: "available"));
        var updated = NewAsset("updated", status: "lost");

        var updateResponse = await client.PutAsJsonAsync($"/assets/{createdId}", updated);

        Assert.Equal(HttpStatusCode.NoContent, updateResponse.StatusCode);

        var getResponse = await client.GetAsync($"/assets/{createdId}");
        var asset = await getResponse.Content.ReadFromJsonAsync<AssetDto>();

        Assert.NotNull(asset);
        Assert.Equal(updated.AssetTag, asset!.AssetTag);
        Assert.Equal(updated.Manufacturer, asset.Manufacturer);
        Assert.Equal(updated.Status, asset.Status);
    }

    [Fact]
    public async Task Update_unknown_id_returns_not_found()
    {
        using var factory = new AssetApiFactory();
        using var client = factory.CreateClient();

        var response = await client.PutAsJsonAsync("/assets/999999", NewAsset("missing-update"));

        Assert.Equal(HttpStatusCode.NotFound, response.StatusCode);
    }

    [Fact]
    public async Task Delete_removes_the_asset()
    {
        using var factory = new AssetApiFactory();
        using var client = factory.CreateClient();
        var createdId = await CreateAssetAsync(client, NewAsset("delete-target"));

        var deleteResponse = await client.DeleteAsync($"/assets/{createdId}");

        Assert.Equal(HttpStatusCode.NoContent, deleteResponse.StatusCode);
        Assert.Equal(HttpStatusCode.NotFound, (await client.GetAsync($"/assets/{createdId}")).StatusCode);
    }

    [Fact]
    public async Task Delete_unknown_id_returns_not_found()
    {
        using var factory = new AssetApiFactory();
        using var client = factory.CreateClient();

        var response = await client.DeleteAsync("/assets/999999");

        Assert.Equal(HttpStatusCode.NotFound, response.StatusCode);
    }

    [Fact]
    public async Task Search_filters_by_status()
    {
        using var factory = new AssetApiFactory();
        using var client = factory.CreateClient();

        var response = await client.GetAsync("/assets/search?status=available");

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        var assets = await response.Content.ReadFromJsonAsync<List<AssetDto>>();

        Assert.NotNull(assets);
        Assert.NotEmpty(assets!);
        Assert.All(assets!, asset => Assert.Equal("available", asset.Status));
    }

    [Fact]
    public async Task Search_matches_tag_manufacturer_and_model_queries()
    {
        using var factory = new AssetApiFactory();
        using var client = factory.CreateClient();
        var unique = Guid.NewGuid().ToString("N")[..8];
        var createdId = await CreateAssetAsync(client, NewAsset(unique, manufacturer: $"Maker-{unique}", model: $"Model-{unique}"));

        var byTag = await SearchAsync(client, $"q=TAG-{unique.ToUpperInvariant()}");
        var byManufacturer = await SearchAsync(client, $"q=Maker-{unique}");
        var byModel = await SearchAsync(client, $"q=Model-{unique}");

        Assert.Contains(byTag, asset => asset.Id == createdId);
        Assert.Contains(byManufacturer, asset => asset.Id == createdId);
        Assert.Contains(byModel, asset => asset.Id == createdId);
    }

    [Fact]
    public async Task Search_combines_filters()
    {
        using var factory = new AssetApiFactory();
        using var client = factory.CreateClient();
        var unique = Guid.NewGuid().ToString("N")[..8];
        var createdId = await CreateAssetAsync(
            client,
            NewAsset(unique, assetType: "Phone", manufacturer: $"Combo-{unique}", model: $"ComboModel-{unique}", status: "retired"));

        var matches = await SearchAsync(
            client,
            $"type=Phone&status=retired&q=Combo-{unique}");

        Assert.Contains(matches, asset => asset.Id == createdId);
        Assert.All(matches, asset =>
        {
            Assert.Equal("Phone", asset.AssetType);
            Assert.Equal("retired", asset.Status);
        });
    }

    [Fact]
    public async Task Stats_by_status_returns_counts_for_seeded_statuses()
    {
        using var factory = new AssetApiFactory();
        using var client = factory.CreateClient();

        var statsResponse = await client.GetAsync("/assets/stats/by-status");
        var listResponse = await client.GetAsync("/assets");

        Assert.Equal(HttpStatusCode.OK, statsResponse.StatusCode);
        var stats = await statsResponse.Content.ReadFromJsonAsync<Dictionary<string, int>>();
        var assets = await listResponse.Content.ReadFromJsonAsync<List<AssetDto>>();

        Assert.NotNull(stats);
        Assert.NotNull(assets);
        Assert.Contains("available", stats!.Keys);
        Assert.Contains("assigned", stats.Keys);
        Assert.Contains("retired", stats.Keys);
        Assert.Contains("lost", stats.Keys);
        Assert.Equal(assets!.Count, stats.Values.Sum());
    }

    private static async Task<long> CreateAssetAsync(HttpClient client, AssetCreateRequest payload)
    {
        var response = await client.PostAsJsonAsync("/assets", payload);
        response.EnsureSuccessStatusCode();

        var created = await response.Content.ReadFromJsonAsync<CreateAssetResponse>();
        Assert.NotNull(created);
        return created!.Id;
    }

    private static async Task<List<AssetDto>> SearchAsync(HttpClient client, string queryString)
    {
        var response = await client.GetAsync($"/assets/search?{queryString}");
        response.EnsureSuccessStatusCode();

        var assets = await response.Content.ReadFromJsonAsync<List<AssetDto>>();
        Assert.NotNull(assets);
        return assets!;
    }

    private static AssetCreateRequest NewAsset(
        string suffix,
        string assetType = "Laptop",
        string? manufacturer = null,
        string? model = null,
        string status = "available")
    {
        var upper = suffix.ToUpperInvariant();
        return new AssetCreateRequest(
            $"TAG-{upper}",
            assetType,
            manufacturer ?? $"Maker-{upper}",
            model ?? $"Model-{upper}",
            $"SN-{upper}",
            "2024-01-01",
            "2026-01-01",
            status,
            $"Notes for {upper}");
    }

    private sealed record CreateAssetResponse(long Id);

    private sealed record AssetDto(
        long Id,
        string AssetTag,
        string AssetType,
        string Manufacturer,
        string Model,
        string? SerialNumber,
        string? PurchaseDate,
        string? WarrantyExpiry,
        string Status,
        string? Notes);

    private sealed record AssetCreateRequest(
        string AssetTag,
        string AssetType,
        string Manufacturer,
        string Model,
        string? SerialNumber,
        string? PurchaseDate,
        string? WarrantyExpiry,
        string Status,
        string? Notes);

    private sealed class AssetApiFactory : WebApplicationFactory<Program>
    {
        private readonly string _dbPath = Path.Combine(Path.GetTempPath(), $"assets-api-{Guid.NewGuid():N}.db");
        private readonly string? _originalDbPath = Environment.GetEnvironmentVariable("ASSETS_DB_PATH");

        public AssetApiFactory()
        {
            Environment.SetEnvironmentVariable("ASSETS_DB_PATH", _dbPath);
        }

        protected override void Dispose(bool disposing)
        {
            base.Dispose(disposing);

            Environment.SetEnvironmentVariable("ASSETS_DB_PATH", _originalDbPath);
            if (File.Exists(_dbPath))
            {
                File.Delete(_dbPath);
            }
        }
    }
}
