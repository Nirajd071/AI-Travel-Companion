-- Enable PostGIS extension for geospatial queries
CREATE EXTENSION IF NOT EXISTS postgis;
CREATE EXTENSION IF NOT EXISTS postgis_topology;

-- Create geospatial indexes and functions for travel app
-- This will enable efficient location-based queries

-- Function to calculate distance between two points in kilometers
CREATE OR REPLACE FUNCTION calculate_distance_km(lat1 FLOAT, lon1 FLOAT, lat2 FLOAT, lon2 FLOAT)
RETURNS FLOAT AS $$
BEGIN
    RETURN ST_Distance(
        ST_GeogFromText('POINT(' || lon1 || ' ' || lat1 || ')'),
        ST_GeogFromText('POINT(' || lon2 || ' ' || lat2 || ')')
    ) / 1000; -- Convert meters to kilometers
END;
$$ LANGUAGE plpgsql;

-- Function to find POIs within radius (optimized for travel recommendations)
CREATE OR REPLACE FUNCTION find_pois_within_radius(
    center_lat FLOAT, 
    center_lon FLOAT, 
    radius_km FLOAT,
    poi_type VARCHAR DEFAULT NULL
)
RETURNS TABLE(
    id INTEGER,
    name VARCHAR,
    category VARCHAR,
    distance_km FLOAT,
    latitude FLOAT,
    longitude FLOAT
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        p.id,
        p.name,
        p.category,
        ST_Distance(
            ST_GeogFromText('POINT(' || center_lon || ' ' || center_lat || ')'),
            p.location
        ) / 1000 AS distance_km,
        ST_Y(p.location::geometry) AS latitude,
        ST_X(p.location::geometry) AS longitude
    FROM places p
    WHERE ST_DWithin(
        ST_GeogFromText('POINT(' || center_lon || ' ' || center_lat || ')'),
        p.location,
        radius_km * 1000 -- Convert km to meters
    )
    AND (poi_type IS NULL OR p.category = poi_type)
    ORDER BY distance_km;
END;
$$ LANGUAGE plpgsql;

-- Create spatial index for performance
-- This will be applied after the places table is created
