from unittest.mock import AsyncMock

import httpx
import pytest
from fastapi.testclient import TestClient

from app.main import app
from app.routers import imports_, reports


@pytest.fixture
def client():
    with TestClient(app) as test_client:
        yield test_client


def test_warranty_expiring_includes_only_assets_within_cutoff(client, monkeypatch):
    today = reports.date.today()
    assets = [
        {
            "assetTag": "IN-WINDOW",
            "model": "Model A",
            "warrantyExpiry": (today + reports.timedelta(days=20)).isoformat(),
            "status": "available",
        },
        {
            "assetTag": "OUTSIDE",
            "model": "Model B",
            "warrantyExpiry": (today + reports.timedelta(days=400)).isoformat(),
            "status": "assigned",
        },
        {
            "assetTag": "NO-WARRANTY",
            "model": "Model C",
            "warrantyExpiry": None,
            "status": "assigned",
        },
    ]
    monkeypatch.setattr(reports, "_get_assets", AsyncMock(return_value=assets))

    response = client.get("/reports/warranty-expiring")

    assert response.status_code == 200
    body = response.json()
    assert body["count"] == 1
    assert [item["assetTag"] for item in body["items"]] == ["IN-WINDOW"]


def test_warranty_expiring_honors_within_days_parameter(client, monkeypatch):
    today = reports.date.today()
    assets = [
        {
            "assetTag": "SOON",
            "model": "Model Soon",
            "warrantyExpiry": (today + reports.timedelta(days=10)).isoformat(),
            "status": "available",
        },
        {
            "assetTag": "LATER",
            "model": "Model Later",
            "warrantyExpiry": (today + reports.timedelta(days=60)).isoformat(),
            "status": "assigned",
        },
    ]
    monkeypatch.setattr(reports, "_get_assets", AsyncMock(return_value=assets))

    response = client.get("/reports/warranty-expiring", params={"within_days": 30})

    assert response.status_code == 200
    body = response.json()
    assert body["within_days"] == 30
    assert [item["assetTag"] for item in body["items"]] == ["SOON"]


def test_warranty_expiring_surfaces_assets_service_errors(client, monkeypatch):
    monkeypatch.setattr(
        reports,
        "_get_assets",
        AsyncMock(side_effect=httpx.HTTPError("assets down")),
    )

    response = client.get("/reports/warranty-expiring")

    assert response.status_code == 502
    assert "assets-svc unavailable" in response.json()["detail"]


def test_utilization_calculates_percentages(client, monkeypatch):
    monkeypatch.setattr(
        reports.httpx,
        "AsyncClient",
        lambda timeout=10.0: FakeAsyncClient(get_payload={"available": 3, "assigned": 2, "lost": 1}),
    )

    response = client.get("/reports/utilization")

    assert response.status_code == 200
    assert response.json() == {
        "total": 6,
        "in_use": 2,
        "utilization_pct": 33.3,
        "by_status": {"available": 3, "assigned": 2, "lost": 1},
    }


def test_utilization_handles_zero_totals(client, monkeypatch):
    monkeypatch.setattr(
        reports.httpx,
        "AsyncClient",
        lambda timeout=10.0: FakeAsyncClient(get_payload={}),
    )

    response = client.get("/reports/utilization")

    assert response.status_code == 200
    assert response.json()["utilization_pct"] == 0.0


def test_utilization_surfaces_assets_service_errors(client, monkeypatch):
    monkeypatch.setattr(
        reports.httpx,
        "AsyncClient",
        lambda timeout=10.0: FakeAsyncClient(get_error=httpx.ConnectError("boom", request=httpx.Request("GET", "http://test"))),
    )

    response = client.get("/reports/utilization")

    assert response.status_code == 502
    assert "assets-svc unavailable" in response.json()["detail"]


def test_import_assets_creates_all_rows(client, monkeypatch):
    created_rows = []
    monkeypatch.setattr(
        imports_.httpx,
        "AsyncClient",
        lambda timeout=15.0: FakeAsyncClient(post_sink=created_rows),
    )
    csv_body = "\n".join(
        [
            "asset_tag,asset_type,manufacturer,model,status",
            "CSV-001,Laptop,Maker A,Model A,available",
            "CSV-002,Phone,Maker B,Model B,assigned",
        ]
    )

    response = client.post(
        "/imports/assets",
        files={"file": ("assets.csv", csv_body, "text/csv")},
    )

    assert response.status_code == 200
    assert response.json() == {"imported": 2, "asset_tags": ["CSV-001", "CSV-002"]}
    assert [row["json"]["assetTag"] for row in created_rows] == ["CSV-001", "CSV-002"]


def test_import_assets_rejects_missing_required_columns(client):
    response = client.post(
        "/imports/assets",
        files={"file": ("assets.csv", "asset_tag,manufacturer,model,status\nCSV-001,Maker,Model,available", "text/csv")},
    )

    assert response.status_code == 400
    assert "CSV must contain columns" in response.json()["detail"]


def test_import_assets_allows_empty_csv_after_header(client, monkeypatch):
    created_rows = []
    monkeypatch.setattr(
        imports_.httpx,
        "AsyncClient",
        lambda timeout=15.0: FakeAsyncClient(post_sink=created_rows),
    )

    response = client.post(
        "/imports/assets",
        files={"file": ("assets.csv", "asset_tag,asset_type,manufacturer,model,status\n", "text/csv")},
    )

    assert response.status_code == 200
    assert response.json() == {"imported": 0, "asset_tags": []}
    assert created_rows == []


class FakeAsyncClient:
    def __init__(self, get_payload=None, get_error=None, post_sink=None):
        self.get_payload = get_payload
        self.get_error = get_error
        self.post_sink = post_sink if post_sink is not None else []

    async def __aenter__(self):
        return self

    async def __aexit__(self, exc_type, exc, tb):
        return False

    async def get(self, url):
        if self.get_error is not None:
            raise self.get_error
        return FakeResponse(self.get_payload)

    async def post(self, url, json):
        self.post_sink.append({"url": url, "json": json})
        return FakeResponse({"id": len(self.post_sink)}, status_code=201)


class FakeResponse:
    def __init__(self, payload, status_code=200):
        self._payload = payload
        self.status_code = status_code
        self.request = httpx.Request("GET", "http://testserver")

    def raise_for_status(self):
        if self.status_code >= 400:
            raise httpx.HTTPStatusError(
                f"HTTP {self.status_code}",
                request=self.request,
                response=httpx.Response(self.status_code, request=self.request),
            )

    def json(self):
        return self._payload
