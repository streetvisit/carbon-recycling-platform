#!/usr/bin/env python3
"""
UK Government Conversion Factors API

FastAPI-based REST API for querying UK Government GHG Conversion Factors.
Provides endpoints for searching and retrieving conversion factors by various criteria.

Usage:
    uvicorn src.api.conversion_factors:app --reload --host 0.0.0.0 --port 8000
"""

from fastapi import FastAPI, HTTPException, Query, Depends
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field
from typing import List, Optional, Dict, Any, Union
import json
import re
from pathlib import Path
from functools import lru_cache
import logging

# Set up logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Initialize FastAPI app
app = FastAPI(
    title="UK Government GHG Conversion Factors API",
    description="API for querying UK Government GHG Conversion Factors 2025",
    version="1.0.0",
    docs_url="/docs",
    redoc_url="/redoc"
)

# CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Configure appropriately for production
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Pydantic models
class ConversionFactor(BaseModel):
    id: str
    scope: Optional[str]
    category: Dict[str, Optional[str]]
    units: Dict[str, Optional[str]]
    conversion_factor: float
    column_text: Optional[str]
    year: int
    tags: List[str]

class ConversionFactorResponse(BaseModel):
    metadata: Dict[str, Any]
    factors: List[ConversionFactor]
    total: int
    page: int
    per_page: int

class SearchRequest(BaseModel):
    scope: Optional[str] = Field(None, description="Emission scope (Scope 1, Scope 2, Scope 3)")
    category_level1: Optional[str] = Field(None, description="Top level category")
    category_level2: Optional[str] = Field(None, description="Second level category")
    category_level3: Optional[str] = Field(None, description="Third level category")
    activity_unit: Optional[str] = Field(None, description="Activity unit (e.g., kWh, km, tonnes)")
    emission_unit: Optional[str] = Field(None, description="Emission unit (e.g., kg CO2e)")
    search_term: Optional[str] = Field(None, description="Free text search in tags and categories")
    min_factor: Optional[float] = Field(None, description="Minimum conversion factor value")
    max_factor: Optional[float] = Field(None, description="Maximum conversion factor value")

# Data loading
@lru_cache(maxsize=1)
def load_conversion_factors() -> Dict[str, Any]:
    """Load conversion factors from JSON file with caching."""
    data_file = Path("src/data/conversion_factors_2025.json")
    
    if not data_file.exists():
        raise FileNotFoundError(f"Conversion factors file not found: {data_file}")
    
    try:
        with open(data_file, 'r', encoding='utf-8') as f:
            data = json.load(f)
        
        logger.info(f"Loaded {data['metadata']['total_factors']} conversion factors")
        return data
    
    except Exception as e:
        logger.error(f"Error loading conversion factors: {e}")
        raise

@lru_cache(maxsize=1)
def load_major_changes() -> Dict[str, Any]:
    """Load major changes analysis from JSON file with caching."""
    changes_file = Path("src/data/major_changes_2025.json")
    
    if not changes_file.exists():
        return {"metadata": {"title": "No major changes data available"}, "major_changes": []}
    
    try:
        with open(changes_file, 'r', encoding='utf-8') as f:
            return json.load(f)
    except Exception as e:
        logger.error(f"Error loading major changes: {e}")
        return {"metadata": {"title": "Error loading changes"}, "major_changes": []}

# Helper functions
def search_factors(factors: List[Dict], search_params: SearchRequest) -> List[Dict]:
    """Search and filter conversion factors based on parameters."""
    filtered_factors = factors.copy()
    
    # Filter by scope
    if search_params.scope:
        filtered_factors = [
            f for f in filtered_factors 
            if f.get('scope') and search_params.scope.lower() in f['scope'].lower()
        ]
    
    # Filter by category levels
    if search_params.category_level1:
        filtered_factors = [
            f for f in filtered_factors 
            if f.get('category', {}).get('level1') and 
               search_params.category_level1.lower() in f['category']['level1'].lower()
        ]
    
    if search_params.category_level2:
        filtered_factors = [
            f for f in filtered_factors 
            if f.get('category', {}).get('level2') and 
               search_params.category_level2.lower() in f['category']['level2'].lower()
        ]
    
    if search_params.category_level3:
        filtered_factors = [
            f for f in filtered_factors 
            if f.get('category', {}).get('level3') and 
               search_params.category_level3.lower() in f['category']['level3'].lower()
        ]
    
    # Filter by units
    if search_params.activity_unit:
        filtered_factors = [
            f for f in filtered_factors 
            if f.get('units', {}).get('activity_unit') and 
               search_params.activity_unit.lower() in f['units']['activity_unit'].lower()
        ]
    
    if search_params.emission_unit:
        filtered_factors = [
            f for f in filtered_factors 
            if f.get('units', {}).get('emission_unit') and 
               search_params.emission_unit.lower() in f['units']['emission_unit'].lower()
        ]
    
    # Free text search
    if search_params.search_term:
        search_term = search_params.search_term.lower()
        filtered_factors = [
            f for f in filtered_factors 
            if any(search_term in tag.lower() for tag in f.get('tags', [])) or
               any(search_term in str(v).lower() for v in f.get('category', {}).values() if v)
        ]
    
    # Filter by factor range
    if search_params.min_factor is not None:
        filtered_factors = [
            f for f in filtered_factors 
            if f.get('conversion_factor', 0) >= search_params.min_factor
        ]
    
    if search_params.max_factor is not None:
        filtered_factors = [
            f for f in filtered_factors 
            if f.get('conversion_factor', 0) <= search_params.max_factor
        ]
    
    return filtered_factors

# API Endpoints

@app.get("/", summary="API Health Check")
async def root():
    """Health check endpoint."""
    data = load_conversion_factors()
    return {
        "status": "ok",
        "message": "UK Government GHG Conversion Factors API",
        "version": "1.0.0",
        "total_factors": data["metadata"]["total_factors"],
        "year": data["metadata"]["year"]
    }

@app.get("/metadata", summary="Get conversion factors metadata")
async def get_metadata():
    """Get metadata about the conversion factors dataset."""
    data = load_conversion_factors()
    changes_data = load_major_changes()
    
    return {
        "conversion_factors": data["metadata"],
        "major_changes": changes_data["metadata"]
    }

@app.get("/categories", summary="Get all categories")
async def get_categories():
    """Get all available categories and their counts."""
    data = load_conversion_factors()
    return {
        "categories": data["metadata"]["categories"],
        "scopes": data["metadata"]["scopes"]
    }

@app.get("/factors", response_model=ConversionFactorResponse, summary="Get conversion factors")
async def get_conversion_factors(
    scope: Optional[str] = Query(None, description="Filter by scope"),
    category: Optional[str] = Query(None, description="Filter by category level 1"),
    search: Optional[str] = Query(None, description="Search term"),
    page: int = Query(1, ge=1, description="Page number"),
    per_page: int = Query(50, ge=1, le=1000, description="Items per page")
):
    """Get conversion factors with optional filtering and pagination."""
    
    data = load_conversion_factors()
    
    # Create search parameters
    search_params = SearchRequest(
        scope=scope,
        category_level1=category,
        search_term=search
    )
    
    # Filter factors
    filtered_factors = search_factors(data["conversion_factors"], search_params)
    
    # Pagination
    start_idx = (page - 1) * per_page
    end_idx = start_idx + per_page
    paginated_factors = filtered_factors[start_idx:end_idx]
    
    return ConversionFactorResponse(
        metadata=data["metadata"],
        factors=[ConversionFactor(**factor) for factor in paginated_factors],
        total=len(filtered_factors),
        page=page,
        per_page=per_page
    )

@app.post("/search", response_model=ConversionFactorResponse, summary="Advanced search")
async def search_conversion_factors(
    search_request: SearchRequest,
    page: int = Query(1, ge=1, description="Page number"),
    per_page: int = Query(50, ge=1, le=1000, description="Items per page")
):
    """Advanced search for conversion factors with multiple criteria."""
    
    data = load_conversion_factors()
    
    # Filter factors
    filtered_factors = search_factors(data["conversion_factors"], search_request)
    
    # Pagination
    start_idx = (page - 1) * per_page
    end_idx = start_idx + per_page
    paginated_factors = filtered_factors[start_idx:end_idx]
    
    return ConversionFactorResponse(
        metadata=data["metadata"],
        factors=[ConversionFactor(**factor) for factor in paginated_factors],
        total=len(filtered_factors),
        page=page,
        per_page=per_page
    )

@app.get("/factors/{factor_id}", response_model=ConversionFactor, summary="Get specific factor")
async def get_factor_by_id(factor_id: str):
    """Get a specific conversion factor by its ID."""
    
    data = load_conversion_factors()
    
    factor = next((f for f in data["conversion_factors"] if f["id"] == factor_id), None)
    
    if not factor:
        raise HTTPException(status_code=404, detail=f"Conversion factor {factor_id} not found")
    
    return ConversionFactor(**factor)

@app.get("/major-changes", summary="Get 2025 major changes")
async def get_major_changes():
    """Get analysis of major changes in 2025 conversion factors."""
    return load_major_changes()

@app.get("/quick-lookup", summary="Quick lookup for common factors")
async def quick_lookup(
    fuel_type: Optional[str] = Query(None, description="Fuel type (e.g., natural gas, petrol, diesel)"),
    electricity: bool = Query(False, description="UK electricity factors"),
    transport_mode: Optional[str] = Query(None, description="Transport mode (e.g., car, flight, rail)"),
    activity_unit: Optional[str] = Query(None, description="Activity unit")
):
    """Quick lookup for commonly used conversion factors."""
    
    data = load_conversion_factors()
    factors = data["conversion_factors"]
    
    results = []
    
    if electricity:
        # Find UK electricity factors
        electricity_factors = [
            f for f in factors 
            if any(tag in ["electricity", "uk", "grid"] for tag in f.get("tags", []))
            and f.get("scope") in ["Scope 2", "Scope 1"]
        ]
        results.extend(electricity_factors[:10])
    
    if fuel_type:
        # Find fuel factors
        fuel_factors = [
            f for f in factors 
            if any(fuel_type.lower() in tag.lower() for tag in f.get("tags", []))
            and f.get("category", {}).get("level1") == "Fuels"
        ]
        results.extend(fuel_factors[:10])
    
    if transport_mode:
        # Find transport factors
        transport_factors = [
            f for f in factors 
            if any(transport_mode.lower() in tag.lower() for tag in f.get("tags", []))
            and any(cat in f.get("category", {}).get("level1", "").lower() 
                   for cat in ["travel", "vehicle", "freight"])
        ]
        results.extend(transport_factors[:10])
    
    # Remove duplicates
    seen_ids = set()
    unique_results = []
    for factor in results:
        if factor["id"] not in seen_ids:
            unique_results.append(factor)
            seen_ids.add(factor["id"])
    
    return {
        "results": [ConversionFactor(**factor) for factor in unique_results[:20]],
        "total": len(unique_results)
    }

# Health check for monitoring
@app.get("/health", summary="Health check")
async def health_check():
    """Health check endpoint for monitoring."""
    try:
        data = load_conversion_factors()
        return {
            "status": "healthy",
            "timestamp": "2025-10-19T00:00:00Z",
            "factors_loaded": data["metadata"]["total_factors"],
            "version": "1.0.0"
        }
    except Exception as e:
        raise HTTPException(status_code=503, detail=f"Service unhealthy: {str(e)}")

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)