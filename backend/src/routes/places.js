const express = require('express');
const { Place } = require('../models');
const { cache } = require('../config/redis');
const { sequelize } = require('../config/database');
const router = express.Router();

// Get places with geospatial filtering
router.get('/nearby', async (req, res) => {
  try {
    const { lat, lng, radius = 10, category, limit = 20 } = req.query;
    
    if (!lat || !lng) {
      return res.status(400).json({ error: 'Latitude and longitude are required' });
    }

    const cacheKey = `places:nearby:${lat}:${lng}:${radius}:${category || 'all'}:${limit}`;
    
    // Check cache first
    let places = await cache.get(cacheKey);
    
    if (!places) {
      // Build query with PostGIS functions
      let whereClause = `ST_DWithin(location, ST_GeogFromText('POINT(${lng} ${lat})'), ${radius * 1000})`;
      
      if (category) {
        whereClause += ` AND category = '${category}'`;
      }

      const query = `
        SELECT 
          id, name, category, subcategory, description, address, city, country,
          rating, price_level, opening_hours, contact_info,
          ST_Distance(location, ST_GeogFromText('POINT(${lng} ${lat})')) / 1000 as distance_km,
          ST_Y(location::geometry) as latitude,
          ST_X(location::geometry) as longitude
        FROM places 
        WHERE ${whereClause}
        ORDER BY distance_km
        LIMIT ${limit}
      `;

      const [results] = await sequelize.query(query);
      places = results;
      
      // Cache for 30 minutes
      await cache.set(cacheKey, places, 1800);
    }

    res.json({
      success: true,
      count: places.length,
      data: places
    });
  } catch (error) {
    console.error('Error fetching nearby places:', error);
    res.status(500).json({ error: 'Failed to fetch places' });
  }
});

// Get place by ID
router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const cacheKey = `place:${id}`;
    
    let place = await cache.get(cacheKey);
    
    if (!place) {
      place = await Place.findByPk(id, {
        attributes: {
          include: [
            [sequelize.fn('ST_Y', sequelize.col('location')), 'latitude'],
            [sequelize.fn('ST_X', sequelize.col('location')), 'longitude']
          ]
        }
      });
      
      if (!place) {
        return res.status(404).json({ error: 'Place not found' });
      }
      
      await cache.set(cacheKey, place, 3600);
    }

    res.json({
      success: true,
      data: place
    });
  } catch (error) {
    console.error('Error fetching place:', error);
    res.status(500).json({ error: 'Failed to fetch place' });
  }
});

// Search places with Google Places API integration
router.post('/search', async (req, res) => {
  try {
    const { query, latitude, longitude, radius = 10000, limit = 20 } = req.body;
    
    if (!query) {
      return res.status(400).json({ error: 'Search query is required' });
    }

    // Use Google Places API for external search
    const googlePlacesService = require('../services/googlePlacesService');
    
    let places = [];
    
    if (latitude && longitude) {
      places = await googlePlacesService.searchPlaces(query, latitude, longitude, radius);
    }
    
    res.json({
      success: true,
      count: places.length,
      data: places
    });
  } catch (error) {
    console.error('Error searching places:', error);
    res.status(500).json({ error: 'Failed to search places' });
  }
});

// Search places (legacy GET route)
router.get('/search/:query', async (req, res) => {
  try {
    const { query } = req.params;
    const { limit = 20, category } = req.query;
    
    const cacheKey = `places:search:${query}:${category || 'all'}:${limit}`;
    
    let places = await cache.get(cacheKey);
    
    if (!places) {
      let whereClause = {
        [sequelize.Op.or]: [
          { name: { [sequelize.Op.iLike]: `%${query}%` } },
          { description: { [sequelize.Op.iLike]: `%${query}%` } },
          { city: { [sequelize.Op.iLike]: `%${query}%` } },
          { address: { [sequelize.Op.iLike]: `%${query}%` } }
        ]
      };
      
      if (category) {
        whereClause.category = category;
      }

      places = await Place.findAll({
        where: whereClause,
        limit: parseInt(limit),
        order: [['rating', 'DESC']],
        attributes: {
          include: [
            [sequelize.fn('ST_Y', sequelize.col('location')), 'latitude'],
            [sequelize.fn('ST_X', sequelize.col('location')), 'longitude']
          ]
        }
      });
      
      await cache.set(cacheKey, places, 1800);
    }

    res.json({
      success: true,
      count: places.length,
      data: places
    });
  } catch (error) {
    console.error('Error searching places:', error);
    res.status(500).json({ error: 'Failed to search places' });
  }
});

// Get categories
router.get('/meta/categories', async (req, res) => {
  try {
    const cacheKey = 'places:categories';
    
    let categories = await cache.get(cacheKey);
    
    if (!categories) {
      const [results] = await sequelize.query(`
        SELECT category, COUNT(*) as count 
        FROM places 
        GROUP BY category 
        ORDER BY count DESC
      `);
      
      categories = results;
      await cache.set(cacheKey, categories, 7200); // Cache for 2 hours
    }

    res.json({
      success: true,
      data: categories
    });
  } catch (error) {
    console.error('Error fetching categories:', error);
    res.status(500).json({ error: 'Failed to fetch categories' });
  }
});

module.exports = router;
