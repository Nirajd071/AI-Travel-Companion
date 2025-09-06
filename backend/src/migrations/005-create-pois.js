'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.createTable('pois', {
      id: {
        allowNull: false,
        autoIncrement: true,
        primaryKey: true,
        type: Sequelize.INTEGER
      },
      name: {
        type: Sequelize.STRING,
        allowNull: false
      },
      description: {
        type: Sequelize.TEXT,
        allowNull: true
      },
      category: {
        type: Sequelize.ENUM(
          'restaurant', 'cafe', 'bar', 'attraction', 'museum', 'park', 
          'shopping', 'hotel', 'transport', 'entertainment', 'nightlife',
          'outdoor', 'cultural', 'religious', 'historical', 'nature'
        ),
        allowNull: false
      },
      subcategory: {
        type: Sequelize.STRING,
        allowNull: true
      },
      location: {
        type: Sequelize.GEOMETRY('POINT', 4326),
        allowNull: false
      },
      latitude: {
        type: Sequelize.DECIMAL(10, 8),
        allowNull: false
      },
      longitude: {
        type: Sequelize.DECIMAL(11, 8),
        allowNull: false
      },
      address: {
        type: Sequelize.TEXT,
        allowNull: true
      },
      city: {
        type: Sequelize.STRING,
        allowNull: true
      },
      country: {
        type: Sequelize.STRING,
        allowNull: true
      },
      postal_code: {
        type: Sequelize.STRING,
        allowNull: true
      },
      phone: {
        type: Sequelize.STRING,
        allowNull: true
      },
      website: {
        type: Sequelize.STRING,
        allowNull: true
      },
      rating: {
        type: Sequelize.DECIMAL(3, 2),
        allowNull: true,
        validate: {
          min: 0,
          max: 5
        }
      },
      review_count: {
        type: Sequelize.INTEGER,
        defaultValue: 0
      },
      price_level: {
        type: Sequelize.INTEGER,
        allowNull: true,
        validate: {
          min: 1,
          max: 4
        }
      },
      opening_hours: {
        type: Sequelize.JSONB,
        allowNull: true
      },
      tags: {
        type: Sequelize.ARRAY(Sequelize.STRING),
        defaultValue: []
      },
      features: {
        type: Sequelize.JSONB,
        allowNull: true
      },
      images: {
        type: Sequelize.ARRAY(Sequelize.STRING),
        defaultValue: []
      },
      external_id: {
        type: Sequelize.STRING,
        allowNull: true
      },
      external_source: {
        type: Sequelize.ENUM('google_places', 'foursquare', 'manual'),
        allowNull: false,
        defaultValue: 'manual'
      },
      popularity_score: {
        type: Sequelize.DECIMAL(5, 4),
        defaultValue: 0.5
      },
      is_active: {
        type: Sequelize.BOOLEAN,
        defaultValue: true
      },
      last_updated: {
        type: Sequelize.DATE,
        defaultValue: Sequelize.literal('CURRENT_TIMESTAMP')
      },
      created_at: {
        allowNull: false,
        type: Sequelize.DATE,
        defaultValue: Sequelize.literal('CURRENT_TIMESTAMP')
      },
      updated_at: {
        allowNull: false,
        type: Sequelize.DATE,
        defaultValue: Sequelize.literal('CURRENT_TIMESTAMP')
      }
    });

    // Add spatial index for location-based queries
    await queryInterface.addIndex('pois', {
      fields: ['location'],
      using: 'GIST'
    });

    // Add regular indexes
    await queryInterface.addIndex('pois', ['category']);
    await queryInterface.addIndex('pois', ['city']);
    await queryInterface.addIndex('pois', ['rating']);
    await queryInterface.addIndex('pois', ['external_source', 'external_id']);
    await queryInterface.addIndex('pois', ['is_active']);
    await queryInterface.addIndex('pois', ['popularity_score']);
  },

  down: async (queryInterface, Sequelize) => {
    await queryInterface.dropTable('pois');
  }
};
